-- Create goals table for personal student goals with progress tracking
CREATE TABLE IF NOT EXISTS public.goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'academic',
  target_value NUMERIC DEFAULT 100,
  current_value NUMERIC DEFAULT 0,
  unit TEXT DEFAULT '%',
  due_date TIMESTAMP WITH TIME ZONE,
  is_complete BOOLEAN DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  colour TEXT DEFAULT '#b8f057',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own goals"
ON public.goals FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_goals_updated_at
BEFORE UPDATE ON public.goals
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();