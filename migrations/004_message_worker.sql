ALTER TABLE messages ADD COLUMN IF NOT EXISTS processing_status text NOT NULL DEFAULT 'not_applicable'
  CHECK (processing_status IN ('not_applicable','pending','processing','completed','failed'));
UPDATE messages SET processing_status='pending' WHERE direction='inbound' AND processing_status='not_applicable';
CREATE INDEX IF NOT EXISTS messages_inbound_worker_idx ON messages(created_at)
  WHERE direction='inbound' AND processing_status='pending';
