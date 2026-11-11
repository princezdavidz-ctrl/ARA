import { DatabaseService } from '../database/database.service';

export type BlockedSubscriptionAction = 'message_in' | 'message_out' | 'ai_response' | 'seat' | 'channel';

/**
 * Persist a quota denial without recording message content, prompts, credentials,
 * customer identifiers, or other request payload data. Failure to record analytics
 * must never change the enforcement decision.
 */
export async function recordBlockedSubscriptionAction(
  db: DatabaseService,
  agencyId: string,
  actionType: BlockedSubscriptionAction,
  reason: string,
  subscriptionId?: string,
): Promise<void> {
  try {
    await db.query(
      `INSERT INTO subscription_blocked_actions(agency_id, subscription_id, action_type, reason)
       VALUES ($1, $2, $3, $4)`,
      [agencyId, subscriptionId || null, actionType, String(reason).slice(0, 500)],
    );
  } catch {
    // Analytics are best-effort; quota enforcement must remain authoritative.
  }
}
