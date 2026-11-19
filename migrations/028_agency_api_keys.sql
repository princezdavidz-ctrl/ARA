CREATE TABLE IF NOT EXISTS agency_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(name) BETWEEN 2 AND 80),
  key_prefix text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  scopes text[] NOT NULL DEFAULT ARRAY['conversations:write']::text[],
  created_by uuid,
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, agency_id),
  FOREIGN KEY (created_by, agency_id) REFERENCES agency_users(id, agency_id)
);
CREATE INDEX IF NOT EXISTS agency_api_keys_tenant_idx
  ON agency_api_keys(agency_id, created_at DESC);
CREATE INDEX IF NOT EXISTS agency_api_keys_active_hash_idx
  ON agency_api_keys(key_hash) WHERE revoked_at IS NULL;
