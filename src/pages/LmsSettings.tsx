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
  last_synced_at: string | null;
  sync_error: string | null;
  tasks_count: number | null;
  events_count: number | null;
  email_domain: string | null;
}

const UNI_REGISTRY: Record<string, {
  name: string;
  lms: string;
  schedulePortalUrl: string;
  scheduleSteps: string[];
  assignmentsPortalUrl: string;
  assignmentsSteps: string[];
}> = {
  'essex.ac.uk': {
    name: 'University of Essex', lms: 'Moodle',
    schedulePortalUrl: 'https://outlook.office365.com/calendar/view/month',
    scheduleSteps: [
      'Open your Essex Outlook calendar',
      'Settings → Calendar → Shared calendars → Publish a calendar',
      'Select your timetable calendar and copy the ICS link',
      'Paste it below',
    ],
    assignmentsPortalUrl: 'https://moodle.essex.ac.uk/calendar/export.php',
    assignmentsSteps: [
      'Open Essex Moodle Calendar Export',
      'Select "All events" · Date range: today → 1 year ahead',
      'Click "Get calendar URL" and copy the link',
      'Paste it below',
    ],
  },
  'manchester.ac.uk': {
    name: 'University of Manchester', lms: 'Blackboard',
    schedulePortalUrl: 'https://outlook.office365.com/calendar/view/month',
    scheduleSteps: [
      'Open your Manchester Outlook calendar',
      'Settings → Calendar → Shared calendars → Publish a calendar',
      'Copy the ICS link and paste it below',
    ],
    assignmentsPortalUrl: 'https://online.manchester.ac.uk',
    assignmentsSteps: [
      'Open Manchester Blackboard',
      'Go to My Blackboard → Calendar',
      'Click "Get Calendar Feed" and copy the URL',
      'Paste it below',
    ],
  },
  'ucl.ac.uk': {
    name: 'University College London', lms: 'Moodle',
    schedulePortalUrl: 'https://outlook.office365.com/calendar/view/month',
    scheduleSteps: [
      'Open your UCL Outlook calendar',
      'Settings → Calendar → Shared calendars → Publish a calendar',
      'Copy the ICS link and paste it below',
    ],
    assignmentsPortalUrl: 'https://moodle.ucl.ac.uk/calendar/export.php',
    assignmentsSteps: [
      'Open UCL Moodle Calendar Export',
      'Select "All events" · Date range: today → 1 year ahead',
      'Click "Get calendar URL" and copy the link',
      'Paste it below',
    ],
  },
  'kcl.ac.uk': {
    name: "King's College London", lms: 'Canvas',
    schedulePortalUrl: 'https://outlook.office365.com/calendar/view/month',
    scheduleSteps: [
      'Open your KCL Outlook calendar',
      'Settings → Calendar → Shared calendars → Publish a calendar',
      'Copy the ICS link and paste it below',
    ],
    assignmentsPortalUrl: 'https://kcl.instructure.com/profile/settings',
    assignmentsSteps: [
      'Open KCL Canvas Profile Settings',
      'Scroll to "Other Feeds" → "Calendar Feed"',
      'Copy the URL and paste it below',
    ],
  },
  'imperial.ac.uk': {
    name: 'Imperial College London', lms: 'Blackboard',
    schedulePortalUrl: 'https://outlook.office365.com/calendar/view/month',
    scheduleSteps: [
      'Open your Imperial Outlook calendar',
      'Settings → Calendar → Shared calendars → Publish a calendar',
      'Copy the ICS link and paste it below',
    ],
    assignmentsPortalUrl: 'https://bb.imperial.ac.uk',
    assignmentsSteps: [
      'Open Imperial Blackboard',
      'Go to Calendar → Get Calendar Feed',
      'Copy the URL and paste it below',
    ],
  },
  'ox.ac.uk': {
    name: 'University of Oxford', lms: 'Canvas',
    schedulePortalUrl: 'https://outlook.office365.com/calendar/view/month',
    scheduleSteps: [
      'Open your Oxford Outlook calendar',
      'Settings → Calendar → Shared calendars → Publish a calendar',
      'Copy the ICS link and paste it below',
    ],
    assignmentsPortalUrl: 'https://canvas.ox.ac.uk/profile/settings',
    assignmentsSteps: [
      'Open Oxford Canvas Profile Settings',
      'Scroll to "Other Feeds" → "Calendar Feed"',
      'Copy the URL and paste it below',
    ],
  },
  'cam.ac.uk': {
    name: 'University of Cambridge', lms: 'Moodle',
    schedulePortalUrl: 'https://outlook.office365.com/calendar/view/month',
    scheduleSteps: [
      'Open your Cambridge Outlook calendar',
      'Settings → Calendar → Shared calendars → Publish a calendar',
      'Copy the ICS link and paste it below',
    ],
    assignmentsPortalUrl: 'https://www.vle.cam.ac.uk/calendar/export.php',
    assignmentsSteps: [
      'Open Cambridge Moodle Calendar Export',
      'Select "All events" · Date range: today → 1 year ahead',
      'Click "Get calendar URL" and copy the link',
      'Paste it below',
    ],
  },
  'ed.ac.uk': {
    name: 'University of Edinburgh', lms: 'Blackboard',
    schedulePortalUrl: 'https://outlook.office365.com/calendar/view/month',
    scheduleSteps: [
      'Open your Edinburgh Outlook calendar',
      'Settings → Calendar → Shared calendars → Publish a calendar',
      'Copy the ICS link and paste it below',
    ],
    assignmentsPortalUrl: 'https://learn.ed.ac.uk',
    assignmentsSteps: [
      'Open Edinburgh Learn (Blackboard)',
      'Go to Calendar → Get Calendar Feed',
      'Copy the URL and paste it below',
    ],
  },
  'birmingham.ac.uk': {
    name: 'University of Birmingham', lms: 'Canvas',
    schedulePortalUrl: 'https://outlook.office365.com/calendar/view/month',
    scheduleSteps: [
      'Open your Birmingham Outlook calendar',
      'Settings → Calendar → Shared calendars → Publish a calendar',
      'Copy the ICS link and paste it below',
    ],
    assignmentsPortalUrl: 'https://canvas.bham.ac.uk/profile/settings',
    assignmentsSteps: [
      'Open Birmingham Canvas Profile Settings',
      'Scroll to "Calendar Feed"',
      'Copy the URL and paste it below',
    ],
  },
  'leeds.ac.uk': {
    name: 'University of Leeds', lms: 'Blackboard',
    schedulePortalUrl: 'https://outlook.office365.com/calendar/view/month',
    scheduleSteps: [
      'Open your Leeds Outlook calendar',
      'Settings → Calendar → Shared calendars → Publish a calendar',
      'Copy the ICS link and paste it below',
    ],
    assignmentsPortalUrl: 'https://minerva.leeds.ac.uk',
    assignmentsSteps: [
      'Open Leeds Minerva (Blackboard)',
      'Go to Calendar → Get Calendar Feed',
      'Copy the URL and paste it below',
    ],
  },
};

