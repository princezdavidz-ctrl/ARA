-- M-Pesa Daraja STK Push references. Provider secrets remain runtime-only.
ALTER TABLE billing_payments
  ADD COLUMN IF NOT EXISTS mpesa_checkout_request_id text,
  ADD COLUMN IF NOT EXISTS mpesa_merchant_request_id text,
  ADD COLUMN IF NOT EXISTS mpesa_phone text;

CREATE UNIQUE INDEX IF NOT EXISTS billing_payments_mpesa_checkout_uq
  ON billing_payments(mpesa_checkout_request_id)
  WHERE mpesa_checkout_request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS billing_payments_mpesa_pending_idx
  ON billing_payments(agency_id,invoice_id,created_at DESC)
  WHERE provider='mpesa' AND status='pending';
