import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { format, isPast, isToday, isTomorrow, addDays } from 'date-fns';
import { BookOpen, CheckCircle2 } from 'lucide-react';
import type { Assignment } from '@/lib/types';

const typeColors: Record<string, string> = {
  assignment: 'bg-primary/10 text-primary',
  quiz: 'bg-accent/10 text-accent',
  exam: 'bg-destructive/10 text-destructive',
  discussion: 'bg-success/10 text-success',
  project: 'bg-warning/10 text-warning',
};

export default function Assignments() {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('assignments')
      .select('*')
      .eq('user_id', user.id)
      .order('due_date')
      .then(({ data }) => {
        if (data) setAssignments(data as Assignment[]);
        setLoading(false);
      });
  }, [user]);

  const toggleComplete = async (id: string, currentState: boolean) => {
    await supabase
      .from('assignments')
      .update({ is_complete: !currentState, completed_at: !currentState ? new Date().toISOString() : null })
      .eq('id', id);
    setAssignments((prev) =>
      prev.map((a) => (a.id === id ? { ...a, is_complete: !currentState } : a))
    );
  };

  const pending = assignments.filter((a) => !a.is_complete);
  const completed = assignments.filter((a) => a.is_complete);

  const formatDue = (date: string) => {
    const d = new Date(date);
    if (isToday(d)) return 'Due today';
    if (isTomorrow(d)) return 'Due tomorrow';
    if (isPast(d)) return `Overdue (${format(d, 'MMM d')})`;
    return `Due ${format(d, 'MMM d')}`;
  };

  const renderAssignment = (a: Assignment, i: number) => {
    const overdue = isPast(new Date(a.due_date)) && !a.is_complete;
    return (
      <div
        key={a.id}
        className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 animate-fade-in"
        style={{ animationDelay: `${i * 40}ms` }}
      >
        <Checkbox
          checked={a.is_complete}
          onCheckedChange={() => toggleComplete(a.id, a.is_complete)}
          className="mt-1"
        />
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${a.is_complete ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
            {a.title}
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            {a.course_name && <span className="text-xs text-muted-foreground">{a.course_name}</span>}
            <Badge className={`text-xs ${typeColors[a.assignment_type] || ''}`}>
              {a.assignment_type}
            </Badge>
            {a.points_possible && (
              <span className="text-xs text-muted-foreground">{a.points_possible} pts</span>
            )}
          </div>
        </div>
        <span className={`text-xs font-medium whitespace-nowrap ${overdue ? 'text-destructive' : 'text-muted-foreground'}`}>
          {formatDue(a.due_date)}
        </span>
      </div>
    );
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Assignments & Deadlines</h1>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({completed.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4">
          <Card>
            <CardContent className="p-4">
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => <div key={i} className="h-14 bg-muted animate-pulse rounded-lg" />)}
                </div>
              ) : pending.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle2 className="w-10 h-10 text-success mx-auto mb-2" />
                  <p className="text-muted-foreground">All caught up!</p>
                </div>
              ) : (
                <div className="space-y-2">{pending.map(renderAssignment)}</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="completed" className="mt-4">
          <Card>
            <CardContent className="p-4">
              {completed.length === 0 ? (
                <div className="text-center py-8">
                  <BookOpen className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">No completed assignments yet</p>
                </div>
              ) : (
                <div className="space-y-2">{completed.map(renderAssignment)}</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
