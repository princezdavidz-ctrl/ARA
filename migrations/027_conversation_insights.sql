CREATE TABLE IF NOT EXISTS conversation_insights (
  conversation_id uuid NOT NULL,
  agency_id uuid NOT NULL,
  summary text NOT NULL CHECK (length(summary) BETWEEN 1 AND 4000),
  sentiment text NOT NULL CHECK (sentiment IN ('positive','neutral','negative','mixed')),
  topics jsonb NOT NULL DEFAULT '[]'::jsonb,
  suggested_next_step text NOT NULL DEFAULT '',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, agency_id),
  FOREIGN KEY (conversation_id, agency_id) REFERENCES conversations(id, agency_id) ON DELETE CASCADE,
  FOREIGN KEY (created_by, agency_id) REFERENCES agency_users(id, agency_id)
);
CREATE INDEX IF NOT EXISTS conversation_insights_agency_updated_idx
  ON conversation_insights(agency_id, updated_at DESC);