const MANUAL_PLATFORMS = [
  {
    platform: 'Outlook Web',
    url: 'https://outlook.office365.com/calendar/view/month',
    path: 'Settings → Calendar → Shared calendars → Publish a calendar → Copy ICS link',
  },
  {
    platform: 'Canvas',
    url: 'https://canvas.instructure.com/profile/settings',
    path: 'Profile Settings → scroll to Calendar Feed → copy URL',
  },
  {
    platform: 'Moodle',
    url: 'https://moodle.org',
    path: 'Calendar → Export calendar → Set date range → Get calendar URL',
  },
  {
    platform: 'Google Calendar',
    url: 'https://calendar.google.com/calendar/r/settings',
    path: 'Settings → your calendar → Secret address in iCal format',
  },
];

function detectUniversity(email: string) {
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return null;
  if (UNI_REGISTRY[domain]) return { ...UNI_REGISTRY[domain], domain };
  if (domain.endsWith('.ac.uk') || domain.endsWith('.edu')) {
    return {
      name: domain, lms: 'Outlook', domain,
      schedulePortalUrl: 'https://outlook.office365.com/calendar/view/month',
      scheduleSteps: [
        'Open your university Outlook calendar',
        'Settings → Calendar → Shared calendars → Publish a calendar',
        'Copy the ICS link and paste it below',
      ],
      assignmentsPortalUrl: 'https://outlook.office365.com/calendar/view/month',
      assignmentsSteps: [
        'Open your university LMS → Calendar',
        'Find Export or Share → ICS / Calendar Feed link',
        'Copy the URL and paste it below',
      ],
    };
  }
  return null;
}

