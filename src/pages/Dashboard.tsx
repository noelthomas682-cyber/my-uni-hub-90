import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { format, isToday, isTomorrow, addDays } from 'date-fns';
import { Calendar, BookOpen, Clock, AlertTriangle, MapPin, ArrowRight } from 'lucide-react';
import type { CalendarEvent, Assignment } from '@/lib/types';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [todayEvents, setTodayEvents] = useState<CalendarEvent[]>([]);
  const [upcomingAssignments, setUpcomingAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();
    const weekEnd = addDays(now, 7).toISOString();

    Promise.all([
      supabase
        .from('calendar_events')
        .select('*')
        .eq('user_id', user.id)
        .gte('start_time', todayStart)
        .lte('start_time', todayEnd)
        .order('start_time'),
      supabase
        .from('assignments')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_complete', false)
        .lte('due_date', weekEnd)
        .order('due_date'),
    ]).then(([eventsRes, assignmentsRes]) => {
      if (eventsRes.data) setTodayEvents(eventsRes.data as CalendarEvent[]);
      if (assignmentsRes.data) setUpcomingAssignments(assignmentsRes.data as Assignment[]);
      setLoading(false);
    });
  }, [user]);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const urgentCount = upcomingAssignments.filter(
    (a) => new Date(a.due_date) < addDays(new Date(), 2)
  ).length;

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {greeting()}{user?.user_metadata?.full_name ? `, ${user.user_metadata.full_name.split(' ')[0]}` : ''} 👋
        </h1>
        <p className="text-muted-foreground">Here's your day at a glance</p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="glass-card">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{todayEvents.length}</p>
              <p className="text-xs text-muted-foreground">Classes today</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-accent" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{upcomingAssignments.length}</p>
              <p className="text-xs text-muted-foreground">Due this week</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{urgentCount}</p>
              <p className="text-xs text-muted-foreground">Due soon</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/lms-settings')}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
              <Clock className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Connect LMS</p>
              <p className="text-xs text-muted-foreground">Sync schedule</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Today's Schedule */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-lg">Today's Schedule</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => navigate('/schedule')}>
            View all <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          ) : todayEvents.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">No classes scheduled today</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate('/lms-settings')}>
                Connect your LMS to import schedule
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {todayEvents.map((event, i) => (
                <div
                  key={event.id}
                  className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 animate-fade-in"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <div className="text-center min-w-[50px]">
                    <p className="text-sm font-semibold text-foreground">
                      {format(new Date(event.start_time), 'HH:mm')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(event.end_time), 'HH:mm')}
                    </p>
                  </div>
                  <div className="w-1 h-10 rounded-full bg-primary" />
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
                  <Badge variant="secondary" className="text-xs">
                    {event.event_type}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upcoming Assignments */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-lg">Upcoming Deadlines</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => navigate('/assignments')}>
            View all <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          ) : upcomingAssignments.length === 0 ? (
            <div className="text-center py-8">
              <BookOpen className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">No upcoming deadlines</p>
            </div>
          ) : (
            <div className="space-y-2">
              {upcomingAssignments.slice(0, 5).map((assignment, i) => {
                const dueDate = new Date(assignment.due_date);
                const isUrgent = dueDate < addDays(new Date(), 2);
                return (
                  <div
                    key={assignment.id}
                    className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 animate-fade-in"
                    style={{ animationDelay: `${i * 50}ms` }}
                  >
                    <div className={`w-2 h-2 rounded-full ${isUrgent ? 'bg-destructive' : 'bg-warning'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{assignment.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {assignment.course_name || assignment.course_code}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`text-xs font-medium ${isUrgent ? 'text-destructive' : 'text-muted-foreground'}`}>
                        {isToday(dueDate) ? 'Today' : isTomorrow(dueDate) ? 'Tomorrow' : format(dueDate, 'MMM d')}
                      </p>
                      <Badge
                        variant="secondary"
                        className="text-xs mt-1"
                      >
                        {assignment.assignment_type}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
