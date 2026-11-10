import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { ConfigService } from '../config/config.service';
import { ChannelCredentialVault } from './channel-credential-vault.service';

@Injectable()
export class EmailWebhookService {
  constructor(private readonly db: DatabaseService, private readonly config: ConfigService, private readonly vault: ChannelCredentialVault) {}

  async receive(rawBody: Buffer | undefined, timestamp: string | undefined, signature: string | undefined, payload: any) {
    const recipientValue = payload?.to?.email || payload?.to?.[0]?.email || payload?.to?.[0] || payload?.to || payload?.recipient || payload?.delivered_to || '';
    const recipient = String(recipientValue).trim().toLowerCase();
    const connection = recipient ? await this.vault.findByProviderAccount('email', recipient) : null;
    const secret = connection?.credentials.webhookSecret || (!connection ? this.config.get('EMAIL_WEBHOOK_SECRET') : undefined);
    const agencyId = connection?.agencyId || (!connection ? this.config.get('EMAIL_AGENCY_ID') : undefined);
    if (!secret || !agencyId) throw new ServiceUnavailableException('Email channel is not configured for this recipient');
    if (!rawBody || !timestamp || !signature || !/^\d{10}$/.test(timestamp) || !/^sha256=[a-f0-9]{64}$/i.test(signature)) {
      throw new UnauthorizedException('Missing or invalid email webhook signature');
    }
    const seconds = Number(timestamp);
    if (!Number.isSafeInteger(seconds) || Math.abs(Date.now() / 1000 - seconds) > 300) {
      throw new UnauthorizedException('Email webhook timestamp is outside the allowed window');
    }
    const expected = createHmac('sha256', secret).update(timestamp + '.').update(rawBody).digest();
    const supplied = Buffer.from(signature.slice(7), 'hex');
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
      throw new UnauthorizedException('Invalid email webhook signature');
    }
    const from = String(payload?.from?.email || payload?.from || '').trim().toLowerCase();
    const name = String(payload?.from?.name || payload?.senderName || '').trim();
    const subject = String(payload?.subject || '(no subject)').trim().slice(0, 500);
    const body = String(payload?.text || payload?.body || '').trim();
    const messageId = String(payload?.messageId || payload?.message_id || '').trim();
    if (!/^\S+@\S+\.\S+$/.test(from) || !body || body.length > 50000 || !messageId) {
      throw new UnauthorizedException('Email webhook payload is incomplete or invalid');
    }
    const result = await this.db.transaction(async client => {
      const found = await client.query(
        "SELECT id FROM conversations WHERE agency_id=$1 AND channel='email' AND channel_connection_id IS NOT DISTINCT FROM $2::uuid AND lower(customer_contact)=lower($3) AND status<>'closed' ORDER BY updated_at DESC LIMIT 1 FOR UPDATE",
        [agencyId, connection?.id || null, from],
      );
      let conversationId = found.rows[0]?.id;
      if (!conversationId) {
        const created = await client.query(
          "INSERT INTO conversations(agency_id,channel,channel_connection_id,customer_name,customer_contact) VALUES($1,'email',$2,$3,$4) RETURNING id",
          [agencyId, connection?.id || null, name || null, from],
        );
        conversationId = created.rows[0].id;
      }
      const inserted = await client.query(
        "INSERT INTO messages(agency_id,conversation_id,direction,sender_type,body,subject,idempotency_key,delivery_status,processing_status) VALUES($1,$2,'inbound','customer',$3,$4,$5,'stored','pending') ON CONFLICT(agency_id,idempotency_key) DO NOTHING RETURNING id",
        [agencyId, conversationId, body, subject, 'email:' + messageId],
      );
      if (inserted.rowCount) await client.query('UPDATE conversations SET updated_at=now() WHERE id=$1 AND agency_id=$2', [conversationId, agencyId]);
      return { accepted: Boolean(inserted.rowCount), conversationId };
    });
    return { received: true, ...result };
  }
}
