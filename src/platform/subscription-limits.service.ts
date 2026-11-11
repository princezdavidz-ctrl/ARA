import { ForbiddenException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { recordBlockedSubscriptionAction } from './blocked-subscription-action';

@Injectable()
export class SubscriptionLimitsService {
  constructor(private readonly db: DatabaseService) {}

  async assertSeatAvailable(client: any, agencyId: string): Promise<void> {
    const subscription = await client.query(`SELECT cs.id,p.max_seats AS "maxSeats"
      FROM company_subscriptions cs JOIN subscription_plans p ON p.id=cs.plan_id
      WHERE cs.agency_id=$1 AND cs.status IN ('active','trialing','past_due')
        AND cs.current_period_start<=now() AND cs.current_period_end>now()
        AND (cs.status<>'trialing' OR cs.trial_ends_at IS NULL OR cs.trial_ends_at>now())
      ORDER BY cs.created_at DESC LIMIT 1 FOR UPDATE OF cs`, [agencyId]);
    const plan = subscription.rows[0];
    if (!plan) {
      const reason = 'An active subscription is required to add team members.';
      await recordBlockedSubscriptionAction(this.db, agencyId, 'seat', reason);
      throw new ForbiddenException(reason);
    }
    const count = await client.query('SELECT count(*)::int AS total FROM agency_users WHERE agency_id=$1 AND is_active=true', [agencyId]);
    if (Number(count.rows[0]?.total || 0) >= Number(plan.maxSeats)) {
      const reason = 'Your subscription seat limit has been reached. Upgrade your plan or deactivate an existing team member.';
      await recordBlockedSubscriptionAction(this.db, agencyId, 'seat', reason, plan.id);
      throw new ForbiddenException(reason);
    }
  }

  async assertChannelAvailable(client: any, agencyId: string): Promise<void> {
    const subscription = await client.query(`SELECT cs.id,p.max_channels AS "maxChannels"
      FROM company_subscriptions cs JOIN subscription_plans p ON p.id=cs.plan_id
      WHERE cs.agency_id=$1 AND cs.status IN ('active','trialing','past_due')
        AND cs.current_period_start<=now() AND cs.current_period_end>now()
        AND (cs.status<>'trialing' OR cs.trial_ends_at IS NULL OR cs.trial_ends_at>now())
      ORDER BY cs.created_at DESC LIMIT 1 FOR UPDATE OF cs`, [agencyId]);
    const plan = subscription.rows[0];
    if (!plan) {
      const reason = 'An active subscription is required to connect channels.';
      await recordBlockedSubscriptionAction(this.db, agencyId, 'channel', reason);
      throw new ForbiddenException(reason);
    }
    const count = await client.query("SELECT count(*)::int AS total FROM channel_connections WHERE agency_id=$1 AND status<>'disabled'", [agencyId]);
    if (Number(count.rows[0]?.total || 0) >= Number(plan.maxChannels)) {
      const reason = 'Your subscription channel limit has been reached. Upgrade your plan or disable an existing channel.';
      await recordBlockedSubscriptionAction(this.db, agencyId, 'channel', reason, plan.id);
      throw new ForbiddenException(reason);
    }
  }
}
