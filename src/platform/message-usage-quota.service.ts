import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { recordBlockedSubscriptionAction } from './blocked-subscription-action';

export type MessageQuotaReservation = { allowed: boolean; reason?: string; subscriptionId?: string };

@Injectable()
export class MessageUsageQuotaService {
  constructor(private readonly db: DatabaseService) {}

  async reserve(agencyId: string, metric: 'message_in' | 'message_out', idempotencyKey: string): Promise<MessageQuotaReservation> {
    const outcome = await this.db.transaction(async client => {
      const result = await client.query<any>(`SELECT cs.id,cs.current_period_start AS "periodStart",
          cs.current_period_end AS "periodEnd",p.included_messages AS "includedMessages",
          p.overage_message_price_minor AS "overageMessagePriceMinor"
        FROM company_subscriptions cs JOIN subscription_plans p ON p.id=cs.plan_id
        WHERE cs.agency_id=$1 AND cs.status IN ('active','trialing','past_due')
          AND cs.current_period_start<=now() AND cs.current_period_end>now()
          AND (cs.status<>'trialing' OR cs.trial_ends_at IS NULL OR cs.trial_ends_at>now())
        ORDER BY cs.created_at DESC LIMIT 1 FOR UPDATE OF cs`, [agencyId]);
      const sub = result.rows[0];
      if (!sub) return { allowed: false, reason: 'No active subscription is available for messaging.' };

      const existing = await client.query<any>(`SELECT status,expires_at AS "expiresAt"
        FROM message_usage_reservations WHERE agency_id=$1 AND idempotency_key=$2 FOR UPDATE`,
        [agencyId, idempotencyKey]);
      if (existing.rows[0]?.status === 'consumed') return { allowed: true, subscriptionId: sub.id };
      if (existing.rows[0]?.status === 'reserved' && new Date(existing.rows[0].expiresAt).getTime() > Date.now()) {
        return { allowed: true, subscriptionId: sub.id };
      }
      if (existing.rows[0]?.status === 'reserved') {
        await client.query("UPDATE message_usage_reservations SET status='expired',updated_at=now() WHERE agency_id=$1 AND idempotency_key=$2", [agencyId, idempotencyKey]);
      }

      const usage = await client.query<any>(`SELECT
        COALESCE((SELECT sum(quantity) FROM usage_records WHERE subscription_id=$1
          AND metric IN ('message_in','message_out') AND occurred_at >= $2 AND occurred_at < $3),0)::bigint AS consumed,
        COALESCE((SELECT count(*) FROM message_usage_reservations WHERE subscription_id=$1
          AND status='reserved' AND expires_at>now()),0)::bigint AS reserved`,
        [sub.id, sub.periodStart, sub.periodEnd]);
      const used = BigInt(usage.rows[0].consumed || '0') + BigInt(usage.rows[0].reserved || '0');
      if (used >= BigInt(sub.includedMessages || 0) && BigInt(sub.overageMessagePriceMinor || 0) <= 0n) {
        return { allowed: false, reason: 'The included message allowance for this subscription period has been reached.', subscriptionId: sub.id };
      }

      await client.query(`INSERT INTO message_usage_reservations(agency_id,subscription_id,metric,idempotency_key,status,expires_at)
        VALUES($1,$2,$3,$4,'reserved',now()+interval '15 minutes')
        ON CONFLICT(agency_id,idempotency_key) DO UPDATE SET subscription_id=EXCLUDED.subscription_id,
          metric=EXCLUDED.metric,status='reserved',expires_at=EXCLUDED.expires_at,updated_at=now()`,
        [agencyId, sub.id, metric, idempotencyKey]);
      return { allowed: true, subscriptionId: sub.id };
    });
    if (!outcome.allowed) await recordBlockedSubscriptionAction(this.db, agencyId, metric, outcome.reason || 'Message quota denied.', outcome.subscriptionId);
    return outcome;
  }

  async consume(agencyId: string, idempotencyKey: string): Promise<void> {
    await this.db.transaction(async client => {
      const result = await client.query<any>(`SELECT subscription_id AS "subscriptionId",metric,status
        FROM message_usage_reservations WHERE agency_id=$1 AND idempotency_key=$2 FOR UPDATE`,
        [agencyId, idempotencyKey]);
      const reservation = result.rows[0];
      if (!reservation || reservation.status === 'consumed' || reservation.status !== 'reserved') return;
      await client.query(`INSERT INTO usage_records(agency_id,subscription_id,metric,quantity,idempotency_key,metadata)
        VALUES($1,$2,$3,1,$4,'{"meter":"subscription_quota"}'::jsonb)
        ON CONFLICT(agency_id,idempotency_key) DO NOTHING`,
        [agencyId, reservation.subscriptionId, reservation.metric, idempotencyKey]);
      await client.query("UPDATE message_usage_reservations SET status='consumed',updated_at=now() WHERE agency_id=$1 AND idempotency_key=$2",
        [agencyId, idempotencyKey]);
    });
  }

  async release(agencyId: string, idempotencyKey: string): Promise<void> {
    await this.db.query("UPDATE message_usage_reservations SET status='released',updated_at=now() WHERE agency_id=$1 AND idempotency_key=$2 AND status='reserved'", [agencyId, idempotencyKey]);
  }
}
