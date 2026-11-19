CREATE TABLE IF NOT EXISTS agency_user_presence (
  user_id uuid NOT NULL,
  agency_id uuid NOT NULL,
  is_online boolean NOT NULL DEFAULT false,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, agency_id),
  FOREIGN KEY (user_id, agency_id) REFERENCES agency_users(id, agency_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS agency_user_presence_online_idx
  ON agency_user_presence(agency_id, is_online, last_seen_at DESC);
