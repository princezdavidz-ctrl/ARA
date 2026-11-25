import { BadRequestException, ForbiddenException, Injectable, Logger, TooManyRequestsException, UnauthorizedException } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { ChannelCredentialVault, ResolvedChannel } from './channel-credential-vault.service';
import { AraUser } from './auth.guard';

type VoiceCallRow={id:string;agencyId:string;connectionId:string;conversationId:string;providerSessionId:string|null;clientRequestId:string;direction:'inbound'|'outbound';callerNumber:string;destinationNumber:string;status:string;};
@Injectable()
export class AfricaTalkingVoiceService {
  private readonly logger=new Logger(AfricaTalkingVoiceService.name);
  constructor(private readonly db:DatabaseService,private readonly vault:ChannelCredentialVault){}

  private requireVoiceManager(user:AraUser){if(!['owner','admin','manager'].includes(user.role))throw new ForbiddenException('Only company managers can initiate or view voice calls.');}
  private validPhone(value:string){return /^\+[1-9]\d{7,14}$/.test(value);}
  private async connectionForToken(token:string):Promise<ResolvedChannel>{
    if(!token||token.length<32)throw new UnauthorizedException('Invalid voice webhook token');
    const connection=await this.vault.findByVerifyToken('africas_talking_voice',token,true);
    if(!connection)throw new UnauthorizedException('Invalid voice webhook token');
    return connection;
  }
  private xmlEscape(value:string){return value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');}
  private status(value:string):string{
    const s=value.toLowerCase();
    if(s.includes('bridge')||s==='active')return 'bridged';
    if(s.includes('ring'))return 'ringing';
    if(s.includes('dial'))return 'dialing';
    if(s.includes('complete')||s==='hangup')return 'completed';
    if(s.includes('notanswered')||s.includes('no_answer'))return 'not_answered';
    if(s.includes('busy'))return 'busy';
    if(s.includes('reject'))return 'rejected';
    if(s.includes('expir'))return 'expired';
    if(s.includes('fail')||s.includes('abort'))return 'failed';
    if(s.includes('queue')||s.includes('enqueue'))return 'queued';
    return 'queued';
  }

  async initiateCall(user:AraUser,body:any){
    this.requireVoiceManager(user);
    const connectionId=String(body?.connectionId||'').trim();
    const to=String(body?.to||'').trim();
    if(!connectionId||!this.validPhone(to))throw new BadRequestException('Provide a voice connection and a destination phone number in international E.164 format.');
    const connection=await this.vault.getForTenantConnection(user.agencyId,connectionId,true);
    if(!connection||connection.provider!=='africas_talking_voice')throw new BadRequestException('An active Africa\'s Talking Voice connection is required.');
    const {username,apiKey,environment,transferNumber}=connection.credentials;
    if(!username||!apiKey||!this.validPhone(transferNumber))throw new BadRequestException('Voice connection credentials or agent transfer number are incomplete.');
    const clientRequestId=randomUUID();
    const created=await this.db.transaction(async client=>{
      const recent=await client.query('SELECT id FROM voice_calls WHERE connection_id=$1 AND direction=\'outbound\' AND created_at>now()-interval \'1 second\' LIMIT 1',[connection.id]);
      if(recent.rowCount)throw new TooManyRequestsException('This voice provider allows one outbound call initiation per second per connection.');
      const active=await client.query(\"SELECT count(*)::int AS count FROM voice_calls WHERE connection_id=$1 AND status IN ('queued','dialing','ringing','bridged')\",[connection.id]);
      if(Number(active.rows[0]?.count||0)>=40)throw new TooManyRequestsException('This voice connection has reached its 40-call concurrency limit.');
      const conversation=await client.query("INSERT INTO conversations(agency_id,channel,channel_connection_id,customer_contact) VALUES($1,'phone',$2,$3) RETURNING id",[user.agencyId,connection.id,to]);
      const call=await client.query("INSERT INTO voice_calls(agency_id,connection_id,conversation_id,direction,client_request_id,caller_number,destination_number,status,metadata) VALUES($1,$2,$3,'outbound',$4,$5,$6,'queued',$7::jsonb) RETURNING id,client_request_id AS \"clientRequestId\",conversation_id AS \"conversationId\"",
        [user.agencyId,connection.id,conversation.rows[0].id,clientRequestId,connection.externalAccountId,to,JSON.stringify({initiatedBy:user.id})]);
      await client.query("INSERT INTO audit_logs(agency_id,actor_user_id,action,target_type,target_id,details) VALUES($1,$2,'voice.call_initiated','voice_call',$3,$4::jsonb)",[user.agencyId,user.id,call.rows[0].id,JSON.stringify({direction:'outbound',destination:to})]);
      return call.rows[0];
    });
    try{
      const endpoint=environment==='sandbox'?'https://voice.sandbox.africastalking.com/call':'https://voice.africastalking.com/call';
      const form=new URLSearchParams({username,from:connection.externalAccountId,to,clientRequestId});
      const response=await fetch(endpoint,{method:'POST',headers:{apiKey,'Accept':'application/json','Content-Type':'application/x-www-form-urlencoded'},body:form.toString(),signal:AbortSignal.timeout(20000)});
      const payload:any=await response.json().catch(()=>({}));
      const entry=payload?.entries?.[0]||{};
      const sessionId=String(entry.sessionId||payload.sessionId||'').trim();
      if(!response.ok||!sessionId)throw new Error(String(entry.errorMessage||payload.errorMessage||'Africa\'s Talking did not return a call session ID (HTTP '+response.status+').'));
      await this.db.query("UPDATE voice_calls SET provider_session_id=$3,status=$4,started_at=COALESCE(started_at,now()),updated_at=now() WHERE agency_id=$1 AND id=$2",[user.agencyId,created.id,sessionId,this.status(String(entry.status||'dialing'))]);
      return {callId:created.id,conversationId:created.conversationId,clientRequestId,providerSessionId:sessionId,status:this.status(String(entry.status||'dialing'))};
    }catch(error){
      const reason=error instanceof Error?error.message:'Unknown voice provider error';
      await this.db.query("UPDATE voice_calls SET status='failed',ended_at=now(),metadata=metadata||$3::jsonb,updated_at=now() WHERE agency_id=$1 AND id=$2",[user.agencyId,created.id,JSON.stringify({providerError:reason.slice(0,500)})]);
      this.logger.warn('Outbound voice call failed for '+created.id+': '+reason);
      throw new BadRequestException('Unable to start the voice call: '+reason);
    }
  }

  async listCalls(user:AraUser){
    const r=await this.db.query("SELECT id,conversation_id AS \"conversationId\",direction,caller_number AS \"callerNumber\",destination_number AS \"destinationNumber\",status,duration_seconds AS \"durationSeconds\",provider_cost AS \"providerCost\",currency_code AS \"currencyCode\",recording_enabled AS \"recordingEnabled\",recording_url IS NOT NULL AS \"recordingAvailable\",started_at AS \"startedAt\",answered_at AS \"answeredAt\",ended_at AS \"endedAt\",created_at AS \"createdAt\" FROM voice_calls WHERE agency_id=$1 ORDER BY created_at DESC LIMIT 100",[user.agencyId]);
    return {items:r.rows};
  }

  async handleCallback(token:string,body:any){
    const connection=await this.connectionForToken(token);
    const sessionId=String(body?.sessionId||'').trim();
    const clientRequestId=String(body?.clientRequestId||'').trim();
    const caller=String(body?.callerNumber||'').trim();
    const destination=String(body?.destinationNumber||'').trim();
    const rawDirection=String(body?.direction||'').toLowerCase();
    const direction=rawDirection?rawDirection.startsWith('out')?'outbound':'inbound':caller===connection.externalAccountId?'outbound':'inbound';
    const isActive=String(body?.isActive||'0')==='1';
    if(!sessionId||!caller||!destination||!this.validPhone(caller)||!this.validPhone(destination))throw new BadRequestException('Incomplete voice callback payload.');
    if(direction==='inbound'&&destination!==connection.externalAccountId)throw new UnauthorizedException('Inbound call destination does not match this voice connection.');
    await this.db.transaction(async client=>{
      let call=await client.query<VoiceCallRow>("SELECT id,agency_id AS \"agencyId\",connection_id AS \"connectionId\",conversation_id AS \"conversationId\",provider_session_id AS \"providerSessionId\",client_request_id AS \"clientRequestId\",direction,caller_number AS \"callerNumber\",destination_number AS \"destinationNumber\",status FROM voice_calls WHERE agency_id=$1 AND connection_id=$2 AND (provider_session_id=$3 OR ($4<>'' AND client_request_id=$4)) ORDER BY created_at DESC LIMIT 1 FOR UPDATE",[connection.agencyId,connection.id,sessionId,clientRequestId]);
      let existing=call.rows[0];
      if(!existing){
        const customer=direction==='inbound'?caller:destination;
        const conversation=await client.query("INSERT INTO conversations(agency_id,channel,channel_connection_id,customer_contact) VALUES($1,'phone',$2,$3) RETURNING id",[connection.agencyId,connection.id,customer]);
        const reqId=clientRequestId||('inbound:'+sessionId);
        const inserted=await client.query("INSERT INTO voice_calls(agency_id,connection_id,conversation_id,direction,provider_session_id,client_request_id,caller_number,destination_number,status,started_at,metadata) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,now(),$10::jsonb) ON CONFLICT(agency_id,client_request_id) DO UPDATE SET provider_session_id=COALESCE(voice_calls.provider_session_id,EXCLUDED.provider_session_id),updated_at=now() RETURNING id,agency_id AS \"agencyId\",connection_id AS \"connectionId\",conversation_id AS \"conversationId\",provider_session_id AS \"providerSessionId\",client_request_id AS \"clientRequestId\",direction,caller_number AS \"callerNumber\",destination_number AS \"destinationNumber\",status",
          [connection.agencyId,connection.id,conversation.rows[0].id,direction,sessionId,reqId,caller,destination,isActive?'bridged':'queued',JSON.stringify({inboundCallback:true})]);
        existing=inserted.rows[0];
      }else if(!existing.providerSessionId){
        await client.query('UPDATE voice_calls SET provider_session_id=$3,updated_at=now() WHERE agency_id=$1 AND id=$2',[connection.agencyId,existing.id,sessionId]);
      }
      const eventKey=createHash('sha256').update(JSON.stringify(body)).digest('hex');
      await client.query("INSERT INTO voice_call_events(agency_id,call_id,event_key,event_type,payload) VALUES($1,$2,$3,$4,$5::jsonb) ON CONFLICT(call_id,event_key) DO NOTHING",[connection.agencyId,existing.id,eventKey,String(body?.status||body?.callSessionState||'callback'),JSON.stringify(body)]);
      await client.query("UPDATE voice_calls SET status=CASE WHEN $3 THEN 'bridged' ELSE status END,provider_session_id=COALESCE(provider_session_id,$4),updated_at=now() WHERE agency_id=$1 AND id=$2",[connection.agencyId,existing.id,isActive,sessionId]);
      return existing;
    });
    if(!isActive)return '<?xml version="1.0" encoding="UTF-8"?><Response><Hangup /></Response>';
    const transfer=connection.credentials.transferNumber;
    const say=direction==='outbound'?'Hello. Please hold while we connect you to our representative.':'Thank you for calling. Please hold while we connect you to our team.';
    return '<?xml version="1.0" encoding="UTF-8"?><Response><Say>'+this.xmlEscape(say)+'</Say><Dial phoneNumbers="'+this.xmlEscape(transfer)+'" /></Response>';
  }

  async handleEvent(token:string,body:any){
    const connection=await this.connectionForToken(token);
    const sessionId=String(body?.sessionId||'').trim();
    const clientRequestId=String(body?.clientRequestId||'').trim();
    if(!sessionId&&!clientRequestId)throw new BadRequestException('Voice event is missing a session or request ID.');
    const state=String(body?.status||body?.callSessionState||'').trim();
    const nextStatus=this.status(state);
    const duration=Math.max(0,Math.floor(Number(body?.durationInSeconds||0)||0));
    const amount=Number(body?.amount);
    const currency=String(body?.currencyCode||'KES').slice(0,3).toUpperCase();
    const result=await this.db.transaction(async client=>{
      const found=await client.query<VoiceCallRow>("SELECT id,agency_id AS \"agencyId\",connection_id AS \"connectionId\",conversation_id AS \"conversationId\",provider_session_id AS \"providerSessionId\",client_request_id AS \"clientRequestId\",direction,caller_number AS \"callerNumber\",destination_number AS \"destinationNumber\",status FROM voice_calls WHERE agency_id=$1 AND connection_id=$2 AND (provider_session_id=$3 OR ($4<>'' AND client_request_id=$4)) ORDER BY created_at DESC LIMIT 1 FOR UPDATE",[connection.agencyId,connection.id,sessionId,clientRequestId]);
      const call=found.rows[0];if(!call)return {updated:false};
      const eventKey=createHash('sha256').update(JSON.stringify(body)).digest('hex');
      await client.query("INSERT INTO voice_call_events(agency_id,call_id,event_key,event_type,payload) VALUES($1,$2,$3,$4,$5::jsonb) ON CONFLICT(call_id,event_key) DO NOTHING",[connection.agencyId,call.id,eventKey,state||'status',JSON.stringify(body)]);
      await client.query("UPDATE voice_calls SET status=$3,duration_seconds=GREATEST(duration_seconds,$4),provider_cost=COALESCE($5,provider_cost),currency_code=$6,answered_at=CASE WHEN $3='bridged' THEN COALESCE(answered_at,now()) ELSE answered_at END,ended_at=CASE WHEN $3 IN ('completed','not_answered','busy','rejected','expired','failed') THEN COALESCE(ended_at,now()) ELSE ended_at END,last_provider_event_at=now(),updated_at=now() WHERE agency_id=$1 AND id=$2",[connection.agencyId,call.id,nextStatus,duration,Number.isFinite(amount)?amount:null,currency]);
      if(['not_answered','busy','rejected','expired'].includes(nextStatus))await client.query("INSERT INTO escalations(agency_id,conversation_id,reason) SELECT $1,$2,$3 WHERE NOT EXISTS(SELECT 1 FROM escalations WHERE agency_id=$1 AND conversation_id=$2 AND status IN ('open','claimed'))",[connection.agencyId,call.conversationId,'Missed or unsuccessful phone call requires human follow-up']);
      if(nextStatus==='completed'){
        await client.query("INSERT INTO usage_records(agency_id,subscription_id,metric,quantity,idempotency_key,metadata) VALUES($1,(SELECT id FROM company_subscriptions WHERE agency_id=$1 AND status IN ('active','trialing','past_due') AND current_period_start<=now() AND current_period_end>now() ORDER BY created_at DESC LIMIT 1),'voice_call',1,$2,$3::jsonb) ON CONFLICT(agency_id,idempotency_key) DO NOTHING",[connection.agencyId,'voice-call:'+call.id,JSON.stringify({durationSeconds:duration,providerCost:Number.isFinite(amount)?amount:null,currency})]);
        if(duration>0)await client.query("INSERT INTO usage_records(agency_id,subscription_id,metric,quantity,idempotency_key,metadata) VALUES($1,(SELECT id FROM company_subscriptions WHERE agency_id=$1 AND status IN ('active','trialing','past_due') AND current_period_start<=now() AND current_period_end>now() ORDER BY created_at DESC LIMIT 1),'voice_second',$3,$2,$4::jsonb) ON CONFLICT(agency_id,idempotency_key) DO NOTHING",[connection.agencyId,'voice-seconds:'+call.id,duration,JSON.stringify({providerCost:Number.isFinite(amount)?amount:null,currency})]);
      }
      return {updated:true,callId:call.id,status:nextStatus};
    });
    return {received:true,...result};
  }
}
