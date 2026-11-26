CREATE TABLE IF NOT EXISTS campaign_contact_consents (
  agency_id uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('email','whatsapp','instagram','tiktok')),
  contact_key text NOT NULL,
  consent_status text NOT NULL CHECK (consent_status IN ('opted_in','opted_out')),
  source text NOT NULL,
  updated_by uuid REFERENCES agency_users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (agency_id,channel,contact_key)
);
CREATE INDEX IF NOT EXISTS campaign_contact_consents_status_idx
  ON campaign_contact_consents(agency_id,channel,consent_status);

CREATE TABLE IF NOT EXISTS campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(name) BETWEEN 2 AND 120),
  channel text NOT NULL CHECK (channel IN ('email','sms','whatsapp','instagram','tiktok')),
  subject text,
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 12000),
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scheduled','queued','paused','completed','cancelled')),
  scheduled_at timestamptz,
  created_by uuid REFERENCES agency_users(id) ON DELETE SET NULL,
  queued_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agency_id,id)
);
CREATE INDEX IF NOT EXISTS campaigns_tenant_recent_idx
  ON campaigns(agency_id,created_at DESC);

CREATE TABLE IF NOT EXISTS campaign_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL,
  campaign_id uuid NOT NULL,
  conversation_id uuid NOT NULL,
  message_id uuid REFERENCES messages(id) ON DELETE SET NULL,
  contact text NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','delivered','failed','skipped')),
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (agency_id,campaign_id) REFERENCES campaigns(agency_id,id) ON DELETE CASCADE,
  FOREIGN KEY (conversation_id,agency_id) REFERENCES conversations(id,agency_id) ON DELETE CASCADE,
  UNIQUE (campaign_id,conversation_id)
);
CREATE INDEX IF NOT EXISTS campaign_recipients_tenant_status_idx
  ON campaign_recipients(agency_id,campaign_id,status);

CREATE OR REPLACE FUNCTION ara_sync_campaign_recipient_status() RETURNS trigger AS $$
BEGIN
  IF NEW.delivery_status IS DISTINCT FROM OLD.delivery_status THEN
    UPDATE campaign_recipients
    SET status=CASE NEW.delivery_status
      WHEN 'sent' THEN 'sent'
      WHEN 'delivered' THEN 'delivered'
      WHEN 'failed' THEN 'failed'
      ELSE status END,
      failure_reason=CASE WHEN NEW.delivery_status='failed' THEN left(COALESCE(NEW.delivery_error,'Delivery failed'),1000) ELSE failure_reason END,
      updated_at=now()
    WHERE message_id=NEW.id AND agency_id=NEW.agency_id;
    UPDATE campaigns c SET status='completed',completed_at=now(),updated_at=now()
    WHERE c.id IN (SELECT campaign_id FROM campaign_recipients WHERE message_id=NEW.id AND agency_id=NEW.agency_id)
      AND c.status='queued'
      AND NOT EXISTS (SELECT 1 FROM campaign_recipients r WHERE r.campaign_id=c.id AND r.agency_id=c.agency_id AND r.status='queued');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS messages_sync_campaign_recipient_status ON messages;
CREATE TRIGGER messages_sync_campaign_recipient_status
AFTER UPDATE OF delivery_status ON messages
FOR EACH ROW EXECUTE FUNCTION ara_sync_campaign_recipient_status();
