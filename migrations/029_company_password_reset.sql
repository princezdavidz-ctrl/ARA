ALTER TABLE auth_email_otps DROP CONSTRAINT IF EXISTS auth_email_otps_purpose_check;
ALTER TABLE auth_email_otps
  ADD CONSTRAINT auth_email_otps_purpose_check
  CHECK (purpose IN ('company_auth','admin_auth','company_password_reset'));