export default function LmsSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [connection, setConnection] = useState<LmsConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [detected, setDetected] = useState<any>(null);
  const [showManual, setShowManual] = useState(false);
  const [scheduleUrl, setScheduleUrl] = useState('');
  const [assignmentsUrl, setAssignmentsUrl] = useState('');
  const [importingSchedule, setImportingSchedule] = useState(false);
  const [importingAssignments, setImportingAssignments] = useState(false);
  const [manualUrl, setManualUrl] = useState('');
  const [importingManual, setImportingManual] = useState(false);

  useEffect(() => {
    if (!user) return;
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

  const handleImport = async (url: string, type: 'schedule' | 'assignments' | 'manual') => {
    if (!url.trim() || !user) return;
    if (type === 'schedule') setImportingSchedule(true);
    else if (type === 'assignments') setImportingAssignments(true);
    else setImportingManual(true);

    try {
      const { data, error } = await supabase.functions.invoke('fetch-ics', {
        body: { url: url.trim(), userId: user.id }
      });
      if (error) throw new Error(error.message);
      const domain = user.email?.split('@')[1]?.toLowerCase() || '';
      await supabase.from('lms_connections').upsert({
        user_id: user.id,
        email_domain: domain,
        lms_type: 'ics',
        lms_name: detected?.name || 'Calendar Sync',
        base_url: url.trim(),
        auth_method: 'none',
        is_connected: true,
      }, { onConflict: 'user_id' });
      toast({ title: 'Imported!', description: `Synced ${data?.events || 0} events and ${data?.tasks || 0} tasks.` });
      const { data: conn } = await supabase.from('lms_connections').select('*').eq('user_id', user.id).maybeSingle();
      if (conn) setConnection(conn as LmsConnection);
      if (type === 'schedule') setScheduleUrl('');
      else if (type === 'assignments') setAssignmentsUrl('');
      else setManualUrl('');
    } catch {
      toast({ title: 'Import failed', description: 'Could not import calendar. Check the URL and try again.', variant: 'destructive' });
    }
    if (type === 'schedule') setImportingSchedule(false);
    else if (type === 'assignments') setImportingAssignments(false);
    else setImportingManual(false);
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
    } catch {
      toast({ title: 'Sync failed', description: 'Could not sync. Please try again.', variant: 'destructive' });
    }
    setSyncing(false);
  };

  const handleDisconnect = async () => {
    if (!connection) return;
    await supabase.from('lms_connections').delete().eq('id', connection.id);
    setConnection(null);
    toast({ title: 'Disconnected', description: 'LMS connection removed.' });
  };

  const isConnected = connection?.is_connected === true;

  return (
    <div className="px-5 pt-14 pb-24 max-w-lg mx-auto space-y-5 animate-fade-in">
      <div>
        <h1 className="font-heading text-2xl font-bold mb-1">Connect Your University</h1>
        <p className="text-muted-foreground text-sm">Sync your classes, assignments, and exams in under 2 minutes</p>
      </div>

      {/* ── Connected State ── */}
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

      {/* ── Not Connected ── */}
      {!loading && !isConnected && detected && (
        <div className="space-y-4">

          {/* Schedule Card */}
          <Card className="glass-card rounded-2xl border-primary/20">
            <CardContent className="p-5 space-y-3">
              <div>
                <p className="font-semibold text-sm">📅 Schedule / Timetable</p>
                <p className="text-xs text-muted-foreground">Lectures, classes and seminars from Outlook</p>
              </div>
              <div className="bg-secondary/40 rounded-xl p-3 space-y-2">
                {detected.scheduleSteps.map((step: string, i: number) => (
                  <div key={i} className="flex items-start gap-2">
                    <div className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-primary text-[9px] font-bold">{i + 1}</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{step}</p>
                  </div>
                ))}
              </div>
              <button
                onClick={() => window.open(detected.schedulePortalUrl, '_blank')}
                className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-xl py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity">
                <ExternalLink className="w-4 h-4" />Open {detected.name} Outlook
              </button>
              <div className="flex gap-2">
                <input type="text" value={scheduleUrl} onChange={e => setScheduleUrl(e.target.value)}
                  placeholder="Paste Outlook ICS URL..."
                  className="flex-1 bg-secondary/60 rounded-xl px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40" />
                <Button onClick={() => handleImport(scheduleUrl, 'schedule')} disabled={!scheduleUrl.trim() || importingSchedule} size="sm" className="px-4">
                  {importingSchedule ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Import'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Assignments Card */}
          <Card className="glass-card rounded-2xl border-primary/20">
            <CardContent className="p-5 space-y-3">
              <div>
                <p className="font-semibold text-sm">📝 Assignments / Tasks</p>
                <p className="text-xs text-muted-foreground">Deadlines and coursework from {detected.lms}</p>
              </div>
              <div className="bg-secondary/40 rounded-xl p-3 space-y-2">
                {detected.assignmentsSteps.map((step: string, i: number) => (
                  <div key={i} className="flex items-start gap-2">
                    <div className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-primary text-[9px] font-bold">{i + 1}</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{step}</p>
                  </div>
                ))}
              </div>
              <button
                onClick={() => window.open(detected.assignmentsPortalUrl, '_blank')}
                className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-xl py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity">
                <ExternalLink className="w-4 h-4" />Open {detected.name} {detected.lms}
              </button>
              <div className="flex gap-2">
                <input type="text" value={assignmentsUrl} onChange={e => setAssignmentsUrl(e.target.value)}
                  placeholder={`Paste ${detected.lms} calendar URL...`}
                  className="flex-1 bg-secondary/60 rounded-xl px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40" />
                <Button onClick={() => handleImport(assignmentsUrl, 'assignments')} disabled={!assignmentsUrl.trim() || importingAssignments} size="sm" className="px-4">
                  {importingAssignments ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Import'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Manual / Not detected ── */}
      {!loading && !isConnected && (
        <>
          <button onClick={() => setShowManual(!showManual)}
            className="w-full flex items-center justify-between px-4 py-3 glass-card rounded-2xl text-sm text-muted-foreground">
            <span>{detected ? 'My university is not listed / use manual URL' : 'Connect manually'}</span>
            {showManual ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showManual && (
            <Card className="glass-card rounded-2xl">
              <CardContent className="p-5 space-y-3">
                <p className="text-sm font-semibold">Paste any calendar URL</p>
                <p className="text-xs text-muted-foreground">Works with Outlook, Canvas, Moodle, Blackboard, Google Calendar. Click a platform to open it.</p>
                <div className="space-y-2">
                  {MANUAL_PLATFORMS.map(item => (
                    <button
                      key={item.platform}
                      onClick={() => window.open(item.url, '_blank')}
                      className="w-full bg-secondary/40 rounded-lg p-3 text-left hover:bg-secondary/60 transition-colors flex items-center justify-between group">
                      <div>
                        <p className="text-xs font-semibold text-foreground">{item.platform}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{item.path}</p>
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors shrink-0 ml-2" />
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input type="text" value={manualUrl} onChange={e => setManualUrl(e.target.value)} placeholder="https://..."
                    className="flex-1 bg-secondary/60 rounded-xl px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40" />
                  <Button onClick={() => handleImport(manualUrl, 'manual')} disabled={!manualUrl.trim() || importingManual} size="sm" className="px-4">
                    {importingManual ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Import'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* ── What gets imported ── */}
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