
-- Extend assignments table for LMS imports
ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS submission_url text,
  ADD COLUMN IF NOT EXISTS metadata jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Unique constraint for LMS upserts on assignments
CREATE UNIQUE INDEX IF NOT EXISTS idx_assignments_user_external
  ON public.assignments(user_id, external_id)
  WHERE external_id IS NOT NULL;

-- Extend calendar_events table for LMS imports
ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS colour text DEFAULT '#a78bfa',
  ADD COLUMN IF NOT EXISTS is_blocked boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS metadata jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Unique constraint for LMS upserts on calendar_events
CREATE UNIQUE INDEX IF NOT EXISTS idx_cal_user_external
  ON public.calendar_events(user_id, external_id)
  WHERE external_id IS NOT NULL;

-- Extend lms_connections for auto-detection flow
ALTER TABLE public.lms_connections
  ADD COLUMN IF NOT EXISTS lms_type text,
  ADD COLUMN IF NOT EXISTS lms_name text,
  ADD COLUMN IF NOT EXISTS base_url text,
  ADD COLUMN IF NOT EXISTS auth_method text DEFAULT 'oauth2',
  ADD COLUMN IF NOT EXISTS email_domain text,
  ADD COLUMN IF NOT EXISTS is_connected boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS sync_error text,
  ADD COLUMN IF NOT EXISTS courses_count int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tasks_count int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS events_count int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS detected_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS metadata jsonb;

-- Unique constraint: one LMS connection per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_lms_conn_user_unique
  ON public.lms_connections(user_id);

-- Index for domain lookups
CREATE INDEX IF NOT EXISTS idx_lms_conn_domain
  ON public.lms_connections(email_domain);

-- Enable realtime for lms_connections to show sync status updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.lms_connections;
