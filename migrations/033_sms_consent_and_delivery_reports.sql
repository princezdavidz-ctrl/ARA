CREATE TABLE IF NOT EXISTS sms_contact_preferences (
  agency_id uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  phone_number text NOT NULL,
  consent_status text NOT NULL DEFAULT 'unknown' CHECK (consent_status IN ('unknown','opted_in','opted_out')),
  opted_in_at timestamptz,
  opted_out_at timestamptz,
  last_inbound_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (agency_id,phone_number)
);
CREATE INDEX IF NOT EXISTS sms_contact_preferences_suppression_idx
  ON sms_contact_preferences(agency_id,phone_number) WHERE consent_status='opted_out';

CREATE TABLE IF NOT EXISTS sms_delivery_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL,
  provider_message_id text NOT NULL,
  status text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  received_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (agency_id,connection_id) REFERENCES channel_connections(agency_id,id) ON DELETE CASCADE,
  UNIQUE (connection_id,provider_message_id)
);
