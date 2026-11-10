-- ARA multi-company platform foundation. Secrets are stored only as authenticated-encryption ciphertext.
-- Existing agencies remain the tenant root to preserve current API compatibility.
CREATE TABLE IF NOT EXISTS platform_admin_users (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text NOT NULL UNIQUE, full_name text NOT NULL,
 password_hash text NOT NULL, role text NOT NULL CHECK (role IN ('super_admin','platform_support','billing_admin','security_auditor')),
 is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS company_settings (
 agency_id uuid PRIMARY KEY REFERENCES agencies(id) ON DELETE CASCADE, industry text NOT NULL DEFAULT 'general',
 display_name text, timezone text NOT NULL DEFAULT 'Africa/Nairobi', default_language text NOT NULL DEFAULT 'en',
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS company_ai_settings (
 agency_id uuid PRIMARY KEY REFERENCES agencies(id) ON DELETE CASCADE, agent_name text NOT NULL DEFAULT 'ARA Assistant',
 system_instructions text NOT NULL DEFAULT '', response_mode text NOT NULL DEFAULT 'supervised'
 CHECK (response_mode IN ('supervised','automatic','draft_only')),
 confidence_threshold numeric(4,3) NOT NULL DEFAULT 0.720 CHECK (confidence_threshold BETWEEN 0 AND 1),
 escalate_sensitive_topics boolean NOT NULL DEFAULT true, enabled boolean NOT NULL DEFAULT true,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS knowledge_bases (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), agency_id uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
 name text NOT NULL, industry text NOT NULL DEFAULT 'general', description text, is_default boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE (agency_id,id)
);
CREATE INDEX IF NOT EXISTS knowledge_bases_agency_idx ON knowledge_bases(agency_id);
CREATE TABLE IF NOT EXISTS subscription_plans (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text NOT NULL UNIQUE, name text NOT NULL, description text,
 currency char(3) NOT NULL DEFAULT 'KES', monthly_price_minor bigint NOT NULL CHECK (monthly_price_minor >= 0),
 included_messages bigint NOT NULL DEFAULT 0 CHECK (included_messages >= 0),
 included_ai_responses bigint NOT NULL DEFAULT 0 CHECK (included_ai_responses >= 0),
 max_channels integer NOT NULL DEFAULT 1 CHECK (max_channels >= 0), max_seats integer NOT NULL DEFAULT 1 CHECK (max_seats >= 1),
 overage_message_price_minor bigint NOT NULL DEFAULT 0 CHECK (overage_message_price_minor >= 0),
 overage_ai_price_minor bigint NOT NULL DEFAULT 0 CHECK (overage_ai_price_minor >= 0),
 is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS company_subscriptions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), agency_id uuid NOT NULL REFERENCES agencies(id) ON DELETE RESTRICT,
 plan_id uuid NOT NULL REFERENCES subscription_plans(id) ON DELETE RESTRICT,
 status text NOT NULL CHECK (status IN ('trialing','active','past_due','suspended','cancelled','expired')),
 billing_interval text NOT NULL DEFAULT 'month' CHECK (billing_interval IN ('month','year')),
 currency char(3) NOT NULL DEFAULT 'KES', unit_price_minor bigint NOT NULL CHECK (unit_price_minor >= 0),
 current_period_start timestamptz NOT NULL, current_period_end timestamptz NOT NULL, trial_ends_at timestamptz,
 cancel_at_period_end boolean NOT NULL DEFAULT false, provider text, provider_customer_ref text, provider_subscription_ref text,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK (current_period_end > current_period_start)
);
CREATE INDEX IF NOT EXISTS company_subscriptions_tenant_status_idx ON company_subscriptions(agency_id,status,current_period_end DESC);
CREATE UNIQUE INDEX IF NOT EXISTS company_subscriptions_provider_ref_uq ON company_subscriptions(provider,provider_subscription_ref)
 WHERE provider IS NOT NULL AND provider_subscription_ref IS NOT NULL;
CREATE TABLE IF NOT EXISTS billing_invoices (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), agency_id uuid NOT NULL REFERENCES agencies(id) ON DELETE RESTRICT,
 subscription_id uuid REFERENCES company_subscriptions(id) ON DELETE SET NULL, invoice_number text NOT NULL UNIQUE,
 status text NOT NULL CHECK (status IN ('draft','open','paid','void','uncollectible')),
 currency char(3) NOT NULL DEFAULT 'KES', subtotal_minor bigint NOT NULL DEFAULT 0 CHECK (subtotal_minor >= 0),
 tax_minor bigint NOT NULL DEFAULT 0 CHECK (tax_minor >= 0), total_minor bigint NOT NULL DEFAULT 0 CHECK (total_minor >= 0),
 period_start timestamptz, period_end timestamptz, due_at timestamptz, paid_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS billing_invoices_tenant_created_idx ON billing_invoices(agency_id,created_at DESC);
CREATE TABLE IF NOT EXISTS billing_payments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), agency_id uuid NOT NULL REFERENCES agencies(id) ON DELETE RESTRICT,
 invoice_id uuid REFERENCES billing_invoices(id) ON DELETE SET NULL, provider text NOT NULL, provider_payment_ref text,
 status text NOT NULL CHECK (status IN ('pending','succeeded','failed','refunded')),
 amount_minor bigint NOT NULL CHECK (amount_minor >= 0), currency char(3) NOT NULL DEFAULT 'KES',
 provider_payload jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE (provider,provider_payment_ref)
);
CREATE INDEX IF NOT EXISTS billing_payments_tenant_created_idx ON billing_payments(agency_id,created_at DESC);
CREATE TABLE IF NOT EXISTS usage_records (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), agency_id uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
 subscription_id uuid REFERENCES company_subscriptions(id) ON DELETE SET NULL,
 metric text NOT NULL CHECK (metric IN ('message_in','message_out','ai_response','human_handoff','channel_connected','token_input','token_output')),
 quantity bigint NOT NULL CHECK (quantity > 0), idempotency_key text, metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
 occurred_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (agency_id,idempotency_key)
);
CREATE INDEX IF NOT EXISTS usage_records_tenant_metric_time_idx ON usage_records(agency_id,metric,occurred_at DESC);
-- Ciphertext only: encryption/decryption belongs in the app using ARA_CHANNEL_ENCRYPTION_KEY.
CREATE TABLE IF NOT EXISTS channel_connections (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), agency_id uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
 provider text NOT NULL CHECK (provider IN ('whatsapp','email','instagram','facebook_messenger','tiktok')),
 display_name text NOT NULL, external_account_id text NOT NULL, external_phone_number_id text,
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','reauthorization_required','disabled','error')),
 encrypted_credentials bytea NOT NULL, credential_key_version text NOT NULL, webhook_secret_hash text,
 scopes text[] NOT NULL DEFAULT '{}', connected_by uuid,
 last_verified_at timestamptz, last_error_code text, created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE (provider,external_account_id), UNIQUE (agency_id,id),
 FOREIGN KEY (connected_by,agency_id) REFERENCES agency_users(id,agency_id) ON DELETE SET NULL (connected_by)
);
CREATE INDEX IF NOT EXISTS channel_connections_tenant_provider_idx ON channel_connections(agency_id,provider,status);
CREATE TABLE IF NOT EXISTS channel_webhook_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), agency_id uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
 connection_id uuid NOT NULL, provider_event_id text NOT NULL, event_type text NOT NULL, payload jsonb NOT NULL,
 status text NOT NULL DEFAULT 'received' CHECK (status IN ('received','processing','processed','failed','ignored')),
 received_at timestamptz NOT NULL DEFAULT now(), processed_at timestamptz, error_code text,
 FOREIGN KEY (agency_id,connection_id) REFERENCES channel_connections(agency_id,id) ON DELETE CASCADE,
 UNIQUE (connection_id,provider_event_id)
);
CREATE INDEX IF NOT EXISTS channel_webhook_events_pending_idx ON channel_webhook_events(status,received_at)
 WHERE status IN ('received','failed');
CREATE TABLE IF NOT EXISTS platform_audit_logs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), platform_admin_id uuid REFERENCES platform_admin_users(id) ON DELETE SET NULL,
 agency_id uuid REFERENCES agencies(id) ON DELETE SET NULL, action text NOT NULL, target_type text NOT NULL,
 target_id text, reason text, details jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS platform_audit_logs_tenant_time_idx ON platform_audit_logs(agency_id,created_at DESC);
