ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS processing_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS processing_attempts integer NOT NULL DEFAULT 0;

ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_processing_attempts_check;
ALTER TABLE messages ADD CONSTRAINT messages_processing_attempts_check
  CHECK (processing_attempts >= 0 AND processing_attempts <= 5);

CREATE INDEX IF NOT EXISTS messages_stale_worker_idx
  ON messages(processing_started_at)
  WHERE direction = 'inbound' AND processing_status = 'processing';
