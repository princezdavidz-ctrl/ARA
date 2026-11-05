ALTER TABLE messages ADD COLUMN IF NOT EXISTS subject text;
CREATE INDEX IF NOT EXISTS messages_email_delivery_idx
  ON messages(delivery_next_attempt_at, created_at)
  WHERE direction='outbound' AND delivery_status='queued';
