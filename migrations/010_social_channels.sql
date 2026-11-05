CREATE INDEX IF NOT EXISTS conversations_instagram_contact_idx ON conversations(agency_id, customer_contact, updated_at DESC) WHERE channel='instagram';
CREATE INDEX IF NOT EXISTS conversations_tiktok_contact_idx ON conversations(agency_id, customer_contact, updated_at DESC) WHERE channel='tiktok';
CREATE INDEX IF NOT EXISTS messages_instagram_delivery_idx ON messages(delivery_next_attempt_at, created_at) WHERE direction='outbound' AND delivery_status='queued';
CREATE INDEX IF NOT EXISTS messages_tiktok_delivery_idx ON messages(delivery_next_attempt_at, created_at) WHERE direction='outbound' AND delivery_status='queued';
