import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle2, Clock, RefreshCw, WifiOff, ExternalLink, ArrowRight, ChevronDown, ChevronUp } from 'lucide-react';

interface LmsConnection {
  id: string;
  lms_type: string | null;
  lms_name: string | null;
  base_url: string | null;
  is_connected: boolean | null;
  is_active: boolean | null;
  last_synced_at: string | null;
  sync_error: string | null;
  tasks_count: number | null;
  events_count: number | null;
  email_domain: string | null;
}

const UNI_REGISTRY: Record<string, { name: string; calendarUrl: string; portalUrl: string; steps: string[]; lms: string }> = {
  'essex.ac.uk': {
    name: 'University of Essex',
    lms: 'Moodle',
    portalUrl: 'https://moodle.essex.ac.uk/calendar/export.php',
    calendarUrl: 'https://moodle.essex.ac.uk/calendar/export.php',
    steps: [
      'Click the button below to open your Essex Moodle calendar',
      'Select "All events" and set date range to "Custom range"',
      'Click "Get calendar URL" and copy the link',
      'Paste it back here',
    ],
  },
  'manchester.ac.uk': {
    name: 'University of Manchester', lms: 'Blackboard',
    portalUrl: 'https://online.manchester.ac.uk',
    calendarUrl: 'https://online.manchester.ac.uk/webapps/calendar/calendarFeed/url',
    steps: ['Open Manchester Blackboard below', 'Go to My Blackboard → Calendar', 'Click "Get Calendar Feed" and copy the URL', 'Paste it back here'],
  },
  'ucl.ac.uk': {
    name: 'University College London', lms: 'Moodle',
    portalUrl: 'https://moodle.ucl.ac.uk/calendar/export.php',
    calendarUrl: 'https://moodle.ucl.ac.uk/calendar/export.php',
    steps: ['Open UCL Moodle calendar export below', 'Select "All events" and click "Get calendar URL"', 'Copy the URL', 'Paste it back here'],
  },
  'kcl.ac.uk': {
    name: "King's College London", lms: 'Canvas',
    portalUrl: 'https://kcl.instructure.com/profile/settings',
    calendarUrl: 'https://kcl.instructure.com/feeds/calendars',
    steps: ['Open KCL Canvas settings below', 'Scroll to "Other Feeds" → "Calendar Feed"', 'Copy the URL', 'Paste it back here'],
  },
  'imperial.ac.uk': {
    name: 'Imperial College London', lms: 'Blackboard',
    portalUrl: 'https://bb.imperial.ac.uk',
    calendarUrl: 'https://bb.imperial.ac.uk/webapps/calendar/calendarFeed/url',
    steps: ['Open Imperial Blackboard below', 'Go to Calendar → Get Calendar Feed', 'Copy the URL', 'Paste it back here'],
  },
  'ox.ac.uk': {
    name: 'University of Oxford', lms: 'Canvas',
    portalUrl: 'https://canvas.ox.ac.uk/profile/settings',
    calendarUrl: 'https://canvas.ox.ac.uk/feeds/calendars',
    steps: ['Open Oxford Canvas settings below', 'Scroll to "Other Feeds" → "Calendar Feed"', 'Copy the URL', 'Paste it back here'],
  },
  'cam.ac.uk': {
    name: 'University of Cambridge', lms: 'Moodle',
    portalUrl: 'https://www.vle.cam.ac.uk/calendar/export.php',
    calendarUrl: 'https://www.vle.cam.ac.uk/calendar/export.php',
    steps: ['Open Cambridge Moodle calendar export below', 'Select "All events" → "Get calendar URL"', 'Copy the URL', 'Paste it back here'],
  },
  'ed.ac.uk': {
    name: 'University of Edinburgh', lms: 'Learn (Blackboard)',
    portalUrl: 'https://learn.ed.ac.uk',
    calendarUrl: 'https://learn.ed.ac.uk/webapps/calendar/calendarFeed/url',
    steps: ['Open Edinburgh Learn below', 'Go to Calendar → Get Calendar Feed', 'Copy the URL', 'Paste it back here'],
  },
  'birmingham.ac.uk': {
    name: 'University of Birmingham', lms: 'Canvas',
    portalUrl: 'https://canvas.bham.ac.uk/profile/settings',
    calendarUrl: 'https://canvas.bham.ac.uk/feeds/calendars',
    steps: ['Open Birmingham Canvas settings below', 'Scroll to "Calendar Feed"', 'Copy the URL', 'Paste it back here'],
  },
  'leeds.ac.uk': {
    name: 'University of Leeds', lms: 'Minerva (Blackboard)',
    portalUrl: 'https://minerva.leeds.ac.uk',
    calendarUrl: 'https://minerva.leeds.ac.uk/webapps/calendar/calendarFeed/url',
    steps: ['Open Leeds Minerva below', 'Go to Calendar → Get Calendar Feed', 'Copy the URL', 'Paste it back here'],
  },
}

