import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { recordBlockedSubscriptionAction } from '../platform/blocked-subscription-action';

export type AiQuotaReservation = { allowed: boolean; reason?: string; subscriptionId?: string };

@Injectable()
export class AiUsageQuotaService {
  constructor(private readonly db: DatabaseService) {}

  async reserve(agencyId: string, idempotencyKey: string): Promise<AiQuotaReservation> {
    const outcome = await this.db.transaction(async client => {
      const subscription = await client.query<any>(`SELECT cs.id,cs.status,cs.current_period_start AS "periodStart",
          cs.current_period_end AS "periodEnd",p.included_ai_responses AS "includedAiResponses",
          p.overage_ai_price_minor AS "overageAiPriceMinor"
        FROM company_subscriptions cs JOIN subscription_plans p ON p.id=cs.plan_id
        WHERE cs.agency_id=$1 AND cs.status IN ('active','trialing','past_due')
          AND cs.current_period_start<=now() AND cs.current_period_end>now()
          AND (cs.status<>'trialing' OR cs.trial_ends_at IS NULL OR cs.trial_ends_at>now())
        ORDER BY cs.created_at DESC LIMIT 1 FOR UPDATE OF cs`, [agencyId]);
      const sub = subscription.rows[0];
      if (!sub) return { allowed: false, reason: 'No active subscription is available for AI responses.' };

      const existing = await client.query<any>(`SELECT status,expires_at AS "expiresAt"
        FROM ai_usage_reservations WHERE agency_id=$1 AND idempotency_key=$2 FOR UPDATE`,
        [agencyId, idempotencyKey]);
      if (existing.rows[0]?.status === 'consumed') return { allowed: true, subscriptionId: sub.id };
      if (existing.rows[0]?.status === 'reserved' && new Date(existing.rows[0].expiresAt).getTime() > Date.now()) {
        return { allowed: true, subscriptionId: sub.id };
      }
      if (existing.rows[0]?.status === 'reserved') {
        await client.query("UPDATE ai_usage_reservations SET status='expired',updated_at=now() WHERE agency_id=$1 AND idempotency_key=$2",
          [agencyId, idempotencyKey]);
      }

      const usage = await client.query<any>(`SELECT
        COALESCE((SELECT sum(quantity) FROM usage_records WHERE subscription_id=$1 AND metric='ai_response'
          AND occurred_at >= $2 AND occurred_at < $3),0)::bigint AS consumed,
        COALESCE((SELECT count(*) FROM ai_usage_reservations WHERE subscription_id=$1 AND status='reserved'
          AND expires_at>now()),0)::bigint AS reserved`,
        [sub.id, sub.periodStart, sub.periodEnd]);
      const used = BigInt(usage.rows[0].consumed || '0') + BigInt(usage.rows[0].reserved || '0');
      const included = BigInt(sub.includedAiResponses || 0);
      const overagePrice = BigInt(sub.overageAiPriceMinor || 0);
      if (used >= included && overagePrice <= 0n) {
        return { allowed: false, reason: 'The AI response allowance for this subscription period has been reached.' };
      }

      await client.query(`INSERT INTO ai_usage_reservations(agency_id,subscription_id,idempotency_key,status,expires_at)
        VALUES($1,$2,$3,'reserved',now()+interval '15 minutes')
        ON CONFLICT(agency_id,idempotency_key) DO UPDATE SET subscription_id=EXCLUDED.subscription_id,
          status='reserved',expires_at=EXCLUDED.expires_at,updated_at=now()`,
        [agencyId, sub.id, idempotencyKey]);
      return { allowed: true, subscriptionId: sub.id };
    });
    if (!outcome.allowed) await recordBlockedSubscriptionAction(this.db, agencyId, 'ai_response', outcome.reason || 'AI response quota denied.', outcome.subscriptionId);
    return outcome;
  }

  async consume(agencyId: string, idempotencyKey: string): Promise<void> {
    await this.db.transaction(async client => {
      const result = await client.query<any>(`SELECT subscription_id AS "subscriptionId",status
        FROM ai_usage_reservations WHERE agency_id=$1 AND idempotency_key=$2 FOR UPDATE`,
        [agencyId, idempotencyKey]);
      const reservation = result.rows[0];
      if (!reservation || reservation.status === 'consumed') return;
      if (reservation.status !== 'reserved') return;
      await client.query(`INSERT INTO usage_records(agency_id,subscription_id,metric,quantity,idempotency_key,metadata)
        VALUES($1,$2,'ai_response',1,$3,'{"meter":"subscription_quota"}'::jsonb)
        ON CONFLICT(agency_id,idempotency_key) DO NOTHING`,
        [agencyId, reservation.subscriptionId, idempotencyKey]);
      await client.query("UPDATE ai_usage_reservations SET status='consumed',updated_at=now() WHERE agency_id=$1 AND idempotency_key=$2",
        [agencyId, idempotencyKey]);
    });
  }

  async release(agencyId: string, idempotencyKey: string): Promise<void> {
    await this.db.query("UPDATE ai_usage_reservations SET status='released',updated_at=now() WHERE agency_id=$1 AND idempotency_key=$2 AND status='reserved'",
      [agencyId, idempotencyKey]);
  }
}
