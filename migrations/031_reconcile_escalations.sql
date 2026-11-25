-- Reconcile legacy/staging databases where the original platform migration was only partially applied.
-- This is additive and safe when the escalations table already exists.
CREATE TABLE IF NOT EXISTS escalations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','claimed','resolved')),
  claimed_by uuid,
  resolved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  FOREIGN KEY (conversation_id, agency_id) REFERENCES conversations(id, agency_id) ON DELETE CASCADE,
  FOREIGN KEY (claimed_by, agency_id) REFERENCES agency_users(id, agency_id),
  FOREIGN KEY (resolved_by, agency_id) REFERENCES agency_users(id, agency_id)
);
CREATE INDEX IF NOT EXISTS escalations_queue_idx ON escalations(agency_id, status, created_at);
