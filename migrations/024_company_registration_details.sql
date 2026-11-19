ALTER TABLE company_settings
  ADD COLUMN IF NOT EXISTS business_type text NOT NULL DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS registration_number text,
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS contact_phone text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS region text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS physical_address text,
  ADD COLUMN IF NOT EXISTS tagline text;

CREATE INDEX IF NOT EXISTS company_settings_industry_idx ON company_settings(industry);
