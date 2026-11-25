-- Kenya-first Voice channel: provider-neutral call ledger with Africa's Talking adapter.
ALTER TABLE channel_connections DROP CONSTRAINT IF EXISTS channel_connections_provider_check;
ALTER TABLE channel_connections ADD CONSTRAINT channel_connections_provider_check
  CHECK (provider IN ('whatsapp','email','instagram','facebook_messenger','tiktok','africas_talking_sms','africas_talking_voice'));

ALTER TABLE usage_records DROP CONSTRAINT IF EXISTS usage_records_metric_check;
ALTER TABLE usage_records ADD CONSTRAINT usage_records_metric_check
  CHECK (metric IN ('message_in','message_out','ai_response','human_handoff','channel_connected','token_input','token_output','voice_call','voice_second'));

CREATE TABLE IF NOT EXISTS voice_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL,
  conversation_id uuid NOT NULL,
  direction text NOT NULL CHECK (direction IN ('inbound','outbound')),
  provider_session_id text,
  client_request_id text NOT NULL,
  caller_number text NOT NULL,
  destination_number text NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','dialing','ringing','bridged','completed','not_answered','busy','rejected','expired','failed')),
  duration_seconds integer NOT NULL DEFAULT 0 CHECK (duration_seconds>=0),
  provider_cost numeric(14,4),
  currency_code char(3) NOT NULL DEFAULT 'KES',
  recording_enabled boolean NOT NULL DEFAULT false,
  recording_url text,
  started_at timestamptz,
  answered_at timestamptz,
  ended_at timestamptz,
  last_provider_event_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (agency_id,connection_id) REFERENCES channel_connections(agency_id,id) ON DELETE CASCADE,
  FOREIGN KEY (agency_id,conversation_id) REFERENCES conversations(agency_id,id) ON DELETE CASCADE,
  UNIQUE (agency_id,client_request_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS voice_calls_connection_session_uq
  ON voice_calls(connection_id,provider_session_id) WHERE provider_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS voice_calls_tenant_recent_idx
  ON voice_calls(agency_id,created_at DESC);
CREATE INDEX IF NOT EXISTS voice_calls_tenant_status_idx
  ON voice_calls(agency_id,status,created_at DESC);

CREATE TABLE IF NOT EXISTS voice_call_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  call_id uuid NOT NULL,
  event_key text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  received_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (agency_id,call_id) REFERENCES voice_calls(agency_id,id) ON DELETE CASCADE,
  UNIQUE (call_id,event_key)
);
CREATE INDEX IF NOT EXISTS voice_call_events_tenant_recent_idx
  ON voice_call_events(agency_id,received_at DESC);
