import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfWeek, addDays, isSameDay } from 'date-fns';
import { ChevronLeft, ChevronRight, MapPin, Calendar } from 'lucide-react';
import type { CalendarEvent } from '@/lib/types';

export default function Schedule() {
  const { user } = useAuth();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const start = weekStart.toISOString();
    const end = addDays(weekStart, 7).toISOString();

    supabase
      .from('calendar_events')
      .select('*')
      .eq('user_id', user.id)
      .gte('start_time', start)
      .lt('start_time', end)
      .order('start_time')
      .then(({ data }) => {
        if (data) setEvents(data as CalendarEvent[]);
        setLoading(false);
      });
  }, [user, weekStart]);

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const today = new Date();

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Schedule</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setWeekStart(addDays(weekStart, -7))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}>
            Today
          </Button>
          <Button variant="outline" size="icon" onClick={() => setWeekStart(addDays(weekStart, 7))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <p className="text-muted-foreground">
        {format(weekStart, 'MMM d')} – {format(addDays(weekStart, 6), 'MMM d, yyyy')}
      </p>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />)}
        </div>
      ) : (
        <div className="space-y-4">
          {days.map((day) => {
            const dayEvents = events.filter((e) => isSameDay(new Date(e.start_time), day));
            const isToday = isSameDay(day, today);

            return (
              <Card key={day.toISOString()} className={isToday ? 'border-primary/50 shadow-sm' : ''}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <span className={isToday ? 'text-primary font-bold' : 'text-foreground'}>
                      {format(day, 'EEEE, MMM d')}
                    </span>
                    {isToday && <Badge className="bg-primary text-primary-foreground text-xs">Today</Badge>}
                    <span className="text-muted-foreground text-xs ml-auto">
                      {dayEvents.length} {dayEvents.length === 1 ? 'class' : 'classes'}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {dayEvents.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2">No classes</p>
                  ) : (
                    <div className="space-y-2">
                      {dayEvents.map((event) => (
                        <div key={event.id} className="flex items-center gap-3 p-2 rounded-md bg-muted/50">
                          <div className="text-center min-w-[45px]">
                            <p className="text-xs font-semibold text-foreground">{format(new Date(event.start_time), 'HH:mm')}</p>
                            <p className="text-xs text-muted-foreground">{format(new Date(event.end_time), 'HH:mm')}</p>
                          </div>
                          <div className="w-0.5 h-8 rounded-full bg-primary" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{event.title}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              {event.course_code && <span>{event.course_code}</span>}
                              {event.location && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="w-3 h-3" /> {event.location}
                                </span>
                              )}
                            </div>
                          </div>
                          <Badge variant="secondary" className="text-xs">{event.event_type}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {!loading && events.length === 0 && (
        <div className="text-center py-12">
          <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-lg font-medium text-foreground">No classes this week</p>
          <p className="text-muted-foreground text-sm">Connect your LMS to import your class schedule</p>
        </div>
      )}
    </div>
  );
}
