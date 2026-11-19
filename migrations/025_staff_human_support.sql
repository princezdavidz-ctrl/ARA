CREATE TABLE IF NOT EXISTS ara_support_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_token_hash text NOT NULL,
  visitor_name text NOT NULL,
  visitor_email text NOT NULL,
  language text NOT NULL DEFAULT 'en' CHECK (language IN ('en','sw')),
  status text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','claimed','resolved')),
  assigned_staff_id uuid REFERENCES platform_admin_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ara_support_threads_queue_idx ON ara_support_threads(status,last_message_at DESC);
CREATE INDEX IF NOT EXISTS ara_support_threads_staff_idx ON ara_support_threads(assigned_staff_id,status);
CREATE TABLE IF NOT EXISTS ara_support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES ara_support_threads(id) ON DELETE CASCADE,
  sender_type text NOT NULL CHECK(sender_type IN ('visitor','staff','system')),
  sender_id uuid REFERENCES platform_admin_users(id) ON DELETE SET NULL,
  body text NOT NULL CHECK(length(body) BETWEEN 1 AND 12000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ara_support_messages_thread_idx ON ara_support_messages(thread_id,created_at);
CREATE TABLE IF NOT EXISTS ara_support_staff_presence (
  staff_id uuid PRIMARY KEY REFERENCES platform_admin_users(id) ON DELETE CASCADE,
  is_online boolean NOT NULL DEFAULT false,
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
