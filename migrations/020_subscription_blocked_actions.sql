CREATE TABLE IF NOT EXISTS subscription_blocked_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES company_subscriptions(id) ON DELETE SET NULL,
  action_type text NOT NULL CHECK (action_type IN ('message_in','message_out','ai_response','seat','channel')),
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 500),
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS subscription_blocked_actions_tenant_time_idx
  ON subscription_blocked_actions(agency_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS subscription_blocked_actions_platform_time_idx
  ON subscription_blocked_actions(occurred_at DESC, action_type);
