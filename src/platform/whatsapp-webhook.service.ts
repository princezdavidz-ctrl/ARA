import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { ConfigService } from '../config/config.service';
import { ChannelCredentialVault } from './channel-credential-vault.service';

@Injectable()
export class WhatsAppWebhookService {
  constructor(private readonly db: DatabaseService, private readonly config: ConfigService, private readonly vault: ChannelCredentialVault) {}

  async verifySubscription(mode: string, token: string, challenge: string): Promise<string> {
    const expected = this.config.get('WHATSAPP_VERIFY_TOKEN');
    const a = Buffer.from(token || '');
    const b = Buffer.from(expected || '');
    const legacyValid = Boolean(expected && a.length === b.length && timingSafeEqual(a, b));
    const tenantConnection = !legacyValid && token ? await this.vault.findByVerifyToken('whatsapp', token) : null;
    if (mode !== 'subscribe' || (!legacyValid && !tenantConnection) || !challenge) {
      throw new UnauthorizedException('WhatsApp webhook verification failed');
    }
    return challenge;
  }

  async receive(rawBody: Buffer | undefined, signature: string | undefined, payload: any): Promise<{ received: boolean; accepted: number }> {
    const appSecret = this.config.get('WHATSAPP_APP_SECRET');
    const legacyAgencyId = this.config.get('WHATSAPP_AGENCY_ID');
    const legacyPhoneNumberId = this.config.get('WHATSAPP_PHONE_NUMBER_ID');
    if (!appSecret) throw new ServiceUnavailableException('WhatsApp Meta app signature secret is not configured');
    if (!rawBody || !signature || !/^sha256=[a-f0-9]{64}$/i.test(signature)) {
      throw new UnauthorizedException('Missing or invalid webhook signature');
    }
    const expected = createHmac('sha256', appSecret).update(rawBody).digest();
    const supplied = Buffer.from(signature.slice(7), 'hex');
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
      throw new UnauthorizedException('Invalid WhatsApp webhook signature');
    }
    if (payload?.object !== 'whatsapp_business_account' || !Array.isArray(payload.entry)) {
      return { received: true, accepted: 0 };
    }

    let accepted = 0;
    for (const entry of payload.entry) {
      for (const change of entry?.changes || []) {
        const value = change?.value;
        if (change?.field !== 'messages') continue;
        const phoneNumberId = String(value?.metadata?.phone_number_id || '');
        const connection = await this.vault.findByProviderAccount('whatsapp', String(entry?.id || ''), phoneNumberId);
        const agencyId = connection?.agencyId || (legacyAgencyId && legacyPhoneNumberId === phoneNumberId ? legacyAgencyId : undefined);
        if (!agencyId) continue;
        const contacts = new Map<string, string>();
        for (const contact of value.contacts || []) {
          if (contact.wa_id) contacts.set(String(contact.wa_id), String(contact.profile?.name || ''));
        }
        for (const message of value.messages || []) {
          const from = String(message?.from || '');
          const messageId = String(message?.id || '');
          if (!from || !messageId) continue;
          const type = String(message?.type || 'unknown');
          const body = type === 'text'
            ? String(message?.text?.body || '').trim()
            : `[Customer sent a WhatsApp ${type} message. Human review is required to inspect this content.]`;
          if (!body) continue;
          const inserted = await this.db.transaction(async client => {
            const found = await client.query(
              `SELECT id FROM conversations
               WHERE agency_id = $1 AND channel = 'whatsapp' AND customer_contact = $2 AND status <> 'closed'
               ORDER BY updated_at DESC LIMIT 1 FOR UPDATE`,
              [agencyId, from],
            );
            let conversationId = found.rows[0]?.id;
            if (!conversationId) {
              const created = await client.query(
                `INSERT INTO conversations(agency_id, channel, customer_name, customer_contact)
                 VALUES($1, 'whatsapp', $2, $3) RETURNING id`,
                [agencyId, contacts.get(from) || null, from],
              );
              conversationId = created.rows[0].id;
            }
            const isText = type === 'text';
            const result = await client.query(
              `INSERT INTO messages(agency_id, conversation_id, direction, sender_type, body,
                  idempotency_key, delivery_status, processing_status)
               VALUES($1, $2, 'inbound', 'customer', $3, $4, 'stored', $5)
               ON CONFLICT(agency_id, idempotency_key) DO NOTHING
               RETURNING id`,
              [agencyId, conversationId, body, 'whatsapp:' + messageId, isText ? 'pending' : 'not_applicable'],
            );
            if (result.rowCount) {
              await client.query('UPDATE conversations SET updated_at = now() WHERE id = $1 AND agency_id = $2', [conversationId, agencyId]);
              if (!isText) {
                await client.query(
                  `INSERT INTO escalations(agency_id, conversation_id, reason)
                   SELECT $1, $2, $3 WHERE NOT EXISTS (
                     SELECT 1 FROM escalations WHERE agency_id = $1 AND conversation_id = $2 AND status IN ('open','claimed')
                   )`,
                  [agencyId, conversationId, `WhatsApp ${type} message requires human review`],
                );
                await client.query("UPDATE conversations SET status = 'pending' WHERE id = $1 AND agency_id = $2", [conversationId, agencyId]);
              }
            }
            return Boolean(result.rowCount);
          });
          if (inserted) accepted++;
        }
      }
    }
    return { received: true, accepted };
  }
}
