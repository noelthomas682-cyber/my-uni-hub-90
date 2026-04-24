import { useState, useEffect } from 'react';
import { format, isPast, isToday, differenceInDays } from 'date-fns';
import { Calendar, CheckSquare, Target, Plus, Trophy, X, AlertTriangle, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type SubTab = 'schedule' | 'tasks' | 'goals';

interface Goal {
  id: string;
  title: string;
  description: string | null;
  period_days: number;
  start_date: string | null;
  end_date: string | null;
  is_complete: boolean | null;
  completed_at: string | null;
  created_at: string;
}

function getTaskStatus(dueDate: string) {
  const due = new Date(dueDate);
  const now = new Date();
  if (isPast(due) && !isToday(due)) return 'overdue';
  if (isToday(due)) return 'today';
  if (differenceInDays(due, now) <= 7) return 'soon';
  return 'upcoming';
}

function getTaskLabel(dueDate: string) {
  const due = new Date(dueDate);
  const now = new Date();
  if (isPast(due) && !isToday(due)) {
    const days = differenceInDays(now, due);
    return days === 1 ? '1 day overdue' : `${days} days overdue`;
  }
  if (isToday(due)) return 'Due today';
  const days = differenceInDays(due, now);
  if (days <= 7) return `Due in ${days}d`;
  return format(due, 'MMM d');
}

function getTaskColours(status: string) {
  switch (status) {
    case 'overdue': return { badge: 'bg-red-500/15 text-red-400', dot: 'bg-red-500' };
    case 'today': return { badge: 'bg-yellow-400/15 text-yellow-400', dot: 'bg-yellow-400' };
    case 'soon': return { badge: 'bg-orange-400/15 text-orange-400', dot: 'bg-orange-400' };
    default: return { badge: 'bg-white/5 text-white/40', dot: 'bg-white/20' };
  }
}

function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="glass-card rounded-xl p-4 flex items-center gap-3 border border-red-500/20">
      <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
      <p className="text-xs text-red-400 flex-1">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="shrink-0 text-red-400">
          <RefreshCw className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

export default function PlanPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<SubTab>('schedule');
  const [events, setEvents] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [completedTasks, setCompletedTasks] = useState<any[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showAddGoal, setShowAddGoal] = useState(false);
  const [newGoalTitle, setNewGoalTitle] = useState('');
  const [newGoalPeriod, setNewGoalPeriod] = useState('30');

  const [showAddTask, setShowAddTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDue, setNewTaskDue] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState('normal');
  const [newTaskCourse, setNewTaskCourse] = useState('');

  const [showAddEvent, setShowAddEvent] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventStart, setNewEventStart] = useState('');
  const [newEventEnd, setNewEventEnd] = useState('');
  const [newEventLocation, setNewEventLocation] = useState('');

  const loadTab = () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    if (activeTab === 'schedule') {
      supabase.from('calendar_events').select('*')
        .eq('user_id', user.id)
        .gte('start_time', new Date().toISOString())
        .order('start_time').limit(20)
        .then(({ data, error }) => {
          if (error) setError('Could not load schedule. Pull to refresh.');
          setEvents(data || []);
          setLoading(false);
        });
    } else if (activeTab === 'tasks') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      Promise.all([
        supabase.from('tasks').select('*')
          .eq('user_id', user.id)
          .eq('is_complete', false)
          .order('due_date', { ascending: true, nullsFirst: false }),
        supabase.from('tasks').select('*')
          .eq('user_id', user.id)
          .eq('is_complete', true)
          .gte('completed_at', sevenDaysAgo.toISOString())
          .order('completed_at', { ascending: false }).limit(10),
      ]).then(([incompleteRes, completedRes]) => {
        if (incompleteRes.error) setError('Could not load tasks. Pull to refresh.');
        setTasks(incompleteRes.data || []);
        setCompletedTasks(completedRes.data || []);
        setLoading(false);
      });
    } else {
      supabase.from('goals').select('*')
        .eq('user_id', user.id)
        .order('is_complete', { ascending: true })
        .order('created_at', { ascending: false }).limit(20)
        .then(({ data, error }) => {
          if (error) setError('Could not load goals. Pull to refresh.');
          setGoals((data as Goal[]) || []);
          setLoading(false);
        });
    }
  };

  useEffect(() => { loadTab(); }, [user, activeTab]);

  const addTask = async () => {
    if (!newTaskTitle.trim() || !user) return;
    const { data, error } = await supabase.from('tasks').insert({
      user_id: user.id,
      title: newTaskTitle.trim(),
      due_date: newTaskDue || null,
      priority: newTaskPriority,
      course_code: newTaskCourse || null,
      is_complete: false,
      source: 'manual',
    }).select().single();
    if (error) { toast.error('Could not create task. Please try again.'); return; }
    setTasks(prev => [data, ...prev]);
    setNewTaskTitle(''); setNewTaskDue(''); setNewTaskPriority('normal'); setNewTaskCourse('');
    setShowAddTask(false);
    toast.success('Task added');
  };

  const addEvent = async () => {
    if (!newEventTitle.trim() || !newEventStart || !user) return;
    const { data, error } = await supabase.from('calendar_events').insert({
      user_id: user.id,
      title: newEventTitle.trim(),
      start_time: newEventStart,
      end_time: newEventEnd || newEventStart,
      location: newEventLocation || null,
      event_type: 'personal',
      source: 'manual',
    }).select().single();
    if (error) { toast.error('Could not create event. Please try again.'); return; }
    setEvents(prev => [...prev, data].sort((a, b) =>
      new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    ));
    setNewEventTitle(''); setNewEventStart(''); setNewEventEnd(''); setNewEventLocation('');
    setShowAddEvent(false);
    toast.success('Event added');
  };

  const addGoal = async () => {
    if (!newGoalTitle.trim() || !user) return;
    const { data, error } = await supabase.from('goals').insert({
      user_id: user.id,
      title: newGoalTitle.trim(),
      period_days: parseInt(newGoalPeriod) || 30,
      start_date: new Date().toISOString().split('T')[0],
    }).select().single();
    if (error) { toast.error('Could not create goal. Please try again.'); return; }
    setGoals(prev => [data as Goal, ...prev]);
    setNewGoalTitle(''); setNewGoalPeriod('30'); setShowAddGoal(false);
    toast.success('Goal added');
  };

  const toggleGoal = async (goal: Goal) => {
    const isComplete = !goal.is_complete;
    const { error } = await supabase.from('goals').update({
      is_complete: isComplete,
      completed_at: isComplete ? new Date().toISOString() : null,
    }).eq('id', goal.id);
    if (error) { toast.error('Could not update goal'); return; }
    setGoals(prev => prev.map(g => g.id === goal.id ? { ...g, is_complete: isComplete } : g));
    if (isComplete) toast.success(`🎉 Goal completed: ${goal.title}`);
  };

  const toggleTask = async (id: string, isComplete: boolean) => {
    const { error } = await supabase.from('tasks').update({
      is_complete: !isComplete,
      completed_at: !isComplete ? new Date().toISOString() : null,
    }).eq('id', id);
    if (error) { toast.error('Could not update task'); return; }
    if (!isComplete) {
      const task = tasks.find(t => t.id === id);
      if (task) {
        setTasks(prev => prev.filter(t => t.id !== id));
        setCompletedTasks(prev => [{ ...task, is_complete: true }, ...prev]);
        toast.success('Task completed ✓');
      }
    } else {
      const task = completedTasks.find(t => t.id === id);
      if (task) {
        setCompletedTasks(prev => prev.filter(t => t.id !== id));
        setTasks(prev => [...prev, { ...task, is_complete: false }].sort((a, b) =>
          new Date(a.due_date || 0).getTime() - new Date(b.due_date || 0).getTime()
        ));
        toast.success('Task reopened');
      }
    }
  };

  const tabs = [
    { key: 'schedule' as SubTab, label: 'Schedule', icon: Calendar },
    { key: 'tasks' as SubTab, label: 'Tasks', icon: CheckSquare },
    { key: 'goals' as SubTab, label: 'Goals', icon: Target },
  ];

  // Split incomplete tasks into dated and undated
  const datedTasks = tasks.filter(t => t.due_date);
  const undatedTasks = tasks.filter(t => !t.due_date);

  return (
    <div className="px-5 pt-14 animate-fade-in pb-24">
      <h1 className="font-heading text-2xl font-bold mb-5">Plan</h1>

      <div className="flex gap-2 mb-5">
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={cn("flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all",
              activeTab === tab.key ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground")}>
            <tab.icon className="w-3.5 h-3.5" />{tab.label}
          </button>
        ))}
      </div>

      {error && <ErrorBanner message={error} onRetry={loadTab} />}

      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="glass-card rounded-xl p-4 animate-pulse h-16" />)}
        </div>
      ) : (
        <>
          {/* SCHEDULE TAB */}
          {activeTab === 'schedule' && (
            <div className="space-y-2">
              {showAddEvent ? (
                <div className="glass-card rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-sm">New Event</p>
                    <button onClick={() => setShowAddEvent(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
                  </div>
                  <input type="text" placeholder="Event title" value={newEventTitle}
                    onChange={e => setNewEventTitle(e.target.value)}
                    className="w-full bg-secondary/60 rounded-xl px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40" />
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-muted-foreground">Start</label>
                      <input type="datetime-local" value={newEventStart} onChange={e => setNewEventStart(e.target.value)}
                        className="w-full bg-secondary/60 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 mt-1" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">End</label>
                      <input type="datetime-local" value={newEventEnd} onChange={e => setNewEventEnd(e.target.value)}
                        className="w-full bg-secondary/60 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 mt-1" />
                    </div>
                  </div>
                  <input type="text" placeholder="Location (optional)" value={newEventLocation}
                    onChange={e => setNewEventLocation(e.target.value)}
                    className="w-full bg-secondary/60 rounded-xl px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40" />
                  <div className="flex gap-2">
                    <button onClick={addEvent} className="flex-1 bg-primary text-primary-foreground rounded-xl py-2 text-sm font-semibold">Add event</button>
                    <button onClick={() => setShowAddEvent(false)} className="px-4 bg-secondary text-muted-foreground rounded-xl py-2 text-sm">Cancel</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setShowAddEvent(true)}
                  className="w-full glass-card rounded-2xl p-4 flex items-center justify-center gap-2 text-sm font-semibold text-primary border-dashed border-primary/30 hover:bg-primary/5 transition-colors">
                  <Plus className="w-4 h-4" />New event
                </button>
              )}
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

          {/* TASKS TAB */}
          {activeTab === 'tasks' && (
            <div className="space-y-2">
              {showAddTask ? (
                <div className="glass-card rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-sm">New Task</p>
                    <button onClick={() => setShowAddTask(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
                  </div>
                  <input type="text" placeholder="Task title" value={newTaskTitle}
                    onChange={e => setNewTaskTitle(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addTask()}
                    className="w-full bg-secondary/60 rounded-xl px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40" />
                  <input type="text" placeholder="Course code (optional)" value={newTaskCourse}
                    onChange={e => setNewTaskCourse(e.target.value)}
                    className="w-full bg-secondary/60 rounded-xl px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40" />
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-muted-foreground">Due date</label>
                      <input type="datetime-local" value={newTaskDue} onChange={e => setNewTaskDue(e.target.value)}
                        className="w-full bg-secondary/60 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 mt-1" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Priority</label>
                      <select value={newTaskPriority} onChange={e => setNewTaskPriority(e.target.value)}
                        className="w-full bg-secondary/60 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 mt-1">
                        <option value="low">Low</option>
                        <option value="normal">Normal</option>
                        <option value="high">High</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={addTask} className="flex-1 bg-primary text-primary-foreground rounded-xl py-2 text-sm font-semibold">Add task</button>
                    <button onClick={() => setShowAddTask(false)} className="px-4 bg-secondary text-muted-foreground rounded-xl py-2 text-sm">Cancel</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setShowAddTask(true)}
                  className="w-full glass-card rounded-2xl p-4 flex items-center justify-center gap-2 text-sm font-semibold text-primary border-dashed border-primary/30 hover:bg-primary/5 transition-colors">
                  <Plus className="w-4 h-4" />New task
                </button>
              )}

              {tasks.length === 0 && completedTasks.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-10">All caught up!</p>
              ) : (
                <>
                  {/* Dated tasks */}
                  {datedTasks.map(t => {
                    const status = getTaskStatus(t.due_date);
                    const label = getTaskLabel(t.due_date);
                    const colours = getTaskColours(status);
                    return (
                      <button key={t.id} onClick={() => toggleTask(t.id, t.is_complete)}
                        className="glass-card rounded-xl p-4 flex items-center gap-3 w-full text-left">
                        <div className="w-5 h-5 rounded-md border-2 border-muted-foreground flex items-center justify-center shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{t.title}</p>
                          {t.course_code && <p className="text-xs text-muted-foreground">{t.course_code}</p>}
                        </div>
                        <span className={cn('text-[10px] font-bold px-2 py-1 rounded-full shrink-0', colours.badge)}>
                          {label}
                        </span>
                      </button>
                    );
                  })}

                  {/* Someday — tasks with no due date */}
                  {undatedTasks.length > 0 && (
                    <>
                      <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold pt-2">Someday</p>
                      {undatedTasks.map(t => (
                        <button key={t.id} onClick={() => toggleTask(t.id, t.is_complete)}
                          className="glass-card rounded-xl p-4 flex items-center gap-3 w-full text-left">
                          <div className="w-5 h-5 rounded-md border-2 border-muted-foreground/40 flex items-center justify-center shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate text-muted-foreground">{t.title}</p>
                            {t.course_code && <p className="text-xs text-muted-foreground/60">{t.course_code}</p>}
                          </div>
                          <span className="text-[10px] font-bold px-2 py-1 rounded-full shrink-0 bg-white/5 text-white/30">
                            No deadline
                          </span>
                        </button>
                      ))}
                    </>
                  )}

                  {/* Completed tasks */}
                  {completedTasks.length > 0 && (
                    <>
                      <p className="text-[10px] text-white/20 uppercase tracking-widest font-bold pt-2">Completed</p>
                      {completedTasks.map(t => (
                        <button key={t.id} onClick={() => toggleTask(t.id, t.is_complete)}
                          className="glass-card rounded-xl p-4 flex items-center gap-3 w-full text-left opacity-50">
                          <div className="w-5 h-5 rounded-md border-2 bg-primary border-primary flex items-center justify-center shrink-0">
                            <CheckSquare className="w-3 h-3 text-primary-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate line-through text-muted-foreground">{t.title}</p>
                          </div>
                        </button>
                      ))}
                    </>
                  )}
                </>
              )}
            </div>
          )}

          {/* GOALS TAB */}
          {activeTab === 'goals' && (
            <div className="space-y-3">
              {showAddGoal ? (
                <div className="glass-card rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-sm">New Goal</p>
                    <button onClick={() => setShowAddGoal(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
                  </div>
                  <input autoFocus type="text" value={newGoalTitle}
                    onChange={e => setNewGoalTitle(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addGoal()}
                    placeholder="e.g. Read 5 chapters this week"
                    className="w-full bg-secondary/60 rounded-xl px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40" />
                  <div>
                    <label className="text-xs text-muted-foreground">Goal period</label>
                    <select value={newGoalPeriod} onChange={e => setNewGoalPeriod(e.target.value)}
                      className="w-full bg-secondary/60 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 mt-1">
                      <option value="30">30 days</option>
                      <option value="60">60 days</option>
                      <option value="90">90 days</option>
                      <option value="365">1 year</option>
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={addGoal} className="flex-1 bg-primary text-primary-foreground rounded-xl py-2 text-sm font-semibold">Add goal</button>
                    <button onClick={() => { setShowAddGoal(false); setNewGoalTitle(''); }}
                      className="px-4 bg-secondary text-muted-foreground rounded-xl py-2 text-sm font-medium">Cancel</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setShowAddGoal(true)}
                  className="w-full glass-card rounded-2xl p-4 flex items-center justify-center gap-2 text-sm font-semibold text-primary border-dashed border-primary/30 hover:bg-primary/5 transition-colors">
                  <Plus className="w-4 h-4" />New goal
                </button>
              )}
              {goals.length === 0 ? (
                <div className="glass-card rounded-2xl p-8 text-center">
                  <Trophy className="w-6 h-6 text-primary mx-auto mb-2" />
                  <p className="font-heading font-bold text-base mb-1">Set your first goal</p>
                  <p className="text-muted-foreground text-xs">Track progress and stay accountable.</p>
                </div>
              ) : goals.map(goal => (
                <div key={goal.id} className="glass-card rounded-2xl p-4">
                  <div className="flex items-start justify-between mb-3 gap-2">
                    <div className="flex-1 min-w-0">
                      <p className={cn("font-semibold text-sm", goal.is_complete && "line-through text-muted-foreground")}>
                        {goal.title}
                      </p>
                      {goal.end_date && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Due {format(new Date(goal.end_date), 'MMM d')}
                        </p>
                      )}
                    </div>
                    <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0",
                      goal.is_complete ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground")}>
                      {goal.period_days}d goal
                    </span>
                  </div>
                  <div className="flex items-center justify-end">
                    <button onClick={() => toggleGoal(goal)}
                      className={cn("px-4 py-1.5 rounded-xl text-sm font-semibold transition-colors",
                        goal.is_complete ? "bg-secondary text-muted-foreground" : "bg-primary/20 text-primary hover:bg-primary/30")}>
                      {goal.is_complete ? 'Completed ✓' : 'Mark complete'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}