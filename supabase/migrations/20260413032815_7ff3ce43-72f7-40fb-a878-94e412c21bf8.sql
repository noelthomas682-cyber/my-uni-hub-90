-- Profiles table
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  university TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- LMS Connections
CREATE TABLE public.lms_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('canvas', 'moodle', 'd2l', 'blackboard')),
  instance_url TEXT NOT NULL,
  university_name TEXT NOT NULL,
  client_id TEXT,
  client_secret TEXT,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.lms_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own LMS connections" ON public.lms_connections FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own LMS connections" ON public.lms_connections FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own LMS connections" ON public.lms_connections FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own LMS connections" ON public.lms_connections FOR DELETE USING (auth.uid() = user_id);

-- Courses
CREATE TABLE public.courses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  course_code TEXT NOT NULL,
  course_name TEXT NOT NULL,
  instructor TEXT,
  source TEXT NOT NULL CHECK (source IN ('canvas', 'moodle', 'd2l', 'blackboard')),
  external_id TEXT,
  connection_id UUID REFERENCES public.lms_connections ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own courses" ON public.courses FOR ALL USING (auth.uid() = user_id);

-- Calendar Events
CREATE TABLE public.calendar_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  location TEXT,
  event_type TEXT DEFAULT 'class' CHECK (event_type IN ('class', 'lecture', 'seminar', 'lab', 'tutorial', 'exam', 'personal')),
  course_code TEXT,
  course_name TEXT,
  is_recurring BOOLEAN DEFAULT false,
  source TEXT DEFAULT 'manual' CHECK (source IN ('canvas', 'moodle', 'd2l', 'blackboard', 'manual')),
  external_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own calendar events" ON public.calendar_events FOR ALL USING (auth.uid() = user_id);
CREATE INDEX idx_events_user_time ON public.calendar_events(user_id, start_time);

-- Assignments
CREATE TABLE public.assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  course_code TEXT,
  course_name TEXT,
  due_date TIMESTAMPTZ NOT NULL,
  assignment_type TEXT DEFAULT 'assignment' CHECK (assignment_type IN ('assignment', 'quiz', 'exam', 'discussion', 'project')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  is_complete BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  points_possible NUMERIC,
  source TEXT DEFAULT 'manual' CHECK (source IN ('canvas', 'moodle', 'd2l', 'blackboard', 'manual')),
  external_id TEXT,
  connection_id UUID REFERENCES public.lms_connections ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own assignments" ON public.assignments FOR ALL USING (auth.uid() = user_id);
CREATE INDEX idx_assignments_user_due ON public.assignments(user_id, due_date);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_lms_connections_updated_at BEFORE UPDATE ON public.lms_connections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();