
-- 1. teams
CREATE TABLE public.teams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  course_code TEXT,
  invite_code TEXT UNIQUE DEFAULT substr(md5(random()::text), 1, 8),
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- 2. team_members
CREATE TABLE public.team_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(team_id, user_id)
);
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- 3. team_sessions
CREATE TABLE public.team_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.team_sessions ENABLE ROW LEVEL SECURITY;

-- 4. session_rsvps
CREATE TABLE public.session_rsvps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.team_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'going',
  responded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(session_id, user_id)
);
ALTER TABLE public.session_rsvps ENABLE ROW LEVEL SECURITY;

-- 5. contacts
CREATE TABLE public.contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  contact_user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  nickname TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, contact_user_id)
);
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

-- 6. conversations
CREATE TABLE public.conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL DEFAULT 'direct',
  name TEXT,
  team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- conversation participants (join table)
CREATE TABLE public.conversation_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(conversation_id, user_id)
);
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;

-- 7. messages
CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- 8. suggestions
CREATE TABLE public.suggestions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type TEXT NOT NULL DEFAULT 'study_tip',
  title TEXT NOT NULL,
  content TEXT,
  course_code TEXT,
  is_dismissed BOOLEAN DEFAULT false,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.suggestions ENABLE ROW LEVEL SECURITY;

-- 9. shared_activities
CREATE TABLE public.shared_activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shared_by UUID NOT NULL,
  shared_with UUID NOT NULL,
  activity_type TEXT NOT NULL DEFAULT 'resource',
  title TEXT NOT NULL,
  content TEXT,
  url TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.shared_activities ENABLE ROW LEVEL SECURITY;

-- 10. tasks
CREATE TABLE public.tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  due_date TIMESTAMPTZ,
  priority TEXT DEFAULT 'medium',
  is_complete BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  course_code TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- 11. oauth_tokens
CREATE TABLE public.oauth_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  provider TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  scopes TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, provider)
);
ALTER TABLE public.oauth_tokens ENABLE ROW LEVEL SECURITY;

-- ========== RLS POLICIES ==========

-- teams: members can view, creator can manage
CREATE POLICY "Team members can view teams" ON public.teams FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.team_members tm WHERE tm.team_id = id AND tm.user_id = auth.uid()));
CREATE POLICY "Users can create teams" ON public.teams FOR INSERT
  WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Team owner can update" ON public.teams FOR UPDATE
  USING (auth.uid() = created_by);
CREATE POLICY "Team owner can delete" ON public.teams FOR DELETE
  USING (auth.uid() = created_by);

-- team_members
CREATE POLICY "Members can view team members" ON public.team_members FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.team_members tm2 WHERE tm2.team_id = team_id AND tm2.user_id = auth.uid()));
CREATE POLICY "Users can join teams" ON public.team_members FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can leave teams" ON public.team_members FOR DELETE
  USING (auth.uid() = user_id);

-- team_sessions
CREATE POLICY "Team members can view sessions" ON public.team_sessions FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.team_members tm WHERE tm.team_id = team_id AND tm.user_id = auth.uid()));
CREATE POLICY "Team members can create sessions" ON public.team_sessions FOR INSERT
  WITH CHECK (auth.uid() = created_by AND EXISTS (SELECT 1 FROM public.team_members tm WHERE tm.team_id = team_id AND tm.user_id = auth.uid()));
CREATE POLICY "Session creator can update" ON public.team_sessions FOR UPDATE
  USING (auth.uid() = created_by);
CREATE POLICY "Session creator can delete" ON public.team_sessions FOR DELETE
  USING (auth.uid() = created_by);

-- session_rsvps
CREATE POLICY "Team members can view RSVPs" ON public.session_rsvps FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.team_sessions ts JOIN public.team_members tm ON tm.team_id = ts.team_id WHERE ts.id = session_id AND tm.user_id = auth.uid()));
CREATE POLICY "Users can RSVP" ON public.session_rsvps FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own RSVP" ON public.session_rsvps FOR UPDATE
  USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own RSVP" ON public.session_rsvps FOR DELETE
  USING (auth.uid() = user_id);

-- contacts
CREATE POLICY "Users can view own contacts" ON public.contacts FOR SELECT
  USING (auth.uid() = user_id OR auth.uid() = contact_user_id);
CREATE POLICY "Users can add contacts" ON public.contacts FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own contacts" ON public.contacts FOR UPDATE
  USING (auth.uid() = user_id OR auth.uid() = contact_user_id);
CREATE POLICY "Users can delete own contacts" ON public.contacts FOR DELETE
  USING (auth.uid() = user_id);

-- conversations: participants only
CREATE POLICY "Participants can view conversations" ON public.conversations FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.conversation_participants cp WHERE cp.conversation_id = id AND cp.user_id = auth.uid()));
CREATE POLICY "Users can create conversations" ON public.conversations FOR INSERT
  WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Creator can update conversation" ON public.conversations FOR UPDATE
  USING (auth.uid() = created_by);

-- conversation_participants
CREATE POLICY "Participants can view participants" ON public.conversation_participants FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.conversation_participants cp2 WHERE cp2.conversation_id = conversation_id AND cp2.user_id = auth.uid()));
CREATE POLICY "Users can add participants" ON public.conversation_participants FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.conversation_participants cp2 WHERE cp2.conversation_id = conversation_id AND cp2.user_id = auth.uid()) OR auth.uid() = user_id);

-- messages
CREATE POLICY "Participants can view messages" ON public.messages FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.conversation_participants cp WHERE cp.conversation_id = conversation_id AND cp.user_id = auth.uid()));
CREATE POLICY "Participants can send messages" ON public.messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id AND EXISTS (SELECT 1 FROM public.conversation_participants cp WHERE cp.conversation_id = conversation_id AND cp.user_id = auth.uid()));
CREATE POLICY "Sender can update message" ON public.messages FOR UPDATE
  USING (auth.uid() = sender_id);
CREATE POLICY "Sender can delete message" ON public.messages FOR DELETE
  USING (auth.uid() = sender_id);

-- suggestions
CREATE POLICY "Users can manage own suggestions" ON public.suggestions FOR ALL
  USING (auth.uid() = user_id);

-- shared_activities
CREATE POLICY "Users can view shared activities" ON public.shared_activities FOR SELECT
  USING (auth.uid() = shared_by OR auth.uid() = shared_with);
CREATE POLICY "Users can share activities" ON public.shared_activities FOR INSERT
  WITH CHECK (auth.uid() = shared_by);
CREATE POLICY "Sharer can delete" ON public.shared_activities FOR DELETE
  USING (auth.uid() = shared_by);

-- tasks
CREATE POLICY "Users can manage own tasks" ON public.tasks FOR ALL
  USING (auth.uid() = user_id);

-- oauth_tokens
CREATE POLICY "Users can manage own tokens" ON public.oauth_tokens FOR ALL
  USING (auth.uid() = user_id);

-- ========== TRIGGERS ==========
CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON public.teams FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_team_sessions_updated_at BEFORE UPDATE ON public.team_sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON public.messages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_oauth_tokens_updated_at BEFORE UPDATE ON public.oauth_tokens FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
