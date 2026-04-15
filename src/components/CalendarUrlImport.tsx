import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { parseICSFile } from '@/lib/icsParser';
import { Link2, Calendar, BookOpen, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export default function CalendarUrlImport() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [url, setUrl] = useState('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ events: number; assignments: number } | null>(null);

  const handleImport = useCallback(async () => {
    if (!user || !url.trim()) return;

    setImporting(true);
    setResult(null);

    try {
      // Fetch ICS content via edge function (avoids CORS)
      const { data, error } = await supabase.functions.invoke('fetch-ics', {
        body: { url: url.trim() },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      const parsed = parseICSFile(data.content, user.id);

      let eventsInserted = 0;
      let assignmentsInserted = 0;

      if (parsed.events.length > 0) {
        const withId = parsed.events.filter(e => e.external_id);
        const withoutId = parsed.events.filter(e => !e.external_id);
        if (withId.length > 0) {
          const { error } = await supabase
            .from('calendar_events')
            .upsert(withId as any[], { onConflict: 'user_id,external_id' });
          if (error) throw error;
        }
        if (withoutId.length > 0) {
          const { error } = await supabase
            .from('calendar_events')
            .insert(withoutId as any[]);
          if (error) throw error;
        }
        eventsInserted = parsed.events.length;
      }

      if (parsed.assignments.length > 0) {
        const withId = parsed.assignments.filter(a => a.external_id);
        const withoutId = parsed.assignments.filter(a => !a.external_id);
        if (withId.length > 0) {
          const { error } = await supabase
            .from('assignments')
            .upsert(withId as any[], { onConflict: 'user_id,external_id' });
          if (error) throw error;
        }
        if (withoutId.length > 0) {
          const { error } = await supabase
            .from('assignments')
            .insert(withoutId as any[]);
          if (error) throw error;
        }
        assignmentsInserted = parsed.assignments.length;
      }

      setResult({ events: eventsInserted, assignments: assignmentsInserted });
      toast({
        title: 'Import complete!',
        description: `Imported ${eventsInserted} classes and ${assignmentsInserted} assignments from calendar URL.`,
      });
    } catch (err: any) {
      console.error('Calendar URL import error:', err);
      toast({
        title: 'Import failed',
        description: err.message || 'Could not fetch or parse the calendar URL.',
        variant: 'destructive',
      });
    } finally {
      setImporting(false);
    }
  }, [user, url, toast]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Link2 className="w-5 h-5 text-primary" />
          Import from Calendar URL
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Paste your Outlook or university calendar subscription link. The app will fetch your schedule automatically.
        </p>

        {/* How to get the URL */}
        <div className="rounded-lg bg-muted p-4 space-y-2">
          <p className="text-sm font-medium text-foreground">How to get your calendar link:</p>
          <ul className="text-xs text-muted-foreground space-y-1.5">
            <li className="flex items-start gap-2">
              <span className="font-semibold text-foreground min-w-[120px]">Outlook Web:</span>
              Settings → Calendar → Shared calendars → Publish a calendar → Copy the ICS link
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold text-foreground min-w-[120px]">Outlook Desktop:</span>
              Calendar → Home → Share → Publish Online → Copy link
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold text-foreground min-w-[120px]">Google Calendar:</span>
              Settings → Calendar settings → Secret address in iCal format
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold text-foreground min-w-[120px]">Canvas/Moodle:</span>
              Calendar → Calendar Feed / Export → Copy the URL
            </li>
          </ul>
        </div>

        {/* URL input */}
        <div className="flex gap-2">
          <Input
            type="url"
            placeholder="https://outlook.office365.com/owa/calendar/..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={importing}
            className="flex-1"
          />
          <Button onClick={handleImport} disabled={importing || !url.trim()}>
            {importing ? (
              <>
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                Importing...
              </>
            ) : (
              'Import'
            )}
          </Button>
        </div>

        {/* Result */}
        {result && (
          <div className="rounded-lg bg-success/10 p-4 flex items-start gap-3 animate-fade-in">
            <CheckCircle2 className="w-5 h-5 text-success mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">Successfully imported!</p>
              <div className="flex gap-3 mt-1">
                <Badge variant="secondary" className="text-xs">
                  <Calendar className="w-3 h-3 mr-1" /> {result.events} classes
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  <BookOpen className="w-3 h-3 mr-1" /> {result.assignments} assignments
                </Badge>
              </div>
            </div>
          </div>
        )}

        {/* Info note */}
        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <p>
            You can re-import anytime to update your schedule. Duplicates are handled automatically.
            Your calendar link stays private and is not stored.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
