-- Track the provider's GET webhook challenge handshake per connection.
ALTER TABLE channel_connections
  ADD COLUMN IF NOT EXISTS webhook_verified_at timestamptz;
CREATE INDEX IF NOT EXISTS channel_connections_webhook_verified_idx
  ON channel_connections(provider,webhook_verified_at)
  WHERE status='active';
