-- Associate each conversation with the exact provider account connection that owns it.
-- Legacy conversations remain NULL and continue using legacy environment configuration.
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS channel_connection_id uuid;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='conversations_channel_connection_tenant_fk') THEN
    ALTER TABLE conversations
      ADD CONSTRAINT conversations_channel_connection_tenant_fk
      FOREIGN KEY (agency_id,channel_connection_id)
      REFERENCES channel_connections(agency_id,id)
      ON DELETE SET NULL (channel_connection_id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS conversations_channel_connection_updated_idx
  ON conversations(agency_id,channel_connection_id,updated_at DESC)
  WHERE channel_connection_id IS NOT NULL;
