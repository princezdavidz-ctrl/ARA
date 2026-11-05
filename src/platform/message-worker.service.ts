import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AnswerService } from '../rag/answer.service';
import { AnswerInput } from '../rag/contracts';
import { ConfigService } from '../config/config.service';

interface MessageJob { id: string; agencyId: string; conversationId: string; body: string; attempts: number; }
interface WhatsAppDeliveryJob extends MessageJob { recipient: string; }

@Injectable()
export class MessageWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MessageWorker.name);
  private timer: ReturnType<typeof setInterval> | undefined;
  private running = false;

  constructor(private readonly db: DatabaseService, private readonly answers: AnswerService, private readonly config: ConfigService) {}
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
      if (this.config.get('WHATSAPP_ACCESS_TOKEN') && this.config.get('WHATSAPP_PHONE_NUMBER_ID') && this.config.get('WHATSAPP_AGENCY_ID')) {
        for (let i = 0; i < 5; i++) {
          const job = await this.claimWhatsAppDelivery();
          if (!job) break;
          await this.deliverWhatsApp(job);
        }
      }
    } catch (error) {
      this.logger.error('Message worker cycle failed', error instanceof Error ? error.stack : undefined);
    } finally { this.running = false; }
  }

  private async claimInbound(): Promise<MessageJob | null> {
    return this.db.transaction(async client => {
      const result = await client.query<MessageJob>("SELECT m.id, m.agency_id AS \"agencyId\", m.conversation_id AS \"conversationId\", m.body, m.processing_attempts AS attempts FROM messages m JOIN conversations cv ON cv.id=m.conversation_id AND cv.agency_id=m.agency_id WHERE m.direction='inbound' AND (m.processing_status='pending' OR (m.processing_status='processing' AND m.processing_started_at < now()-interval '5 minutes')) ORDER BY m.created_at LIMIT 1 FOR UPDATE OF m SKIP LOCKED");
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
        await client.query("INSERT INTO messages(agency_id,conversation_id,direction,sender_type,body,idempotency_key,delivery_status,processing_status) VALUES($1,$2,'outbound','ai',$3,$4,'queued','not_applicable') ON CONFLICT(agency_id,idempotency_key) DO NOTHING", [job.agencyId, job.conversationId, result.answer, 'ai:' + job.id]);
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

  private async claimWhatsAppDelivery(): Promise<WhatsAppDeliveryJob | null> {
    return this.db.transaction(async client => {
      await client.query("UPDATE messages SET delivery_status='failed',delivery_started_at=NULL,delivery_error='Delivery worker lease expired after final attempt' WHERE direction='outbound' AND delivery_status='sending' AND delivery_started_at < now()-interval '5 minutes' AND delivery_attempts>=5");
      const result = await client.query<WhatsAppDeliveryJob>("SELECT m.id,m.agency_id AS \"agencyId\",m.conversation_id AS \"conversationId\",m.body,cv.customer_contact AS recipient,m.delivery_attempts AS attempts FROM messages m JOIN conversations cv ON cv.id=m.conversation_id AND cv.agency_id=m.agency_id WHERE m.direction='outbound' AND cv.agency_id=$1 AND cv.channel='whatsapp' AND cv.customer_contact IS NOT NULL AND m.delivery_attempts<5 AND ((m.delivery_status='queued' AND (m.delivery_next_attempt_at IS NULL OR m.delivery_next_attempt_at<=now())) OR (m.delivery_status='sending' AND m.delivery_started_at < now()-interval '5 minutes')) ORDER BY m.created_at LIMIT 1 FOR UPDATE OF m SKIP LOCKED", [this.config.get('WHATSAPP_AGENCY_ID')]);
      const job = result.rows[0];
      if (!job) return null;
      const attempts = Number(job.attempts) + 1;
      await client.query("UPDATE messages SET delivery_status='sending',delivery_started_at=now(),delivery_attempts=$2,delivery_error=NULL WHERE id=$1", [job.id, attempts]);
      return { ...job, attempts };
    });
  }

  private async deliverWhatsApp(job: WhatsAppDeliveryJob): Promise<void> {
    const token = this.config.get('WHATSAPP_ACCESS_TOKEN');
    const phoneNumberId = this.config.get('WHATSAPP_PHONE_NUMBER_ID');
    const apiVersion = this.config.get('WHATSAPP_API_VERSION');
    if (!token || !phoneNumberId) return;
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
