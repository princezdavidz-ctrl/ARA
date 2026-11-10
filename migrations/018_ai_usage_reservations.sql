CREATE TABLE IF NOT EXISTS ai_usage_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  subscription_id uuid NOT NULL REFERENCES company_subscriptions(id) ON DELETE CASCADE,
  idempotency_key text NOT NULL,
  status text NOT NULL DEFAULT 'reserved' CHECK(status IN ('reserved','consumed','released','expired')),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(agency_id,idempotency_key)
);
CREATE INDEX IF NOT EXISTS ai_usage_reservations_active_idx
  ON ai_usage_reservations(subscription_id,expires_at)
  WHERE status='reserved';
