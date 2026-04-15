import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { parseICSFile } from '@/lib/icsParser';
import { Upload, FileText, Calendar, BookOpen, CheckCircle2, AlertCircle } from 'lucide-react';

export default function ICSImport() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [dragOver, setDragOver] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ events: number; assignments: number } | null>(null);

  const handleFile = useCallback(async (file: File) => {
    if (!user) return;
    if (!file.name.endsWith('.ics') && !file.name.endsWith('.ical')) {
      toast({ title: 'Invalid file', description: 'Please upload an .ics calendar file.', variant: 'destructive' });
      return;
    }

    setImporting(true);
    setResult(null);

    try {
      const content = await file.text();
      const parsed = parseICSFile(content, user.id);

      let eventsInserted = 0;
      let assignmentsInserted = 0;

      // Split items with and without external_id
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
        description: `Imported ${eventsInserted} classes and ${assignmentsInserted} assignments.`,
      });
    } catch (err: any) {
      console.error('ICS import error:', err);
      toast({
        title: 'Import failed',
        description: err.message || 'Could not parse the ICS file. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setImporting(false);
    }
  }, [user, toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  }, [handleFile]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Upload className="w-5 h-5 text-primary" />
          Import from Calendar File (.ics)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Export your schedule from your LMS as an .ics file, then upload it here. Works with Canvas, Moodle, D2L Brightspace, Blackboard, and any other calendar system.
        </p>

        {/* How to export instructions */}
        <div className="rounded-lg bg-muted p-4 space-y-2">
          <p className="text-sm font-medium text-foreground">How to export your calendar:</p>
          <ul className="text-xs text-muted-foreground space-y-1.5">
            <li className="flex items-start gap-2">
              <span className="font-semibold text-foreground min-w-[80px]">Canvas:</span>
              Calendar → Calendar Feed → Copy link, or use "Export" button
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold text-foreground min-w-[80px]">Moodle:</span>
              Calendar → Export calendar → Select all events → Get calendar URL
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold text-foreground min-w-[80px]">D2L:</span>
              Calendar → Subscribe → Download .ics file
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold text-foreground min-w-[80px]">Blackboard:</span>
              Calendar → Get External Link → Download
            </li>
          </ul>
        </div>

        {/* Upload area */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
            dragOver
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/50 hover:bg-muted/50'
          }`}
        >
          <input
            type="file"
            accept=".ics,.ical"
            onChange={handleInputChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            disabled={importing}
          />
          {importing ? (
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-muted-foreground">Parsing calendar file...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <FileText className="w-10 h-10 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">
                Drop your .ics file here or click to browse
              </p>
              <p className="text-xs text-muted-foreground">
                Supports .ics and .ical calendar files
              </p>
            </div>
          )}
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
            The parser automatically detects classes, assignments, quizzes, and exams from your calendar. 
            You can re-import anytime — duplicates are handled automatically.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
