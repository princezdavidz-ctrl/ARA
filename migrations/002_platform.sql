CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS agencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS agency_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('owner','admin','manager','agent')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agency_id, email),
  UNIQUE (id, agency_id)
);
CREATE INDEX IF NOT EXISTS agency_users_email_idx ON agency_users(lower(email));

CREATE TABLE IF NOT EXISTS refresh_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES agency_users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS refresh_sessions_user_idx ON refresh_sessions(user_id);

CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  channel text NOT NULL DEFAULT 'web',
  customer_name text,
  customer_contact text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','pending','closed')),
  assigned_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, agency_id),
  FOREIGN KEY (assigned_user_id, agency_id) REFERENCES agency_users(id, agency_id)
);
CREATE INDEX IF NOT EXISTS conversations_tenant_updated_idx ON conversations(agency_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL,
  direction text NOT NULL CHECK (direction IN ('inbound','outbound')),
  sender_type text NOT NULL CHECK (sender_type IN ('customer','ai','agent','system')),
  body text NOT NULL,
  idempotency_key text,
  delivery_status text NOT NULL DEFAULT 'stored' CHECK (delivery_status IN ('stored','queued','sent','failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (conversation_id, agency_id) REFERENCES conversations(id, agency_id) ON DELETE CASCADE,
  UNIQUE (agency_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS messages_conversation_idx ON messages(agency_id, conversation_id, created_at);

CREATE TABLE IF NOT EXISTS escalations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','claimed','resolved')),
  claimed_by uuid,
  resolved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  FOREIGN KEY (conversation_id, agency_id) REFERENCES conversations(id, agency_id) ON DELETE CASCADE,
  FOREIGN KEY (claimed_by, agency_id) REFERENCES agency_users(id, agency_id),
  FOREIGN KEY (resolved_by, agency_id) REFERENCES agency_users(id, agency_id)
);
CREATE INDEX IF NOT EXISTS escalations_queue_idx ON escalations(agency_id, status, created_at);

CREATE TABLE IF NOT EXISTS audit_logs (
  id bigserial PRIMARY KEY,
  agency_id uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  actor_user_id uuid,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (actor_user_id, agency_id) REFERENCES agency_users(id, agency_id)
);

ALTER TABLE knowledge_documents ADD COLUMN IF NOT EXISTS agency_id uuid REFERENCES agencies(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS knowledge_documents_agency_idx ON knowledge_documents(agency_id);
