CREATE TABLE IF NOT EXISTS platform_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL UNIQUE,
  environment text NOT NULL DEFAULT 'sandbox' CHECK(environment IN ('sandbox','production')),
  encrypted_credentials bytea NOT NULL,
  credential_key_version text NOT NULL,
  is_enabled boolean NOT NULL DEFAULT false,
  updated_by uuid REFERENCES platform_admin_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS platform_integrations_provider_idx ON platform_integrations(provider);
