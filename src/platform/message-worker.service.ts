import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AnswerService } from '../rag/answer.service';
import { AnswerInput } from '../rag/contracts';
import { ConfigService } from '../config/config.service';
import { ChannelCredentialVault } from './channel-credential-vault.service';

interface MessageJob { id: string; agencyId: string; conversationId: string; body: string; subject?: string | null; attempts: number; connectionId?: string | null; }
interface EmailDeliveryJob extends MessageJob { recipient: string; }
interface WhatsAppDeliveryJob extends MessageJob { recipient: string; }
interface InstagramDeliveryJob extends MessageJob { recipient: string; }
interface TikTokDeliveryJob extends MessageJob { recipient: string; }

@Injectable()
export class MessageWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MessageWorker.name);
  private timer: ReturnType<typeof setInterval> | undefined;
  private running = false;

  constructor(private readonly db: DatabaseService, private readonly answers: AnswerService, private readonly config: ConfigService, private readonly vault: ChannelCredentialVault) {}
  onModuleInit(): void { this.timer = setInterval(() => void this.tick(), 1500); void this.tick(); }
  onModuleDestroy(): void { if (this.timer) clearInterval(this.timer); }

  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      for (let i = 0; i < 5; i++) {
        const job = await this.claimInbound();
        if (!job) break;
        await this.processInbound(job);
      }
      if (this.config.get('EMAIL_RESEND_API_KEY') && this.config.get('EMAIL_FROM_ADDRESS') && this.config.get('EMAIL_AGENCY_ID')) {
        for (let i = 0; i < 5; i++) { const job = await this.claimEmailDelivery(); if (!job) break; await this.deliverEmail(job); }
      }
      for (let i=0;i<5;i++){const job=await this.claimInstagramDelivery();if(!job)break;await this.deliverInstagram(job);}
      if (this.config.get('TIKTOK_ACCESS_TOKEN') && this.config.get('TIKTOK_BUSINESS_ID') && this.config.get('TIKTOK_AGENCY_ID')) {
        for (let i=0;i<5;i++){const job=await this.claimTikTokDelivery();if(!job)break;await this.deliverTikTok(job);}
      }
      for (let i=0;i<5;i++){const job=await this.claimWhatsAppDelivery();if(!job)break;await this.deliverWhatsApp(job);}
    } catch (error) {
      this.logger.error('Message worker cycle failed', error instanceof Error ? error.stack : undefined);
    } finally { this.running = false; }
  }

  private async claimInbound(): Promise<MessageJob | null> {
    return this.db.transaction(async client => {
      const result = await client.query<MessageJob>("SELECT m.id, m.agency_id AS \"agencyId\", m.conversation_id AS \"conversationId\", m.body, m.subject, m.processing_attempts AS attempts FROM messages m JOIN conversations cv ON cv.id=m.conversation_id AND cv.agency_id=m.agency_id WHERE m.direction='inbound' AND (m.processing_status='pending' OR (m.processing_status='processing' AND m.processing_started_at < now()-interval '5 minutes')) ORDER BY m.created_at LIMIT 1 FOR UPDATE OF m SKIP LOCKED");
      const job = result.rows[0];
      if (!job) return null;
      const attempts = Number(job.attempts) + 1;
      if (attempts > 5) {
        await client.query("UPDATE messages SET processing_status='failed',processing_started_at=NULL WHERE id=$1", [job.id]);
        return null;
      }
      await client.query("UPDATE messages SET processing_status='processing',processing_started_at=now(),processing_attempts=$2 WHERE id=$1", [job.id, attempts]);
      return { ...job, attempts };
    });
  }

  private async processInbound(job: MessageJob): Promise<void> {
    try {
      const result = await this.answers.answer({ message: job.body, preferredLanguage: 'auto', filters: {} } as AnswerInput, job.agencyId);
      await this.db.transaction(async client => {
        await client.query("INSERT INTO messages(agency_id,conversation_id,direction,sender_type,body,subject,idempotency_key,delivery_status,processing_status) VALUES($1,$2,'outbound','ai',$3,$4,$5,'queued','not_applicable') ON CONFLICT(agency_id,idempotency_key) DO NOTHING", [job.agencyId, job.conversationId, result.answer, job.subject ? (job.subject.toLowerCase().startsWith('re:') ? job.subject : 'Re: ' + job.subject) : null, 'ai:' + job.id]);
        await client.query("UPDATE messages SET processing_status='completed',processing_started_at=NULL WHERE id=$1", [job.id]);
        await client.query("UPDATE conversations SET status=$3,updated_at=now() WHERE id=$1 AND agency_id=$2", [job.conversationId, job.agencyId, result.status === 'needs_human' ? 'pending' : 'open']);
        if (result.status === 'needs_human') {
          await client.query("INSERT INTO escalations(agency_id,conversation_id,reason) SELECT $1,$2,$3 WHERE NOT EXISTS(SELECT 1 FROM escalations WHERE agency_id=$1 AND conversation_id=$2 AND status IN ('open','claimed'))", [job.agencyId, job.conversationId, result.escalationReason || 'AI requested human review']);
        }
      });
    } catch (error) {
      this.logger.error('Inbound message ' + job.id + ' failed on attempt ' + job.attempts, error instanceof Error ? error.stack : undefined);
      await this.db.query("UPDATE messages SET processing_status=$2,processing_started_at=NULL WHERE id=$1 AND processing_status='processing'", [job.id, job.attempts >= 5 ? 'failed' : 'pending']);
    }
  }


  private async claimEmailDelivery(): Promise<EmailDeliveryJob | null> {
    return this.db.transaction(async client => {
      await client.query("UPDATE messages SET delivery_status='failed',delivery_started_at=NULL,delivery_error='Email delivery lease expired after final attempt' WHERE direction='outbound' AND delivery_status='sending' AND delivery_started_at < now()-interval '5 minutes' AND delivery_attempts>=5");
      const result = await client.query<EmailDeliveryJob>(
        "SELECT m.id,m.agency_id AS \"agencyId\",m.conversation_id AS \"conversationId\",m.body,COALESCE(m.subject,(SELECT im.subject FROM messages im WHERE im.agency_id=m.agency_id AND im.conversation_id=m.conversation_id AND im.direction='inbound' AND im.subject IS NOT NULL ORDER BY im.created_at DESC LIMIT 1),'Re: Your enquiry') AS subject,cv.customer_contact AS recipient,m.delivery_attempts AS attempts FROM messages m JOIN conversations cv ON cv.id=m.conversation_id AND cv.agency_id=m.agency_id WHERE m.direction='outbound' AND cv.agency_id=$1 AND cv.channel='email' AND cv.customer_contact IS NOT NULL AND m.delivery_attempts<5 AND ((m.delivery_status='queued' AND (m.delivery_next_attempt_at IS NULL OR m.delivery_next_attempt_at<=now())) OR (m.delivery_status='sending' AND m.delivery_started_at < now()-interval '5 minutes')) ORDER BY m.created_at LIMIT 1 FOR UPDATE OF m SKIP LOCKED",
        [this.config.get('EMAIL_AGENCY_ID')],
      );
      const job = result.rows[0]; if (!job) return null;
      const attempts = Number(job.attempts) + 1;
      await client.query("UPDATE messages SET delivery_status='sending',delivery_started_at=now(),delivery_attempts=$2,delivery_error=NULL WHERE id=$1", [job.id, attempts]);
      return { ...job, attempts };
    });
  }

  private async deliverEmail(job: EmailDeliveryJob): Promise<void> {
    const apiKey = this.config.get('EMAIL_RESEND_API_KEY'); const from = this.config.get('EMAIL_FROM_ADDRESS');
    if (!apiKey || !from) return;
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json', 'Idempotency-Key': 'ara-' + job.id },
        body: JSON.stringify({ from, to: [job.recipient], subject: job.subject || 'Re: Your enquiry', text: job.body }),
        signal: AbortSignal.timeout(15000),
      });
      const payload = await response.json().catch(() => ({})) as { id?: string; message?: string; name?: string };
      if (!response.ok || !payload.id) {
        const detail = payload.message || payload.name || 'Email provider returned HTTP ' + response.status;
        await this.failEmailDelivery(job, detail, response.status >= 400 && response.status < 500 && response.status !== 429); return;
      }
      await this.db.query("UPDATE messages SET delivery_status='sent',provider_message_id=$2,delivery_started_at=NULL,delivery_next_attempt_at=NULL,delivery_error=NULL WHERE id=$1 AND delivery_status='sending'", [job.id, payload.id]);
    } catch (error) { await this.failEmailDelivery(job, error instanceof Error ? error.message : 'Unknown email delivery error', false); }
  }

  private async failEmailDelivery(job: EmailDeliveryJob, reason: string, permanent: boolean): Promise<void> {
    const terminal = permanent || job.attempts >= 5;
    const delaySeconds = Math.min(1800, 30 * (2 ** Math.max(0, job.attempts - 1)));
    await this.db.query("UPDATE messages SET delivery_status=$2,delivery_started_at=NULL,delivery_next_attempt_at=CASE WHEN $2='queued' THEN now()+($3*interval '1 second') ELSE NULL END,delivery_error=$4 WHERE id=$1 AND delivery_status='sending'", [job.id, terminal ? 'failed' : 'queued', delaySeconds, reason.slice(0, 1000)]);
    if (terminal) this.logger.warn('Email delivery permanently failed for message ' + job.id + ': ' + reason);
  }


  private async claimInstagramDelivery():Promise<InstagramDeliveryJob|null>{
    return this.claimSocialDelivery<InstagramDeliveryJob>('instagram',this.config.get('INSTAGRAM_AGENCY_ID'),true);
  }
  private async claimTikTokDelivery():Promise<TikTokDeliveryJob|null>{
    return this.claimSocialDelivery<TikTokDeliveryJob>('tiktok',this.config.get('TIKTOK_AGENCY_ID'));
  }
  private async claimSocialDelivery<T extends MessageJob>(channel:string,agencyId:string|undefined,allowDbConnection=false):Promise<T|null>{
    if(!agencyId&&!allowDbConnection)return null;
    return this.db.transaction(async client=>{
      await client.query("UPDATE messages SET delivery_status='failed',delivery_started_at=NULL,delivery_error='Social delivery lease expired after final attempt' WHERE direction='outbound' AND delivery_status='sending' AND delivery_started_at < now()-interval '5 minutes' AND delivery_attempts>=5 AND agency_id=$1",[agencyId]);
      const result=await client.query<T>("SELECT m.id,m.agency_id AS \"agencyId\",m.conversation_id AS \"conversationId\",m.body,cv.customer_contact AS recipient,cv.channel_connection_id AS \"connectionId\",m.delivery_attempts AS attempts FROM messages m JOIN conversations cv ON cv.id=m.conversation_id AND cv.agency_id=m.agency_id WHERE m.direction='outbound' AND ((cv.channel_connection_id IS NOT NULL AND $3::boolean=true) OR ($1::uuid IS NOT NULL AND cv.agency_id=$1)) AND cv.channel=$2 AND cv.customer_contact IS NOT NULL AND m.delivery_attempts<5 AND ((m.delivery_status='queued' AND (m.delivery_next_attempt_at IS NULL OR m.delivery_next_attempt_at<=now())) OR (m.delivery_status='sending' AND m.delivery_started_at < now()-interval '5 minutes')) ORDER BY m.created_at LIMIT 1 FOR UPDATE OF m SKIP LOCKED",[agencyId||null,channel,allowDbConnection]);
      const job=result.rows[0];if(!job)return null;const attempts=Number(job.attempts)+1;
      await client.query("UPDATE messages SET delivery_status='sending',delivery_started_at=now(),delivery_attempts=$2,delivery_error=NULL WHERE id=$1",[job.id,attempts]);
      return {...job,attempts};
    });
  }
  private async deliverInstagram(job:InstagramDeliveryJob):Promise<void>{
    const connection=job.connectionId?await this.vault.getForTenantConnection(job.agencyId,job.connectionId,true):null;
    if(job.connectionId&&!connection){await this.failSocialDelivery(job,'The linked Instagram connection is no longer active.',true);return;}
    const token=connection?.credentials.accessToken||this.config.get('INSTAGRAM_ACCESS_TOKEN');
    const account=connection?.externalAccountId||this.config.get('INSTAGRAM_ACCOUNT_ID');const version=this.config.get('INSTAGRAM_API_VERSION');
    if(!token||!account)return;if(job.body.length>1000){await this.failSocialDelivery(job,'Instagram text reply exceeds 1,000 characters.',true);return;}
    try{
      const response=await fetch('https://graph.instagram.com/'+version+'/'+account+'/messages',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({recipient:{id:job.recipient},message:{text:job.body}}),signal:AbortSignal.timeout(15000)});
      const data=await response.json().catch(()=>({})) as {message_id?:string;id?:string;error?:{message?:string}};
      const id=data.message_id||data.id;
      if(!response.ok||!id){await this.failSocialDelivery(job,data.error?.message||'Instagram Graph API HTTP '+response.status,response.status>=400&&response.status<500&&response.status!==429);return;}
      await this.db.query("UPDATE messages SET delivery_status='sent',provider_message_id=$2,delivery_started_at=NULL,delivery_next_attempt_at=NULL,delivery_error=NULL WHERE id=$1 AND delivery_status='sending'",[job.id,id]);
    }catch(error){await this.failSocialDelivery(job,error instanceof Error?error.message:'Unknown Instagram delivery error',false);}
  }
  private async deliverTikTok(job:TikTokDeliveryJob):Promise<void>{
    const token=this.config.get('TIKTOK_ACCESS_TOKEN');const business=this.config.get('TIKTOK_BUSINESS_ID');
    if(!token||!business)return;if(job.body.length>6000){await this.failSocialDelivery(job,'TikTok text reply exceeds 6,000 characters.',true);return;}
    try{
      const response=await fetch('https://business-api.tiktok.com/open_api/v1.3/business/message/send/',{method:'POST',headers:{'Access-Token':token,'Content-Type':'application/json'},body:JSON.stringify({business_id:business,recipient_type:'CONVERSATION',recipient:job.recipient,message_type:'TEXT',text:{body:job.body}}),signal:AbortSignal.timeout(15000)});
      const data=await response.json().catch(()=>({})) as {code?:number;message?:string;data?:{message_id?:string}};
      const id=data.data?.message_id;
      if(!response.ok||data.code!==0||!id){const permanent=response.status>=400&&response.status<500&&response.status!==429||[40001,40002,40007,40064,40105].includes(Number(data.code));await this.failSocialDelivery(job,data.message||'TikTok Business Messaging API HTTP '+response.status+' code '+data.code,permanent);return;}
      await this.db.query("UPDATE messages SET delivery_status='sent',provider_message_id=$2,delivery_started_at=NULL,delivery_next_attempt_at=NULL,delivery_error=NULL WHERE id=$1 AND delivery_status='sending'",[job.id,id]);
    }catch(error){await this.failSocialDelivery(job,error instanceof Error?error.message:'Unknown TikTok delivery error',false);}
  }
  private async failSocialDelivery(job:MessageJob,reason:string,permanent:boolean):Promise<void>{
    const terminal=permanent||job.attempts>=5;const delay=Math.min(1800,30*(2**Math.max(0,job.attempts-1)));
    await this.db.query("UPDATE messages SET delivery_status=$2,delivery_started_at=NULL,delivery_next_attempt_at=CASE WHEN $2='queued' THEN now()+($3*interval '1 second') ELSE NULL END,delivery_error=$4 WHERE id=$1 AND delivery_status='sending'",[job.id,terminal?'failed':'queued',delay,reason.slice(0,1000)]);
    if(terminal)this.logger.warn('Social message permanently failed for '+job.id+': '+reason);
  }

  private async claimWhatsAppDelivery(): Promise<WhatsAppDeliveryJob | null> {
    return this.db.transaction(async client => {
      await client.query("UPDATE messages SET delivery_status='failed',delivery_started_at=NULL,delivery_error='Delivery worker lease expired after final attempt' WHERE direction='outbound' AND delivery_status='sending' AND delivery_started_at < now()-interval '5 minutes' AND delivery_attempts>=5");
      const result = await client.query<WhatsAppDeliveryJob>("SELECT m.id,m.agency_id AS \"agencyId\",m.conversation_id AS \"conversationId\",m.body,cv.customer_contact AS recipient,cv.channel_connection_id AS \"connectionId\",m.delivery_attempts AS attempts FROM messages m JOIN conversations cv ON cv.id=m.conversation_id AND cv.agency_id=m.agency_id WHERE m.direction='outbound' AND (cv.channel_connection_id IS NOT NULL OR ($1::uuid IS NOT NULL AND cv.agency_id=$1)) AND cv.channel='whatsapp' AND cv.customer_contact IS NOT NULL AND m.delivery_attempts<5 AND ((m.delivery_status='queued' AND (m.delivery_next_attempt_at IS NULL OR m.delivery_next_attempt_at<=now())) OR (m.delivery_status='sending' AND m.delivery_started_at < now()-interval '5 minutes')) ORDER BY m.created_at LIMIT 1 FOR UPDATE OF m SKIP LOCKED", [this.config.get('WHATSAPP_AGENCY_ID')||null]);
      const job = result.rows[0];
      if (!job) return null;
      const attempts = Number(job.attempts) + 1;
      await client.query("UPDATE messages SET delivery_status='sending',delivery_started_at=now(),delivery_attempts=$2,delivery_error=NULL WHERE id=$1", [job.id, attempts]);
      return { ...job, attempts };
    });
  }

  private async deliverWhatsApp(job: WhatsAppDeliveryJob): Promise<void> {
    const connection=job.connectionId?await this.vault.getForTenantConnection(job.agencyId,job.connectionId,true):null;
    if(job.connectionId&&!connection){await this.failWhatsAppDelivery(job,'The linked WhatsApp connection is no longer active.',true);return;}
    const token=connection?.credentials.accessToken||this.config.get('WHATSAPP_ACCESS_TOKEN');
    const phoneNumberId=connection?.externalPhoneNumberId||this.config.get('WHATSAPP_PHONE_NUMBER_ID');
    const apiVersion=this.config.get('WHATSAPP_API_VERSION');
    if(!token||!phoneNumberId)return;
    if (job.body.length > 4096) {
      await this.failWhatsAppDelivery(job, 'WhatsApp text messages cannot exceed 4096 characters.', true);
      return;
    }
    try {
      const response = await fetch('https://graph.facebook.com/' + apiVersion + '/' + phoneNumberId + '/messages', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to: job.recipient, type: 'text', text: { preview_url: false, body: job.body }, biz_opaque_callback_data: job.id }),
        signal: AbortSignal.timeout(15000),
      });
      const payload = await response.json().catch(() => ({})) as { messages?: Array<{ id?: string }>; error?: { message?: string } };
      const providerMessageId = payload.messages?.[0]?.id;
      if (!response.ok || !providerMessageId) {
        const detail = payload.error?.message || 'Meta Graph API returned HTTP ' + response.status;
        await this.failWhatsAppDelivery(job, detail, response.status >= 400 && response.status < 500 && response.status !== 429);
        return;
      }
      await this.db.query("UPDATE messages SET delivery_status='sent',provider_message_id=$2,delivery_started_at=NULL,delivery_next_attempt_at=NULL,delivery_error=NULL WHERE id=$1 AND delivery_status='sending'", [job.id, providerMessageId]);
    } catch (error) {
      await this.failWhatsAppDelivery(job, error instanceof Error ? error.message : 'Unknown WhatsApp delivery error', false);
    }
  }

  private async failWhatsAppDelivery(job: WhatsAppDeliveryJob, reason: string, permanent: boolean): Promise<void> {
    const terminal = permanent || job.attempts >= 5;
    const delaySeconds = Math.min(1800, 30 * (2 ** Math.max(0, job.attempts - 1)));
    await this.db.query("UPDATE messages SET delivery_status=$2,delivery_started_at=NULL,delivery_next_attempt_at=CASE WHEN $2='queued' THEN now()+($3*interval '1 second') ELSE NULL END,delivery_error=$4 WHERE id=$1 AND delivery_status='sending'", [job.id, terminal ? 'failed' : 'queued', delaySeconds, reason.slice(0, 1000)]);
    if (terminal) this.logger.warn('WhatsApp delivery permanently failed for message ' + job.id + ': ' + reason);
  }
}
