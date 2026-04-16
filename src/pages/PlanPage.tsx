import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Calendar, CheckSquare, Target } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

type SubTab = 'schedule' | 'tasks' | 'goals';

export default function PlanPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<SubTab>('schedule');
  const [events, setEvents] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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
        .from('assignments')
        .select('*')
        .eq('is_complete', false)
        .order('due_date')
        .limit(20)
        .then(({ data }) => { setAssignments(data || []); setLoading(false); });
    }
  }, [user, activeTab]);

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
            <div className="space-y-2">
              {assignments.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-10">No assignments due</p>
              ) : assignments.map(a => (
                <div key={a.id} className="glass-card rounded-xl p-4">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-medium text-sm truncate">{a.title}</p>
                    {a.course_code && (
                      <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full shrink-0 ml-2">
                        {a.course_code}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Due {format(new Date(a.due_date), 'MMM d · h:mm a')}
                    {a.points_possible && ` · ${a.points_possible} pts`}
                  </p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
