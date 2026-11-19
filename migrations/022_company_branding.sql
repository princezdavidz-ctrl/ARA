-- Per-company visual identity. Values are tenant-scoped through company_settings.
ALTER TABLE company_settings
  ADD COLUMN IF NOT EXISTS logo_data_url text,
  ADD COLUMN IF NOT EXISTS brand_primary_color char(7) NOT NULL DEFAULT '#10B981',
  ADD COLUMN IF NOT EXISTS brand_accent_color char(7) NOT NULL DEFAULT '#0F172A';

ALTER TABLE company_settings
  ADD CONSTRAINT company_settings_brand_primary_color_check
    CHECK (brand_primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  ADD CONSTRAINT company_settings_brand_accent_color_check
    CHECK (brand_accent_color ~ '^#[0-9A-Fa-f]{6}$');
