import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Calendar, CheckSquare, Target, Plus, TrendingUp, Trophy } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';

type SubTab = 'schedule' | 'tasks' | 'goals';

interface Goal {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  target_value: number;
  current_value: number;
  unit: string | null;
  due_date: string | null;
  is_complete: boolean | null;
  colour: string | null;
}

export default function PlanPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<SubTab>('schedule');
  const [events, setEvents] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [newGoalTitle, setNewGoalTitle] = useState('');

  useEffect(() => {
    if (!user) return;
    setLoading(true);

    if (activeTab === 'schedule') {
      supabase
        .from('calendar_events')
        .select('*')
        .gte('start_time', new Date().toISOString())
        .order('start_time')
        .limit(20)
        .then(({ data }) => { setEvents(data || []); setLoading(false); });
    } else if (activeTab === 'tasks') {
      supabase
        .from('tasks')
        .select('*')
        .eq('is_complete', false)
        .order('due_date', { ascending: true, nullsFirst: false })
        .limit(20)
        .then(({ data }) => { setTasks(data || []); setLoading(false); });
    } else {
      supabase
        .from('goals')
        .select('*')
        .order('is_complete', { ascending: true })
        .order('created_at', { ascending: false })
        .limit(20)
        .then(({ data }) => { setGoals((data as Goal[]) || []); setLoading(false); });
    }
  }, [user, activeTab]);

  const addGoal = async () => {
    if (!newGoalTitle.trim() || !user) return;
    const { data, error } = await supabase.from('goals').insert({
      user_id: user.id,
      title: newGoalTitle.trim(),
      target_value: 100,
      current_value: 0,
      unit: '%',
      category: 'academic',
    }).select().single();
    if (error) { toast.error('Could not create goal'); return; }
    setGoals(prev => [data as Goal, ...prev]);
    setNewGoalTitle('');
    setShowAddGoal(false);
    toast.success('Goal added');
  };

  const updateGoalProgress = async (goal: Goal, delta: number) => {
    const next = Math.max(0, Math.min(goal.target_value, goal.current_value + delta));
    const isComplete = next >= goal.target_value;
    await supabase.from('goals').update({
      current_value: next,
      is_complete: isComplete,
      completed_at: isComplete ? new Date().toISOString() : null,
    }).eq('id', goal.id);
    setGoals(prev => prev.map(g => g.id === goal.id ? { ...g, current_value: next, is_complete: isComplete } : g));
    if (isComplete) toast.success(`🎉 Goal completed: ${goal.title}`);
  };

  const tabs: { key: SubTab; label: string; icon: typeof Calendar }[] = [
    { key: 'schedule', label: 'Schedule', icon: Calendar },
    { key: 'tasks', label: 'Tasks', icon: CheckSquare },
    { key: 'goals', label: 'Goals', icon: Target },
  ];

  const toggleTask = async (id: string, isComplete: boolean) => {
    await supabase.from('tasks').update({
      is_complete: !isComplete,
      completed_at: !isComplete ? new Date().toISOString() : null,
    }).eq('id', id);
    setTasks(prev => prev.map(t => t.id === id ? { ...t, is_complete: !isComplete } : t));
  };

  return (
    <div className="px-5 pt-14 animate-fade-in">
      <h1 className="font-heading text-2xl font-bold mb-5">Plan</h1>

      {/* Sub tabs */}
      <div className="flex gap-2 mb-5">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all",
              activeTab === tab.key
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground"
            )}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="glass-card rounded-xl p-4 animate-pulse h-16" />)}
        </div>
      ) : (
        <>
          {activeTab === 'schedule' && (
            <div className="space-y-2">
              {events.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-10">No upcoming events</p>
              ) : events.map(e => (
                <div key={e.id} className="glass-card rounded-xl p-4 flex items-center gap-3">
                  <div className="w-1 h-10 rounded-full bg-primary" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{e.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(e.start_time), 'MMM d · h:mm a')}
                      {e.location && ` · ${e.location}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'tasks' && (
            <div className="space-y-2">
              {tasks.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-10">All caught up!</p>
              ) : tasks.map(t => (
                <button
                  key={t.id}
                  onClick={() => toggleTask(t.id, t.is_complete)}
                  className="glass-card rounded-xl p-4 flex items-center gap-3 w-full text-left"
                >
                  <div className={cn(
                    "w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0",
                    t.is_complete ? "bg-primary border-primary" : "border-muted-foreground"
                  )}>
                    {t.is_complete && <CheckSquare className="w-3 h-3 text-primary-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{t.title}</p>
                    {t.due_date && (
                      <p className="text-xs text-muted-foreground">{format(new Date(t.due_date), 'MMM d')}</p>
                    )}
                  </div>
                  {t.priority === 'high' && (
                    <span className="text-[10px] bg-destructive/20 text-destructive px-2 py-0.5 rounded-full">High</span>
                  )}
                </button>
              ))}
            </div>
          )}

          {activeTab === 'goals' && (
            <div className="space-y-3">
              {/* Add goal */}
              {showAddGoal ? (
                <div className="glass-card rounded-2xl p-4 space-y-3">
                  <input
                    autoFocus
                    type="text"
                    value={newGoalTitle}
                    onChange={(e) => setNewGoalTitle(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addGoal()}
                    placeholder="e.g. Read 5 chapters this week"
                    className="w-full bg-secondary/60 rounded-xl px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={addGoal}
                      className="flex-1 bg-primary text-primary-foreground rounded-xl py-2 text-sm font-semibold hover:bg-primary/90 transition-colors"
                    >
                      Add goal
                    </button>
                    <button
                      onClick={() => { setShowAddGoal(false); setNewGoalTitle(''); }}
                      className="px-4 bg-secondary text-muted-foreground rounded-xl py-2 text-sm font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowAddGoal(true)}
                  className="w-full glass-card rounded-2xl p-4 flex items-center justify-center gap-2 text-sm font-semibold text-primary border-dashed border-primary/30 hover:bg-primary/5 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  New goal
                </button>
              )}

              {goals.length === 0 ? (
                <div className="glass-card rounded-2xl p-8 text-center">
                  <Trophy className="w-6 h-6 text-primary mx-auto mb-2" />
                  <p className="font-heading font-bold text-base mb-1">Set your first goal</p>
                  <p className="text-muted-foreground text-xs">Track progress and stay accountable.</p>
                </div>
              ) : goals.map(goal => {
                const pct = Math.round((goal.current_value / goal.target_value) * 100);
                return (
                  <div key={goal.id} className="glass-card rounded-2xl p-4">
                    <div className="flex items-start justify-between mb-2 gap-2">
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          "font-semibold text-sm",
                          goal.is_complete && "line-through text-muted-foreground"
                        )}>
                          {goal.title}
                        </p>
                        {goal.due_date && (
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            Due {format(new Date(goal.due_date), 'MMM d')}
                          </p>
                        )}
                      </div>
                      <span className={cn(
                        "text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0",
                        goal.is_complete
                          ? "bg-primary/20 text-primary"
                          : "bg-secondary text-muted-foreground"
                      )}>
                        {goal.category || 'general'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mb-2">
                      <Progress value={pct} className="h-2 flex-1" />
                      <span className="font-heading text-sm font-bold text-primary tabular-nums min-w-[44px] text-right">
                        {pct}%
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" />
                        {goal.current_value} / {goal.target_value} {goal.unit}
                      </p>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => updateGoalProgress(goal, -10)}
                          className="w-7 h-7 rounded-lg bg-secondary text-muted-foreground text-sm font-bold hover:bg-secondary/80"
                        >−</button>
                        <button
                          onClick={() => updateGoalProgress(goal, 10)}
                          className="w-7 h-7 rounded-lg bg-primary/20 text-primary text-sm font-bold hover:bg-primary/30"
                        >+</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
