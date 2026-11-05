CREATE TABLE IF NOT EXISTS owner_password_reset_state (
  id smallint PRIMARY KEY CHECK (id = 1),
  consumed_at timestamptz
);
INSERT INTO owner_password_reset_state(id, consumed_at)
VALUES (1, NULL)
ON CONFLICT (id) DO NOTHING;
