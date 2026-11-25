-- First provider-backed SMS channel. Existing connections and message rows remain compatible.
ALTER TABLE channel_connections DROP CONSTRAINT IF EXISTS channel_connections_provider_check;
ALTER TABLE channel_connections ADD CONSTRAINT channel_connections_provider_check
  CHECK (provider IN ('whatsapp','email','instagram','facebook_messenger','tiktok','africas_talking_sms'));

ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_delivery_status_check;
ALTER TABLE messages ADD CONSTRAINT messages_delivery_status_check
  CHECK (delivery_status IN ('stored','queued','sending','sent','delivered','failed'));

CREATE INDEX IF NOT EXISTS messages_sms_delivery_idx
  ON messages(delivery_next_attempt_at,created_at)
  WHERE direction='outbound' AND delivery_status='queued';

CREATE INDEX IF NOT EXISTS messages_provider_message_id_idx
  ON messages(provider_message_id) WHERE provider_message_id IS NOT NULL;
