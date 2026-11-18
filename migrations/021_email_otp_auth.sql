CREATE TABLE IF NOT EXISTS auth_email_otps (
  id uuid PRIMARY KEY,
  email text NOT NULL,
  purpose text NOT NULL CHECK (purpose IN ('company_auth','admin_auth')),
  principal_id uuid NOT NULL,
  code_hash text NOT NULL,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
  expires_at timestamptz NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  consumed_at timestamptz
);
CREATE INDEX IF NOT EXISTS auth_email_otps_email_purpose_sent_idx
  ON auth_email_otps(lower(email), purpose, sent_at DESC);
CREATE INDEX IF NOT EXISTS auth_email_otps_expiry_idx
  ON auth_email_otps(expires_at);

-- Existing sessions were authenticated before mandatory OTP and must sign in again.
UPDATE refresh_sessions SET revoked_at=now() WHERE revoked_at IS NULL;
