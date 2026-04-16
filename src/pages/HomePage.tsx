import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Flame, Clock, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface CalendarEvent {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  course_code: string | null;
  location: string | null;
  event_type: string | null;
}

export default function HomePage() {
  const { user } = useAuth();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
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
    <div className="px-5 pt-14 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-muted-foreground text-sm">{format(today, 'EEEE')}</p>
          <h1 className="font-heading text-2xl font-bold">{format(today, 'MMMM d')}</h1>
        </div>
        <div className="flex items-center gap-1.5 bg-primary/10 px-3 py-1.5 rounded-full">
          <Flame className="w-4 h-4 text-primary" />
          <span className="text-primary text-sm font-semibold">1</span>
        </div>
      </div>

      {/* Hero Card */}
      <div className="glass-card rounded-2xl p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading text-lg font-bold">Today's Overview</h2>
          <span className="text-xs text-muted-foreground">{events.length} events</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-secondary/50 rounded-xl p-3">
            <Clock className="w-4 h-4 text-primary mb-1" />
            <p className="text-xs text-muted-foreground">Free time</p>
            <p className="font-heading text-lg font-bold">{freeHours}h {freeMin}m</p>
          </div>
          <div className="bg-secondary/50 rounded-xl p-3">
            <Flame className="w-4 h-4 text-primary mb-1" />
            <p className="text-xs text-muted-foreground">Streak</p>
            <p className="font-heading text-lg font-bold">1 day</p>
          </div>
        </div>
      </div>

      {/* Upcoming Events */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-heading text-base font-bold">Upcoming</h2>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="glass-card rounded-xl p-4 animate-pulse h-16" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="glass-card rounded-xl p-6 text-center">
            <p className="text-muted-foreground text-sm">No events today — enjoy your free time!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {events.map((event) => (
              <div key={event.id} className="glass-card rounded-xl p-4 flex items-center gap-3">
                <div className="w-1 h-10 rounded-full bg-primary" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{event.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(event.start_time), 'h:mm a')} — {format(new Date(event.end_time), 'h:mm a')}
                    {event.location && ` · ${event.location}`}
                  </p>
                </div>
                {event.course_code && (
                  <span className="text-[10px] font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full shrink-0">
                    {event.course_code}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
