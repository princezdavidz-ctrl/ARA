-- Billing lifecycle support: invoice line items, callback idempotency and subscription-period uniqueness.
CREATE UNIQUE INDEX IF NOT EXISTS billing_invoices_subscription_period_uq
  ON billing_invoices(subscription_id,period_start,period_end)
  WHERE subscription_id IS NOT NULL AND period_start IS NOT NULL AND period_end IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS billing_invoices_agency_id_uq ON billing_invoices(agency_id,id);

CREATE TABLE IF NOT EXISTS billing_invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL,
  metric text,
  description text NOT NULL,
  quantity bigint NOT NULL CHECK(quantity >= 0),
  unit_price_minor bigint NOT NULL CHECK(unit_price_minor >= 0),
  amount_minor bigint NOT NULL CHECK(amount_minor >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (agency_id,invoice_id) REFERENCES billing_invoices(agency_id,id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS billing_invoice_items_invoice_idx
  ON billing_invoice_items(agency_id,invoice_id,created_at);

CREATE TABLE IF NOT EXISTS billing_provider_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  provider_event_id text NOT NULL,
  agency_id uuid REFERENCES agencies(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  status text NOT NULL DEFAULT 'received' CHECK(status IN ('received','processed','ignored','failed')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_code text,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  UNIQUE(provider,provider_event_id)
);
CREATE INDEX IF NOT EXISTS billing_provider_events_status_idx
  ON billing_provider_events(status,received_at)
  WHERE status IN ('received','failed');

CREATE INDEX IF NOT EXISTS usage_records_subscription_period_idx
  ON usage_records(subscription_id,occurred_at,metric)
  WHERE subscription_id IS NOT NULL;

ALTER TABLE billing_invoices
  ADD CONSTRAINT billing_invoices_nonnegative_total_check
  CHECK(subtotal_minor >= 0 AND tax_minor >= 0 AND total_minor >= 0);
