ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'approved'
    CHECK (approval_status IN ('pending','approved','rejected')),
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES agency_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_by uuid REFERENCES agency_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz;

-- Hold previously queued AI replies too when the tenant's policy is supervised.
UPDATE messages m
SET approval_status='pending'
FROM conversations c
LEFT JOIN company_ai_settings s ON s.agency_id=c.agency_id
WHERE c.id=m.conversation_id
  AND c.agency_id=m.agency_id
  AND m.direction='outbound'
  AND m.sender_type='ai'
  AND m.delivery_status IN ('queued','sending')
  AND COALESCE(s.response_mode,'supervised') <> 'automatic';

CREATE INDEX IF NOT EXISTS messages_pending_approval_idx
  ON messages(agency_id,created_at)
  WHERE direction='outbound' AND sender_type='ai' AND approval_status='pending';
