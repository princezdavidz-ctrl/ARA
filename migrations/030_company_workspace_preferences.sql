-- Tenant-scoped workspace appearance and AI communication schedule; interface language is per user.
ALTER TABLE agency_users ADD COLUMN IF NOT EXISTS ui_language text NOT NULL DEFAULT 'en';
ALTER TABLE agency_users ADD CONSTRAINT agency_users_ui_language_check CHECK(ui_language IN ('en','sw'));
ALTER TABLE company_settings
  ADD COLUMN IF NOT EXISTS brand_background_color char(7) NOT NULL DEFAULT '#070B14',
  ADD COLUMN IF NOT EXISTS brand_surface_color char(7) NOT NULL DEFAULT '#0B1220',
  ADD COLUMN IF NOT EXISTS brand_text_color char(7) NOT NULL DEFAULT '#E9EEF5',
  ADD COLUMN IF NOT EXISTS brand_sidebar_color char(7) NOT NULL DEFAULT '#0C1728',
  ADD COLUMN IF NOT EXISTS brand_navbar_color char(7) NOT NULL DEFAULT '#0B1220',
  ADD COLUMN IF NOT EXISTS background_image_data_url text,
  ADD COLUMN IF NOT EXISTS ai_reply_language text NOT NULL DEFAULT 'customer',
  ADD COLUMN IF NOT EXISTS ai_working_hours jsonb NOT NULL DEFAULT '{"enabled":false,"days":{"mon":{"enabled":true,"start":"00:00","end":"23:59"},"tue":{"enabled":true,"start":"00:00","end":"23:59"},"wed":{"enabled":true,"start":"00:00","end":"23:59"},"thu":{"enabled":true,"start":"00:00","end":"23:59"},"fri":{"enabled":true,"start":"00:00","end":"23:59"},"sat":{"enabled":true,"start":"00:00","end":"23:59"},"sun":{"enabled":true,"start":"00:00","end":"23:59"}}}'::jsonb,
  ADD COLUMN IF NOT EXISTS ai_after_hours_action text NOT NULL DEFAULT 'message',
  ADD COLUMN IF NOT EXISTS ai_after_hours_message text NOT NULL DEFAULT 'Thank you for contacting us. Our AI communication hours have ended. We will respond when service resumes.',
  ADD COLUMN IF NOT EXISTS layout_settings jsonb NOT NULL DEFAULT '{"sidebarWidth":258,"sidebarPosition":"left","navbarStyle":"standard","dashboardLayout":"comfortable","navItems":[]}'::jsonb;

DO $$
DECLARE c text;
BEGIN
  FOREACH c IN ARRAY ARRAY['brand_background_color','brand_surface_color','brand_text_color','brand_sidebar_color','brand_navbar_color'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='company_settings_'||c||'_check') THEN
      EXECUTE format('ALTER TABLE company_settings ADD CONSTRAINT %I CHECK (%I ~ ''^#[0-9A-Fa-f]{6}$'')','company_settings_'||c||'_check',c);
    END IF;
  END LOOP;
END $$;

ALTER TABLE company_settings
  ADD CONSTRAINT company_settings_ai_reply_language_check CHECK(ai_reply_language IN ('customer','en','sw')),
  ADD CONSTRAINT company_settings_ai_after_hours_action_check CHECK(ai_after_hours_action IN ('message','handoff'));
