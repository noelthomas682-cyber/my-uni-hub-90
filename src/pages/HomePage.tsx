import { useEffect, useState } from 'react';
import { format, isToday, isPast, differenceInDays } from 'date-fns';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { Moon, Plus, Bell, MessageCircle, Zap } from 'lucide-react';
import { toast } from 'sonner';

interface CalendarEvent {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  course_code: string | null;
  location: string | null;
  event_type: string | null;
  colour: string | null;
}

interface Task {
  id: string;
  title: string;
  due_date: string | null;
  is_complete: boolean;
  priority: string | null;
  category: string | null;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

const EVENT_TYPE_COLOURS: Record<string, string> = {
  lecture: '#a78bfa',
  seminar: '#f59e0b',
  sport: '#34d399',
  society: '#fb923c',
  study: '#a3e635',
  default: '#60a5fa',
};

function getEventColour(type: string | null) {
  if (!type) return EVENT_TYPE_COLOURS.default;
  return EVENT_TYPE_COLOURS[type.toLowerCase()] || EVENT_TYPE_COLOURS.default;
}

function getEventTypeLabel(type: string | null) {
  if (!type) return null;
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function formatTime(time: string) {
  const [h, m] = time.split(':');
  const hour = parseInt(h);
  const ampm = hour >= 12 ? 'pm' : 'am';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${m}${ampm}`;
}

const ACTIVITY_EMOJIS: Record<string, string> = {
  'Gym': '🏋️', 'Running': '🏃', 'Soccer': '⚽', 'Basketball': '🏀',
  'Swimming': '🏊', 'Piano': '🎹', 'Guitar': '🎸', 'Reading': '📚',
  'Gaming': '🎮', 'Cooking': '🍳', 'Yoga': '🧘', 'Cycling': '🚴',
  'Dancing': '💃', 'Art': '🎨', 'Meditation': '🧠',
};

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

function getTaskColour(status: string) {
  switch (status) {
    case 'overdue': return { dot: 'bg-red-500', text: 'text-red-400', badge: 'bg-red-500/10 text-red-400' };
    case 'today': return { dot: 'bg-yellow-400', text: 'text-yellow-400', badge: 'bg-yellow-400/10 text-yellow-400' };
    case 'soon': return { dot: 'bg-orange-400', text: 'text-orange-400', badge: 'bg-orange-400/10 text-orange-400' };
    default: return { dot: 'bg-white/20', text: 'text-white/40', badge: 'bg-white/5 text-white/40' };
  }
}

export default function HomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [teams, setTeams] = useState<any[]>([]);
  const [sleepSchedule, setSleepSchedule] = useState<any>(null);
  const [activities, setActivities] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [nightMode, setNightMode] = useState(false);
  const today = new Date();

  useEffect(() => {
    if (!user) return;

    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);
    const in30Days = new Date(today);
    in30Days.setDate(today.getDate() + 30);

    supabase.from('profiles')
      .select('full_name, university, streak_count, activities')
      .eq('id', user.id).single()
      .then(({ data }) => {
        if (data) {
          setProfile(data);
          if (data.activities) setActivities(data.activities);
        }
      });

    supabase.from('sleep_schedule')
      .select('sleep_time, wake_time')
      .eq('user_id', user.id).single()
      .then(({ data }) => { if (data) setSleepSchedule(data); });

    supabase.from('calendar_events').select('*')
      .eq('user_id', user.id)
      .gte('start_time', startOfDay.toISOString())
      .lte('start_time', endOfDay.toISOString())
      .order('start_time')
      .then(({ data }) => { setEvents(data || []); setLoading(false); });

    // Fetch overdue + upcoming tasks (no lower date bound)
    supabase.from('tasks').select('*')
      .eq('user_id', user.id)
      .eq('is_complete', false)
      .not('due_date', 'is', null)
      .lte('due_date', in30Days.toISOString())
      .order('due_date').limit(10)
      .then(({ data }) => { setTasks(data || []); });

    supabase.from('team_members')
      .select('team_id, role')
      .eq('user_id', user.id)
      .then(async ({ data: memberships }) => {
        if (!memberships || memberships.length === 0) return;
        const teamIds = memberships.map((m: any) => m.team_id);
        const { data: teamsData } = await supabase
          .from('teams').select('*').in('id', teamIds);
        const merged = (teamsData || []).map((t: any) => {
          const m = memberships.find((mm: any) => mm.team_id === t.id);
          return { ...t, myRole: m?.role || 'member' };
        });
        setTeams(merged);
      });
  }, [user]);

  const firstName = profile?.full_name?.split(' ')[0] || '';
  const streak = profile?.streak_count || 0;

  const totalClassMinutes = events.reduce((acc, e) => {
    if (!e.end_time) return acc;
    return acc + (new Date(e.end_time).getTime() - new Date(e.start_time).getTime()) / 60000;
  }, 0);
  const freeMinutes = Math.max(0, 16 * 60 - totalClassMinutes);
  const freeHours = Math.floor(freeMinutes / 60);
  const freeMin = Math.round(freeMinutes % 60);

  const todayDeadlines = tasks.filter(t => t.due_date && isToday(new Date(t.due_date)));
  const overdueTasks = tasks.filter(t => t.due_date && isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date)));
  const tasksDone = 0;

  return (
    <div className="pb-28 animate-fade-in bg-background min-h-screen">

      {/* ── Top Bar ── */}
      <div className="flex items-center justify-between px-4 pt-12 pb-3">
        <div className="flex items-center gap-2">
          <span className="font-heading text-xl font-black text-primary tracking-tight">rute</span>
          <button
            onClick={() => navigate('/chat')}
            className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
            <MessageCircle className="w-4 h-4 text-muted-foreground" />
          </button>
          <span className="text-base font-semibold text-foreground">Home</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/plan')}
            className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center">
            <Plus className="w-4 h-4 text-foreground" />
          </button>
          <button
            onClick={() => toast('No new notifications')}
            className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center relative">
            <Bell className="w-4 h-4 text-foreground" />
            {(todayDeadlines.length > 0 || overdueTasks.length > 0) && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
            )}
          </button>
        </div>
      </div>

      <div className="px-4 space-y-3">

        {/* ── Tonight I'm Going Out ── */}
        <button
          onClick={() => setNightMode(!nightMode)}
          className={cn(
            'relative w-full rounded-2xl p-4 overflow-hidden transition-all border text-left',
            nightMode ? 'border-primary/30' : 'border-white/5'
          )}
          style={{ background: 'linear-gradient(135deg, hsl(260 50% 10%) 0%, hsl(240 60% 7%) 50%, hsl(280 40% 12%) 100%)' }}
        >
          <div className="absolute inset-0 opacity-50">
            {[[20,15],[60,30],[80,10],[35,60],[90,50],[15,75]].map(([l,t], i) => (
              <div key={i} className="absolute w-0.5 h-0.5 bg-white rounded-full"
                style={{ left: `${l}%`, top: `${t}%` }} />
            ))}
          </div>
          <div className="relative flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Moon className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-white text-sm leading-tight">
                {nightMode ? 'Night mode on' : "Tonight I'm Going Out"}
              </p>
              <p className="text-[11px] text-white/50 mt-0.5">
                {nightMode ? "We'll keep tomorrow light" : 'Suggestions cleared · Study rescheduled · Night yours'}
              </p>
            </div>
            {nightMode ? (
              <span className="text-xs text-primary font-semibold shrink-0">Active</span>
            ) : (
              <span className="text-xs text-white/40 font-medium shrink-0 border border-white/10 px-2 py-1 rounded-full">
                Tap when going out
              </span>
            )}
          </div>
        </button>

        {/* ── Hero Card ── */}
        <div className="rounded-2xl p-5 relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, hsl(120 30% 8%) 0%, hsl(140 25% 10%) 100%)' }}>
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-[10px] text-primary/60 uppercase tracking-widest font-bold mb-1">
                Week · {format(today, 'MMMM yyyy')}
              </p>
              <h1 className="font-heading text-4xl font-black text-white leading-none">
                {format(today, 'EEEE')}
              </h1>
              <p className="text-sm text-white/40 mt-1">{format(today, 'd MMMM yyyy')}</p>
            </div>
            {streak > 0 && (
              <div className="bg-black/30 rounded-2xl px-3 py-2 text-center border border-white/5">
                <span className="text-2xl">🔥</span>
                <p className="font-heading text-xl font-black text-white leading-none">{streak}</p>
                <p className="text-[9px] text-white/40 uppercase tracking-wider mt-0.5">Day Streak</p>
              </div>
            )}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-black/20 rounded-xl p-3 border border-white/5">
              <p className="font-heading text-2xl font-black text-primary leading-none">
                {freeHours > 0 ? `${freeHours}.${Math.round(freeMin/6)}h` : `${freeMin}m`}
              </p>
              <p className="text-[10px] text-white/40 uppercase tracking-wider mt-1">Free Today</p>
            </div>
            <div className="bg-black/20 rounded-xl p-3 border border-white/5">
              <p className="font-heading text-2xl font-black text-yellow-400 leading-none">
                {todayDeadlines.length}
              </p>
              <p className="text-[10px] text-white/40 uppercase tracking-wider mt-1">Due Today</p>
            </div>
            <div className="bg-black/20 rounded-xl p-3 border border-white/5">
              <p className="font-heading text-2xl font-black text-red-400 leading-none">
                {overdueTasks.length}
              </p>
              <p className="text-[10px] text-white/40 uppercase tracking-wider mt-1">Overdue</p>
            </div>
          </div>
        </div>

        {/* ── Sleep & Activities ── */}
        {(sleepSchedule || activities.length > 0) && (
          <div className="rounded-2xl p-4 space-y-3"
            style={{ background: 'linear-gradient(135deg, hsl(240 30% 8%) 0%, hsl(260 25% 10%) 100%)' }}>
            {sleepSchedule && (
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Moon className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold">Sleep Schedule</p>
                  <p className="text-sm font-semibold text-white mt-0.5">
                    {formatTime(sleepSchedule.sleep_time)} → {formatTime(sleepSchedule.wake_time)}
                  </p>
                </div>
              </div>
            )}
            {activities.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-3.5 h-3.5 text-primary" />
                  <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold">Make Time For</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {activities.map((a: string) => (
                    <span key={a}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-white/70">
                      <span>{ACTIVITY_EMOJIS[a] || '✨'}</span>
                      {a}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Tasks (overdue + upcoming) ── */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold">Tasks & Deadlines</p>
            <Link to="/plan" className="text-[10px] text-white/30 hover:text-primary transition-colors">
              See all →
            </Link>
          </div>

          {tasks.length === 0 ? (
            <div className="glass-card rounded-2xl p-5 text-center">
              <p className="font-heading font-bold text-sm mb-1">No tasks yet</p>
              <p className="text-muted-foreground text-xs">Sync your LMS or add tasks manually</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {tasks.map((task) => {
                const status = getTaskStatus(task.due_date!);
                const label = getTaskLabel(task.due_date!);
                const colours = getTaskColour(status);
                return (
                  <div key={task.id}
                    className="flex items-center gap-3 glass-card rounded-xl px-3 py-3">
                    <div className={cn('w-2 h-2 rounded-full shrink-0', colours.dot)} />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-white leading-tight truncate">
                        {task.title}
                      </p>
                    </div>
                    <span className={cn('text-[10px] font-bold px-2 py-1 rounded-full shrink-0', colours.badge)}>
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── No schedule prompt ── */}
        {!loading && events.length === 0 && (
          <button
            onClick={() => navigate('/lms-settings')}
            className="w-full rounded-2xl p-4 border border-primary/20 text-left"
            style={{ background: 'linear-gradient(135deg, hsl(260 30% 8%) 0%, hsl(280 25% 10%) 100%)' }}>
            <p className="font-bold text-sm text-white">No classes today 📅</p>
            <p className="text-xs text-white/40 mt-1">Connect your LMS to sync your timetable and deadlines →</p>
          </button>
        )}

        {/* ── TODAY Schedule ── */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold">Today</p>
            <Link to="/plan" className="text-[10px] text-white/30 hover:text-primary transition-colors">
              Full schedule →
            </Link>
          </div>

          {loading ? (
            <div className="space-y-2">
              {[1,2,3].map(i => <div key={i} className="glass-card rounded-xl p-4 animate-pulse h-16" />)}
            </div>
          ) : events.length === 0 ? (
            <div className="glass-card rounded-2xl p-6 text-center">
              <p className="font-heading font-bold text-base mb-1">Wide open day</p>
              <p className="text-muted-foreground text-xs">No classes scheduled — go make it count.</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {events.map((event) => {
                const colour = event.colour || getEventColour(event.event_type);
                const label = getEventTypeLabel(event.event_type);
                return (
                  <div key={event.id}
                    className="flex items-stretch gap-3 glass-card rounded-xl px-3 py-3">
                    <div className="flex flex-col justify-center min-w-[40px]">
                      <p className="text-xs font-bold text-white/60 leading-none">
                        {format(new Date(event.start_time), 'HH:mm')}
                      </p>
                    </div>
                    <div className="w-0.5 rounded-full shrink-0 self-stretch"
                      style={{ backgroundColor: colour }} />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-white leading-tight truncate">
                        {event.title}
                      </p>
                      <p className="text-xs text-white/40 mt-0.5 truncate">
                        {[event.location, event.course_code].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    {label && (
                      <span className="text-[10px] font-bold px-2 py-1 rounded-full self-center shrink-0"
                        style={{ backgroundColor: `${colour}20`, color: colour }}>
                        {label}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── AI Suggestions ── */}
        <div>
          <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold mb-2">
            Suggestions
          </p>
          <div className="glass-card rounded-2xl p-4 text-center">
            <p className="text-xs text-muted-foreground">
              AI suggestions will appear here once your timetable is connected
            </p>
          </div>
        </div>

        {/* ── Teams & Societies ── */}
        {teams.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold">
                Your Teams & Societies
              </p>
              <Link to="/social" className="text-[10px] text-white/30 hover:text-primary transition-colors">
                See all →
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {teams.slice(0, 4).map(team => (
                <button key={team.id} onClick={() => navigate('/social')}
                  className="glass-card rounded-2xl p-4 text-left hover:bg-white/5 transition-colors">
                  <span className="text-3xl">{team.emoji || '🏆'}</span>
                  <p className="font-bold text-sm text-white mt-2 leading-tight">{team.name}</p>
                  {team.sport && <p className="text-xs text-white/40 mt-0.5">{team.sport}</p>}
                  <p className="text-[10px] text-primary mt-2">→ Team Hub</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Upgrade Banner ── */}
        <div className="rounded-2xl p-4 flex items-center gap-3 border border-yellow-500/20"
          style={{ background: 'linear-gradient(135deg, hsl(45 50% 8%) 0%, hsl(30 40% 6%) 100%)' }}>
          <span className="text-xl shrink-0">⭐</span>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm text-white leading-tight">
              Buy me a meal — I've got you for 4 months
            </p>
            <p className="text-[11px] text-white/40 mt-0.5">
              £12.99 semester · Everything unlocked · No ads
            </p>
          </div>
          <button className="shrink-0 bg-primary text-black text-xs font-black px-3 py-2 rounded-xl">
            Get it
          </button>
        </div>

      </div>
    </div>
  );
}