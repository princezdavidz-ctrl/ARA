CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  contact_name text NOT NULL,
  email text,
  phone text,
  source text NOT NULL CHECK (source IN ('website','whatsapp','messenger','instagram','telegram','email','phone','referral','walk_in','other')),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','qualified','viewing','won','lost')),
  interested_purpose text CHECK (interested_purpose IS NULL OR interested_purpose IN ('rent','sale')),
  property_id uuid,
  conversation_id uuid,
  county text,
  town text,
  budget_min numeric(14,2),
  budget_max numeric(14,2),
  assigned_user_id uuid,
  follow_up_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, agency_id),
  CHECK (email IS NOT NULL OR phone IS NOT NULL),
  CHECK (budget_min IS NULL OR budget_min >= 0),
  CHECK (budget_max IS NULL OR budget_max >= 0),
  CHECK (budget_min IS NULL OR budget_max IS NULL OR budget_max >= budget_min),
  FOREIGN KEY (property_id, agency_id) REFERENCES properties(id, agency_id) ON DELETE SET NULL (property_id),
  FOREIGN KEY (conversation_id, agency_id) REFERENCES conversations(id, agency_id) ON DELETE SET NULL (conversation_id),
  FOREIGN KEY (assigned_user_id, agency_id) REFERENCES agency_users(id, agency_id),
  FOREIGN KEY (created_by, agency_id) REFERENCES agency_users(id, agency_id)
);
CREATE INDEX IF NOT EXISTS leads_tenant_status_updated_idx ON leads(agency_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS leads_tenant_assignee_idx ON leads(agency_id, assigned_user_id, status);
CREATE INDEX IF NOT EXISTS leads_follow_up_idx ON leads(agency_id, follow_up_at) WHERE follow_up_at IS NOT NULL;
CREATE TABLE IF NOT EXISTS lead_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL,
  author_user_id uuid,
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 8000),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (lead_id, agency_id) REFERENCES leads(id, agency_id) ON DELETE CASCADE,
  FOREIGN KEY (author_user_id, agency_id) REFERENCES agency_users(id, agency_id)
);
CREATE INDEX IF NOT EXISTS lead_notes_tenant_lead_idx ON lead_notes(agency_id, lead_id, created_at);