const GENERIC_OUTLOOK = {
  name: 'Your University', lms: 'Outlook',
  portalUrl: 'https://outlook.office365.com/calendar/view/month',
  calendarUrl: 'https://outlook.office365.com/calendar/view/month',
  steps: [
    'Open Outlook Web below',
    'Settings → Calendar → Shared calendars',
    'Publish a calendar → Copy the ICS link',
    'Paste it back here',
  ],
}

function detectUniversity(email: string) {
  const domain = email.split('@')[1]?.toLowerCase()
  if (!domain) return null
  if (UNI_REGISTRY[domain]) return { ...UNI_REGISTRY[domain], domain }
  if (domain.endsWith('.ac.uk') || domain.endsWith('.edu')) return { ...GENERIC_OUTLOOK, name: domain, domain }
  return null
}

export default function LmsSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [connection, setConnection] = useState<LmsConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [email, setEmail] = useState('');
  const [detected, setDetected] = useState<any>(null);
  const [showManual, setShowManual] = useState(false);
  const [calInput, setCalInput] = useState('');
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (!user) return;

    // Auto-detect from user's email
    if (user.email) {
      const uni = detectUniversity(user.email);
      if (uni) setDetected(uni);
    }

    supabase.from('lms_connections').select('*').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => {
        if (data) setConnection(data as LmsConnection);
        setLoading(false);
      });

    const channel = supabase.channel('lms-status')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'lms_connections', filter: 'user_id=eq.' + user.id },
        (payload) => { setConnection(payload.new as LmsConnection); })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const handleEmailDetect = () => {
    const uni = detectUniversity(email);
    if (uni) { setDetected(uni); }
    else {
      toast({ title: 'University not found', description: 'Try the manual Calendar URL method below.', variant: 'destructive' });
      setShowManual(true);
    }
  };

  const handleImportUrl = async () => {
    if (!calInput.trim() || !user) return;
    setImporting(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-ics', {
        body: { url: calInput.trim(), userId: user.id }
      });
      if (error) throw new Error(error.message);
      toast({ title: 'Schedule imported!', description: `Synced ${data?.events || 0} events and ${data?.tasks || 0} tasks.` });
      const { data: conn } = await supabase.from('lms_connections').select('*').eq('user_id', user.id).maybeSingle();
      if (conn) setConnection(conn as LmsConnection);
      setCalInput('');
    } catch (err: any) {
      toast({ title: 'Import failed', description: err.message, variant: 'destructive' });
    }
    setImporting(false);
  };

  const handleResync = async () => {
    if (!connection?.base_url || !user) return;
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-ics', {
        body: { url: connection.base_url, userId: user.id }
      });
      if (error) throw new Error(error.message);
      toast({ title: 'Sync complete!', description: `Updated ${data?.events || 0} events and ${data?.tasks || 0} tasks.` });
      const { data: conn } = await supabase.from('lms_connections').select('*').eq('user_id', user.id).maybeSingle();
      if (conn) setConnection(conn as LmsConnection);
    } catch (err: any) {
      toast({ title: 'Sync failed', description: err.message, variant: 'destructive' });
    }
    setSyncing(false);
  };

  const handleDisconnect = async () => {
    if (!connection) return;
    await supabase.from('lms_connections').delete().eq('id', connection.id);
    setConnection(null);
    toast({ title: 'Disconnected', description: 'LMS connection removed.' });
  };

  const isConnected = connection && (connection.is_connected || connection.is_active);

  return (
    <div className="px-5 pt-14 pb-24 max-w-lg mx-auto space-y-5 animate-fade-in">
      <div>
        <h1 className="font-heading text-2xl font-bold mb-1">Connect Your University</h1>
        <p className="text-muted-foreground text-sm">Sync your classes, assignments, and exams in under 2 minutes</p>
      </div>

      {!loading && isConnected && (
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm">{connection.lms_name || 'Calendar Sync'}</p>
                    <Badge className="bg-green-500/20 text-green-500 text-xs">Connected</Badge>
                  </div>
                  {connection.last_synced_at && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3" /> Last synced: {new Date(connection.last_synced_at).toLocaleString()}
                    </p>
                  )}
                  <div className="flex gap-2 mt-1.5 flex-wrap">
                    {connection.events_count ? <Badge variant="secondary" className="text-xs">{connection.events_count} events</Badge> : null}
                    {connection.tasks_count ? <Badge variant="secondary" className="text-xs">{connection.tasks_count} tasks</Badge> : null}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleResync} disabled={syncing || !connection.base_url}>
                  <RefreshCw className={'w-4 h-4' + (syncing ? ' animate-spin' : '')} />
                </Button>
                <Button variant="ghost" size="sm" onClick={handleDisconnect}>
                  <WifiOff className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {!loading && !isConnected && (
        <div className="space-y-4">
          {!detected && (
            <Card className="glass-card rounded-2xl">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center shrink-0">
                    <span className="text-primary-foreground text-xs font-bold">1</span>
                  </div>
                  <p className="font-semibold text-sm">Enter your university email</p>
                </div>
                <div className="flex gap-2">
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleEmailDetect(); }}
                    placeholder="you@university.ac.uk"
                    className="flex-1 bg-secondary/60 rounded-xl px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40" />
                  <Button onClick={handleEmailDetect} disabled={!email.includes('@')} size="sm" className="px-4">
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {detected && (
            <Card className="glass-card rounded-2xl border-primary/20">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center shrink-0">
                      <span className="text-primary-foreground text-xs font-bold">2</span>
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{detected.name}</p>
                      <p className="text-xs text-muted-foreground">{detected.lms} detected</p>
                    </div>
                  </div>
                  <button onClick={() => setDetected(null)} className="text-xs text-muted-foreground underline">Change</button>
                </div>

                <div className="bg-secondary/40 rounded-xl p-4 space-y-2">
                  {detected.steps.map((step: string, i: number) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-primary text-[10px] font-bold">{i + 1}</span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{step}</p>
                    </div>
                  ))}
                </div>

                <button onClick={() => window.open(detected.portalUrl, '_blank')}
                  className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-xl py-3 text-sm font-semibold hover:opacity-90 transition-opacity">
                  <ExternalLink className="w-4 h-4" />Open {detected.name} Calendar
                </button>

                <div>
                  <p className="text-xs text-muted-foreground mb-2">Paste your calendar URL here:</p>
                  <div className="flex gap-2">
                    <input type="text" value={calInput} onChange={e => setCalInput(e.target.value)}
                      placeholder="Paste your calendar URL..."
                      className="flex-1 bg-secondary/60 rounded-xl px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40" />
                    <Button onClick={handleImportUrl} disabled={!calInput.trim() || importing} size="sm" className="px-4">
                      {importing ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Import'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <button onClick={() => setShowManual(!showManual)}
            className="w-full flex items-center justify-between px-4 py-3 glass-card rounded-2xl text-sm text-muted-foreground">
            <span>My university is not listed / use manual URL</span>
            {showManual ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showManual && (
            <Card className="glass-card rounded-2xl">
              <CardContent className="p-5 space-y-3">
                <p className="text-sm font-semibold">Paste any calendar URL</p>
                <p className="text-xs text-muted-foreground">Works with Outlook, Canvas, Moodle, Blackboard, Google Calendar.</p>
                <div className="space-y-2">
                  {[
                    { platform: 'Outlook Web', path: 'Settings → Calendar → Shared calendars → Publish a calendar → Copy ICS link' },
                    { platform: 'Canvas', path: 'Profile Settings → scroll to Calendar Feed → copy URL' },
                    { platform: 'Moodle', path: 'Calendar → Export calendar → Get calendar URL' },
                    { platform: 'Google Calendar', path: 'Settings → your calendar → Secret address in iCal format' },
                  ].map(item => (
                    <div key={item.platform} className="bg-secondary/40 rounded-lg p-2.5">
                      <p className="text-xs font-medium">{item.platform}</p>
                      <p className="text-xs text-muted-foreground">{item.path}</p>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input type="text" value={calInput} onChange={e => setCalInput(e.target.value)} placeholder="https://..."
                    className="flex-1 bg-secondary/60 rounded-xl px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40" />
                  <Button onClick={handleImportUrl} disabled={!calInput.trim() || importing} size="sm" className="px-4">
                    {importing ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Import'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <Card className="glass-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">What gets imported</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: '📅', name: 'Calendar Events', desc: 'Classes, lectures, seminars' },
              { icon: '📝', name: 'Assignments', desc: 'Due dates and deadlines' },
              { icon: '📊', name: 'Exams & Quizzes', desc: 'Tests and assessments' },
              { icon: '🔄', name: 'Auto Sync', desc: 'Stays up to date' },
            ].map((p) => (
              <div key={p.name} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <span className="text-xl">{p.icon}</span>
                <div>
                  <p className="text-xs font-medium text-foreground">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}