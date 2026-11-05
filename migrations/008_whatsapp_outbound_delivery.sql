ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_delivery_status_check;
ALTER TABLE messages ADD CONSTRAINT messages_delivery_status_check CHECK (delivery_status IN ('stored','queued','sending','sent','failed'));
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS delivery_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivery_next_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS provider_message_id text,
  ADD COLUMN IF NOT EXISTS delivery_error text;
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_delivery_attempts_check;
ALTER TABLE messages ADD CONSTRAINT messages_delivery_attempts_check CHECK (delivery_attempts >= 0 AND delivery_attempts <= 5);
CREATE INDEX IF NOT EXISTS messages_whatsapp_delivery_idx ON messages(delivery_next_attempt_at, created_at) WHERE direction='outbound' AND delivery_status='queued';
CREATE INDEX IF NOT EXISTS messages_stale_delivery_idx ON messages(delivery_started_at) WHERE direction='outbound' AND delivery_status='sending';
-- A crash after Meta accepts a request but before ARA records the response can lead to a duplicate on retry.
UPDATE messages SET delivery_status='queued',delivery_started_at=NULL,delivery_next_attempt_at=now()
WHERE direction='outbound' AND delivery_status='sending' AND delivery_started_at < now()-interval '5 minutes';
