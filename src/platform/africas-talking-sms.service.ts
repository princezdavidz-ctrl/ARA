import { Injectable, Logger, OnModuleDestroy, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '../config/config.service';
import { DatabaseService } from '../database/database.service';
import { ChannelCredentialVault } from './channel-credential-vault.service';
import { MessageUsageQuotaService } from './message-usage-quota.service';

type SmsJob={id:string;agencyId:string;conversationId:string;recipient:string;body:string;connectionId:string;attempts:number};
@Injectable()
export class AfricaTalkingSmsService implements OnModuleInit,OnModuleDestroy {
  private readonly logger=new Logger(AfricaTalkingSmsService.name);
  private timer:ReturnType<typeof setInterval>|undefined;
  private running=false;
  constructor(private readonly db:DatabaseService,private readonly vault:ChannelCredentialVault,private readonly quota:MessageUsageQuotaService,private readonly config:ConfigService){}
  onModuleInit(){this.timer=setInterval(()=>void this.tick(),2000);void this.tick();}
  onModuleDestroy(){if(this.timer)clearInterval(this.timer);}

  private async resolveConnection(token:string){
    if(!token||token.length<24)throw new UnauthorizedException('Invalid SMS webhook token');
    const connection=await this.vault.findByVerifyToken('africas_talking_sms',token,true);
    if(!connection)throw new UnauthorizedException('Invalid SMS webhook token');
    return connection;
  }

  async receiveIncoming(token:string,payload:any){
    const connection=await this.resolveConnection(token);
    const from=String(payload?.from||payload?.phoneNumber||'').trim();
    const to=String(payload?.to||'').trim();
    const text=String(payload?.text||'').trim();
    const providerId=String(payload?.id||payload?.messageId||'').trim();
    if(!/^\+?[1-9]\d{7,14}$/.test(from)||!text||text.length>5000||!providerId)throw new UnauthorizedException('Incomplete or invalid incoming SMS callback');
    if(connection.externalAccountId&&to&&connection.externalAccountId!==to)throw new UnauthorizedException('SMS destination does not match this tenant connection');
    const result=await this.db.transaction(async client=>{
      const found=await client.query("SELECT id FROM conversations WHERE agency_id=$1 AND channel='sms' AND channel_connection_id=$2 AND customer_contact=$3 AND status<>'closed' ORDER BY updated_at DESC LIMIT 1 FOR UPDATE",[connection.agencyId,connection.id,from]);
      let conversationId=found.rows[0]?.id;
      if(!conversationId){const created=await client.query("INSERT INTO conversations(agency_id,channel,channel_connection_id,customer_name,customer_contact) VALUES($1,'sms',$2,NULL,$3) RETURNING id",[connection.agencyId,connection.id,from]);conversationId=created.rows[0].id;}
      const inserted=await client.query("INSERT INTO messages(agency_id,conversation_id,direction,sender_type,body,idempotency_key,delivery_status,processing_status) VALUES($1,$2,'inbound','customer',$3,$4,'stored','pending') ON CONFLICT(agency_id,idempotency_key) DO NOTHING RETURNING id",[connection.agencyId,conversationId,text,'africas-talking:'+connection.id+':'+providerId]);
      if(inserted.rowCount)await client.query('UPDATE conversations SET updated_at=now() WHERE id=$1 AND agency_id=$2',[conversationId,connection.agencyId]);
      return {accepted:Boolean(inserted.rowCount),conversationId};
    });
    return {received:true,...result};
  }

  async receiveDeliveryReport(token:string,payload:any){
    const connection=await this.resolveConnection(token);
    const providerId=String(payload?.id||payload?.messageId||'').trim();
    const status=String(payload?.status||'').trim().toLowerCase();
    if(!providerId||!status)throw new UnauthorizedException('Incomplete SMS delivery report');
    const delivered=['success','successful','delivered'].includes(status);
    const failed=['failed','rejected','undelivered','expired'].includes(status);
    if(!delivered&&!failed)return {received:true,updated:false};
    const result=await this.db.query("UPDATE messages m SET delivery_status=$3,delivery_error=CASE WHEN $3='failed' THEN left(COALESCE($4,'SMS provider reported delivery failure'),1000) ELSE NULL END,delivery_started_at=NULL,delivery_next_attempt_at=NULL FROM conversations cv WHERE cv.id=m.conversation_id AND cv.agency_id=m.agency_id AND cv.agency_id=$1 AND cv.channel_connection_id=$2 AND m.provider_message_id=$5 AND m.direction='outbound' AND m.delivery_status IN ('sent','delivered') RETURNING m.id",[connection.agencyId,connection.id,delivered?'delivered':'failed',String(payload?.failureReason||payload?.failure_reason||'SMS delivery failed'),providerId]);
    return {received:true,updated:Boolean(result.rowCount)};
  }

  private async tick(){
    if(this.running)return;this.running=true;
    try{for(let i=0;i<5;i++){const job=await this.claim();if(!job)break;await this.deliver(job);}}
    catch(error){this.logger.error('SMS worker cycle failed',error instanceof Error?error.stack:undefined);}
    finally{this.running=false;}
  }
  private async claim():Promise<SmsJob|null>{
    return this.db.transaction(async client=>{
      await client.query("UPDATE messages m SET delivery_status='failed',delivery_started_at=NULL,delivery_error='SMS delivery lease expired after final attempt' FROM conversations cv WHERE cv.id=m.conversation_id AND cv.agency_id=m.agency_id AND cv.channel='sms' AND m.direction='outbound' AND m.delivery_status='sending' AND m.delivery_started_at<now()-interval '5 minutes' AND m.delivery_attempts>=5");
      const r=await client.query<SmsJob>("SELECT m.id,m.agency_id AS \"agencyId\",m.conversation_id AS \"conversationId\",m.body,cv.customer_contact AS recipient,cv.channel_connection_id AS \"connectionId\",m.delivery_attempts AS attempts FROM messages m JOIN conversations cv ON cv.id=m.conversation_id AND cv.agency_id=m.agency_id JOIN channel_connections cc ON cc.id=cv.channel_connection_id AND cc.agency_id=cv.agency_id AND cc.status='active' AND cc.provider='africas_talking_sms' WHERE m.direction='outbound' AND m.approval_status='approved' AND m.delivery_attempts<5 AND ((m.delivery_status='queued' AND (m.delivery_next_attempt_at IS NULL OR m.delivery_next_attempt_at<=now())) OR (m.delivery_status='sending' AND m.delivery_started_at<now()-interval '5 minutes')) ORDER BY m.created_at LIMIT 1 FOR UPDATE OF m SKIP LOCKED");
      const job=r.rows[0];if(!job)return null;job.attempts=Number(job.attempts)+1;
      await client.query("UPDATE messages SET delivery_status='sending',delivery_started_at=now(),delivery_attempts=$2,delivery_error=NULL WHERE id=$1",[job.id,job.attempts]);
      return job;
    });
  }
  private async deliver(job:SmsJob){
    const key='message-out:'+job.id;
    const reservation=await this.quota.reserve(job.agencyId,'message_out',key);
    if(!reservation.allowed){await this.db.query("UPDATE messages SET delivery_status='failed',delivery_started_at=NULL,delivery_error=$2 WHERE id=$1 AND delivery_status='sending'",[job.id,(reservation.reason||'SMS allowance exhausted').slice(0,1000)]);return;}
    const connection=await this.vault.getForTenantConnection(job.agencyId,job.connectionId,true);
    if(!connection){await this.fail(job,'SMS channel connection is no longer active.',true);return;}
    const username=connection.credentials.username,apiKey=connection.credentials.apiKey,environment=connection.credentials.environment;
    if(!username||!apiKey||!['sandbox','production'].includes(environment)){await this.fail(job,'Africa\'s Talking SMS credentials are incomplete.',true);return;}
    if(job.body.length>1600){await this.fail(job,'SMS message exceeds the 1,600-character platform limit.',true);return;}
    try{
      const endpoint=environment==='sandbox'?'https://api.sandbox.africastalking.com/version1/messaging':'https://api.africastalking.com/version1/messaging';
      const form=new URLSearchParams({username,to:job.recipient,message:job.body});
      if(environment==='production'&&connection.externalAccountId)form.set('from',connection.externalAccountId);
      const response=await fetch(endpoint,{method:'POST',headers:{apiKey,'Accept':'application/json','Content-Type':'application/x-www-form-urlencoded'},body:form.toString(),signal:AbortSignal.timeout(15000)});
      const payload:any=await response.json().catch(()=>({}));
      const recipient=payload?.SMSMessageData?.Recipients?.[0];
      const providerId=String(recipient?.messageId||'');
      const statusCode=Number(recipient?.statusCode);
      if(!response.ok||!providerId||![100,101,102].includes(statusCode)){
        const detail=String(recipient?.status||payload?.SMSMessageData?.Message||'Africa\'s Talking SMS API HTTP '+response.status);
        await this.fail(job,detail,(response.status>=400&&response.status<500&&response.status!==429)||statusCode>=400);return;
      }
      await this.db.query("UPDATE messages SET delivery_status='sent',provider_message_id=$2,delivery_started_at=NULL,delivery_next_attempt_at=NULL,delivery_error=NULL WHERE id=$1 AND delivery_status='sending'",[job.id,providerId]);
      await this.quota.consume(job.agencyId,key);
    }catch(error){await this.fail(job,error instanceof Error?error.message:'Unknown SMS provider error',false);}
  }
  private async fail(job:SmsJob,reason:string,permanent:boolean){
    await this.quota.release(job.agencyId,'message-out:'+job.id);
    const terminal=permanent||job.attempts>=5,delay=Math.min(1800,30*(2**Math.max(0,job.attempts-1)));
    await this.db.query("UPDATE messages SET delivery_status=$2,delivery_started_at=NULL,delivery_next_attempt_at=CASE WHEN $2='queued' THEN now()+($3*interval '1 second') ELSE NULL END,delivery_error=$4 WHERE id=$1 AND delivery_status='sending'",[job.id,terminal?'failed':'queued',delay,reason.slice(0,1000)]);
    if(terminal)this.logger.warn('SMS delivery permanently failed for '+job.id+': '+reason);
  }
}
