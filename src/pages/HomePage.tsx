import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Flame, Clock, Bell, MessageCircle, Moon, Sparkles, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

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

const ACCENT_COLOURS = [
  'hsl(80 89% 65%)',   // lime
  'hsl(280 70% 70%)',  // purple
  'hsl(20 90% 65%)',   // orange
  'hsl(190 80% 60%)',  // cyan
  'hsl(340 80% 65%)',  // pink
];

export default function HomePage() {
  const { user } = useAuth();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [nightMode, setNightMode] = useState(false);
  const today = new Date();

  useEffect(() => {
    if (!user) return;
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    supabase
      .from('calendar_events')
      .select('*')
      .gte('start_time', startOfDay.toISOString())
      .lte('start_time', endOfDay.toISOString())
      .order('start_time')
      .then(({ data }) => {
        setEvents(data || []);
        setLoading(false);
      });
  }, [user]);

  const totalClassMinutes = events.reduce((acc, e) => {
    const diff = new Date(e.end_time).getTime() - new Date(e.start_time).getTime();
    return acc + diff / 60000;
  }, 0);
  const freeMinutes = Math.max(0, 16 * 60 - totalClassMinutes);
  const freeHours = Math.floor(freeMinutes / 60);
  const freeMin = Math.round(freeMinutes % 60);

  return (
    <div className="px-5 pt-12 pb-4 animate-fade-in">
      {/* Top header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-muted-foreground text-xs uppercase tracking-wider">{format(today, 'EEEE')}</p>
          <h1 className="font-heading text-3xl font-bold leading-tight">
            {format(today, 'MMM d')}
            <span className="text-primary">.</span>
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            aria-label="Messages"
            className="w-10 h-10 rounded-full bg-secondary/70 border border-border/40 flex items-center justify-center hover:bg-secondary transition-colors relative"
          >
            <MessageCircle className="w-[18px] h-[18px] text-foreground" />
            <span className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full" />
          </button>
          <button
            aria-label="Notifications"
            className="w-10 h-10 rounded-full bg-secondary/70 border border-border/40 flex items-center justify-center hover:bg-secondary transition-colors relative"
          >
            <Bell className="w-[18px] h-[18px] text-foreground" />
            <span className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full" />
          </button>
        </div>
      </div>

      {/* Hero card */}
      <div className="relative rounded-3xl p-6 mb-4 overflow-hidden gradient-primary">
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full bg-black/10 blur-2xl" />
        <div className="relative">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-1.5 bg-black/20 backdrop-blur-md px-3 py-1.5 rounded-full">
              <Flame className="w-3.5 h-3.5 text-primary-foreground" />
              <span className="text-primary-foreground text-xs font-bold">1 day streak</span>
            </div>
            <Sparkles className="w-5 h-5 text-primary-foreground/80" />
          </div>
          <p className="text-primary-foreground/70 text-xs uppercase tracking-wider mb-1">Today</p>
          <h2 className="font-heading text-3xl font-bold text-primary-foreground leading-tight mb-4">
            {events.length > 0 ? `${events.length} event${events.length > 1 ? 's' : ''} planned` : 'Your day, your pace.'}
          </h2>
          <div className="flex items-center gap-2 bg-black/20 backdrop-blur-md rounded-2xl px-4 py-3 w-fit">
            <Clock className="w-4 h-4 text-primary-foreground" />
            <div>
              <p className="text-[10px] text-primary-foreground/70 uppercase tracking-wider leading-none">Free time</p>
              <p className="font-heading text-lg font-bold text-primary-foreground leading-tight">{freeHours}h {freeMin}m</p>
            </div>
          </div>
        </div>
      </div>

      {/* Night Mode Button */}
      <button
        onClick={() => setNightMode(!nightMode)}
        className={cn(
          "relative w-full rounded-2xl p-4 mb-6 overflow-hidden transition-all border",
          nightMode
            ? "border-primary/40 shadow-[0_0_30px_-5px_hsl(var(--primary)/0.4)]"
            : "border-border/40"
        )}
        style={{
          background: 'linear-gradient(135deg, hsl(260 50% 12%) 0%, hsl(240 60% 8%) 50%, hsl(280 40% 14%) 100%)',
        }}
      >
        {/* Stars */}
        <div className="absolute inset-0 opacity-60">
          <div className="absolute top-2 left-8 w-1 h-1 bg-white rounded-full" />
          <div className="absolute top-6 left-20 w-0.5 h-0.5 bg-white rounded-full" />
          <div className="absolute top-3 right-12 w-1 h-1 bg-primary rounded-full animate-pulse" />
          <div className="absolute bottom-4 left-32 w-0.5 h-0.5 bg-white rounded-full" />
          <div className="absolute bottom-2 right-20 w-1 h-1 bg-white/70 rounded-full" />
          <div className="absolute top-1/2 right-8 w-0.5 h-0.5 bg-primary rounded-full" />
        </div>
        <div className="relative flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
            <Moon className={cn("w-5 h-5 text-primary transition-transform", nightMode && "rotate-12")} />
          </div>
          <div className="flex-1 text-left">
            <p className="font-heading text-base font-bold text-white leading-tight">
              {nightMode ? "Night mode on" : "Tonight I'm Going Out"}
            </p>
            <p className="text-xs text-white/60 mt-0.5">
              {nightMode ? "We'll keep tomorrow light" : "Tap to enable late-night mode"}
            </p>
          </div>
          <div className={cn(
            "w-11 h-6 rounded-full p-0.5 transition-colors shrink-0",
            nightMode ? "bg-primary" : "bg-white/20"
          )}>
            <div className={cn(
              "w-5 h-5 rounded-full bg-white transition-transform",
              nightMode && "translate-x-5"
            )} />
          </div>
        </div>
      </button>

      {/* Today's Schedule */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-heading text-lg font-bold">Today's Schedule</h2>
        <Link to="/plan" className="text-xs text-primary font-semibold">View all →</Link>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="glass-card rounded-2xl p-4 animate-pulse h-20" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="glass-card rounded-2xl p-8 text-center">
          <Sparkles className="w-6 h-6 text-primary mx-auto mb-2" />
          <p className="font-heading font-bold text-base mb-1">Wide open day</p>
          <p className="text-muted-foreground text-xs">No events scheduled — go make it count.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {events.map((event, idx) => {
            const accent = ACCENT_COLOURS[idx % ACCENT_COLOURS.length];
            return (
              <div
                key={event.id}
                className="glass-card rounded-2xl p-4 flex items-stretch gap-3 relative overflow-hidden"
                style={{ borderLeft: `4px solid ${accent}` }}
              >
                <div className="flex flex-col items-center justify-center min-w-[48px]">
                  <p className="font-heading text-base font-bold leading-none" style={{ color: accent }}>
                    {format(new Date(event.start_time), 'h:mm')}
                  </p>
                  <p className="text-[10px] text-muted-foreground uppercase mt-0.5">
                    {format(new Date(event.start_time), 'a')}
                  </p>
                </div>
                <div className="w-px bg-border/40" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{event.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {event.location && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground min-w-0">
                        <MapPin className="w-3 h-3 shrink-0" />
                        <span className="truncate">{event.location}</span>
                      </div>
                    )}
                    {event.course_code && (
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
                        style={{ backgroundColor: `${accent}20`, color: accent }}
                      >
                        {event.course_code}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
