// src/pages/LmsSettings.tsx
//
// PURPOSE: Allows students to connect or reconnect their university
// calendar and LMS after onboarding. Also used when a student wants
// to update their calendar URL or force a resync.
//
// HOW IT WORKS:
//   1. On mount, loads the student's existing lms_connections record
//   2. Looks up their domain in university_registry to get portal links
//      and instructions — same data used in Onboarding.tsx
//   3. If connected → shows sync status + resync/disconnect options
//   4. If not connected → shows portal links + import forms
//   5. Manual fallback available for any university not in registry
//
// READS FROM:  university_registry, lms_connections (Supabase)
// WRITES TO:   lms_connections (Supabase)
// SHARED WITH: Onboarding.tsx uses same LMS_INSTRUCTIONS + SCHEDULE_INSTRUCTIONS constants

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  CheckCircle2, Clock, RefreshCw, WifiOff,
  ExternalLink, ChevronDown, ChevronUp,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

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

// University data loaded from university_registry DB.
// Same shape as what detect-lms Edge Function returns.
interface UniInfo {
  name: string;
  domain: string;
  lms_type: string;
  lms_instance_url: string | null;
  email_system: string;
  calendar_type: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────
//
// LMS and schedule instructions — same as Onboarding.tsx.
// These are keyed by lms_type / email_system from university_registry.
// Adding a new university to the DB automatically picks up these instructions.

const LMS_INSTRUCTIONS: Record<string, {
  assignmentsPortalPath: string;
  steps: string[];
  placeholder: string;
}> = {
  moodle: {
    assignmentsPortalPath: '/calendar/export.php',
    steps: [
      'Open your university Moodle site',
      'Click Calendar (top menu) → Export Calendar',
      'Set "All events" and date range: today → 1 year ahead',
      'Click "Get calendar URL" and paste it below',
    ],
    placeholder: 'Paste Moodle calendar URL...',
  },
  canvas: {
    assignmentsPortalPath: '/profile/settings',
    steps: [
      'Open your university Canvas site',
      'Go to Account → Profile → Settings',
      'Scroll to "Other Feeds" → click "Calendar Feed"',
      'Copy the URL and paste it below',
    ],
    placeholder: 'Paste Canvas calendar feed URL...',
  },
  blackboard: {
    assignmentsPortalPath: '/',
    steps: [
      'Open your university Blackboard site',
      'Go to Calendar (left sidebar or Tools menu)',
      'Click "Get Calendar Feed" or "Subscribe"',
      'Copy the ICS URL and paste it below',
    ],
    placeholder: 'Paste Blackboard calendar URL...',
  },
  d2l: {
    assignmentsPortalPath: '/d2l/le/calendar/feed/subscribe',
    steps: [
      'Open your university D2L Brightspace site',
      'Click the Calendar icon in the top navigation',
      'Click Subscribe and copy the calendar URL',
      'Paste it below',
    ],
    placeholder: 'Paste D2L calendar URL...',
  },
  default: {
    assignmentsPortalPath: '/',
    steps: [
      'Open your university LMS (Moodle, Canvas, Blackboard, or D2L)',
      'Go to Calendar → Export or Subscribe',
      'Copy the ICS/calendar URL and paste it below',
    ],
    placeholder: 'Paste LMS calendar URL...',
  },
};

const SCHEDULE_INSTRUCTIONS: Record<string, {
  portalUrl: string;
  steps: string[];
  buttonLabel: string;
  placeholder: string;
}> = {
  microsoft: {
    portalUrl: 'https://outlook.office365.com/calendar/view/month',
    steps: [
      'Open your university Outlook calendar',
      'Go to Settings → Calendar → Shared calendars → Publish a calendar',
      'Select your timetable calendar and copy the ICS link',
      'Paste it below',
    ],
    buttonLabel: 'Open Outlook Calendar',
    placeholder: 'Paste Outlook ICS URL...',
  },
  google: {
    portalUrl: 'https://calendar.google.com',
    steps: [
      'Open your university Google Calendar',
      'Click the three dots next to your timetable → Settings and sharing',
      'Scroll to "Integrate calendar" → copy "Secret address in iCal format"',
      'Paste it below',
    ],
    buttonLabel: 'Open Google Calendar',
    placeholder: 'Paste Google Calendar ICS URL...',
  },
  unknown: {
    portalUrl: 'https://outlook.office365.com/calendar/view/month',
    steps: [
      'Open your university calendar (Outlook or Google)',
      'Find the calendar sharing or export settings',
      'Copy the ICS link and paste it below',
    ],
    buttonLabel: 'Open Calendar',
    placeholder: 'Paste calendar ICS URL...',
  },
};

// Manual platform options — shown when no university is detected
// or when student clicks "connect manually"
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
  {
    platform: 'D2L Brightspace',
    url: 'https://www.d2l.com',
    path: 'Calendar → Subscribe → Copy the calendar URL',
  },
  {
    platform: 'Blackboard',
    url: 'https://www.anthology.com/products/teaching-and-learning/learning-effectiveness/blackboard-learn',
    path: 'Calendar → Get Calendar Feed → Copy URL',
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDomain(email: string): string | null {
  return email.split('@')[1]?.toLowerCase() || null;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function LmsSettings() {
  const { user } = useAuth();
  const { toast } = useToast();

  // ── State ─────────────────────────────────────────────────────────────────
  const [connection, setConnection] = useState<LmsConnection | null>(null);
  const [uniInfo, setUniInfo]       = useState<UniInfo | null>(null);
  const [loading, setLoading]       = useState(true);
  const [syncing, setSyncing]       = useState(false);
  const [showManual, setShowManual] = useState(false);

  // Import form state
  const [scheduleUrl,         setScheduleUrl]         = useState('');
  const [assignmentsUrl,      setAssignmentsUrl]      = useState('');
  const [manualUrl,           setManualUrl]           = useState('');
  const [importingSchedule,   setImportingSchedule]   = useState(false);
  const [importingAssignments,setImportingAssignments]= useState(false);
  const [importingManual,     setImportingManual]     = useState(false);

  // ── Initialisation ────────────────────────────────────────────────────────
  // Load existing connection + look up university info from DB.
  // Also subscribes to realtime updates on lms_connections so sync
  // status updates appear instantly without a page refresh.

  useEffect(() => {
    if (!user) return;

    const domain = getDomain(user.email || '');

    // Load university info from university_registry DB.
    // This replaces the hardcoded UNI_REGISTRY object —
    // data now comes from the DB which is managed via /admin.
    if (domain) {
      supabase
        .from('university_registry')
        .select('name, domain, lms_type, lms_instance_url, email_system, calendar_type')
        .eq('domain', domain)
        .eq('is_active', true)
        .maybeSingle()
        .then(({ data }) => {
          if (data) setUniInfo(data as UniInfo);
        });
    }

    // Load existing LMS connection for this user
    supabase
      .from('lms_connections')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setConnection(data as LmsConnection);
        setLoading(false);
      });

    // Realtime subscription — updates sync status when fetch-ics completes
    const channel = supabase
      .channel('lms-status')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'lms_connections',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        setConnection(payload.new as LmsConnection);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // ── Actions ───────────────────────────────────────────────────────────────

  // Imports a calendar URL via the fetch-ics Edge Function.
  // Saves the connection to lms_connections on success.
  const handleImport = async (url: string, type: 'schedule' | 'assignments' | 'manual') => {
    if (!url.trim() || !user) return;

    if (type === 'schedule')    setImportingSchedule(true);
    else if (type === 'assignments') setImportingAssignments(true);
    else                        setImportingManual(true);

    try {
      const { data, error } = await supabase.functions.invoke('fetch-ics', {
        body: { url: url.trim(), userId: user.id },
      });
      if (error) throw new Error(error.message);

      const domain = getDomain(user.email || '') || '';

      // Save confirmed connection to lms_connections
      await supabase.from('lms_connections').upsert({
        user_id:      user.id,
        email_domain: domain,
        lms_type:     uniInfo?.lms_type || 'ics',
        lms_name:     uniInfo?.name || 'Calendar Sync',
        base_url:     url.trim(),
        auth_method:  'none',
        is_connected: true,
      }, { onConflict: 'user_id' });

      toast({
        title: 'Imported!',
        description: `Synced ${data?.events || 0} events and ${data?.tasks || 0} tasks.`,
      });

      // Reload connection to show updated counts
      const { data: conn } = await supabase
        .from('lms_connections')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (conn) setConnection(conn as LmsConnection);

      if (type === 'schedule')         setScheduleUrl('');
      else if (type === 'assignments') setAssignmentsUrl('');
      else                             setManualUrl('');
    } catch {
      toast({
        title: 'Import failed',
        description: 'Could not import calendar. Check the URL and try again.',
        variant: 'destructive',
      });
    }

    if (type === 'schedule')         setImportingSchedule(false);
    else if (type === 'assignments') setImportingAssignments(false);
    else                             setImportingManual(false);
  };

  // Re-runs fetch-ics with the stored URL to pull latest data
  const handleResync = async () => {
    if (!connection?.base_url || !user) return;
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-ics', {
        body: { url: connection.base_url, userId: user.id },
      });
      if (error) throw new Error(error.message);
      toast({
        title: 'Sync complete!',
        description: `Updated ${data?.events || 0} events and ${data?.tasks || 0} tasks.`,
      });
      const { data: conn } = await supabase
        .from('lms_connections')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (conn) setConnection(conn as LmsConnection);
    } catch {
      toast({
        title: 'Sync failed',
        description: 'Could not sync. Please try again.',
        variant: 'destructive',
      });
    }
    setSyncing(false);
  };

  const handleDisconnect = async () => {
    if (!connection) return;
    await supabase.from('lms_connections').delete().eq('id', connection.id);
    setConnection(null);
    toast({ title: 'Disconnected', description: 'LMS connection removed.' });
  };

  // ── Derived values ────────────────────────────────────────────────────────
  // Build portal URLs and instructions from university_registry data.
  // Falls back to defaults if registry data is missing or incomplete.

  const lmsType    = uniInfo?.lms_type    || 'default';
  const emailSystem = uniInfo?.email_system || 'unknown';

  const lmsInstructions      = LMS_INSTRUCTIONS[lmsType]      || LMS_INSTRUCTIONS.default;
  const scheduleInstructions = SCHEDULE_INSTRUCTIONS[emailSystem] || SCHEDULE_INSTRUCTIONS.unknown;

  const lmsLabel = lmsType === 'default'
    ? 'University LMS'
    : lmsType.charAt(0).toUpperCase() + lmsType.slice(1);

  // Direct link to LMS calendar export — built from instance URL + portal path
  const assignmentsPortalUrl = uniInfo?.lms_instance_url
    ? `${uniInfo.lms_instance_url}${lmsInstructions.assignmentsPortalPath}`
    : null;

  const isConnected = connection?.is_connected === true;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="px-5 pt-14 pb-24 max-w-lg mx-auto space-y-5 animate-fade-in">
      <div>
        <h1 className="font-heading text-2xl font-bold mb-1">Connect Your University</h1>
        <p className="text-muted-foreground text-sm">
          Sync your classes, assignments, and exams in under 2 minutes
        </p>
      </div>

      {/* ── Connected state ── */}
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
                      <Clock className="w-3 h-3" />
                      Last synced: {new Date(connection.last_synced_at).toLocaleString()}
                    </p>
                  )}
                  <div className="flex gap-2 mt-1.5 flex-wrap">
                    {connection.events_count ? (
                      <Badge variant="secondary" className="text-xs">{connection.events_count} events</Badge>
                    ) : null}
                    {connection.tasks_count ? (
                      <Badge variant="secondary" className="text-xs">{connection.tasks_count} tasks</Badge>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline" size="sm"
                  onClick={handleResync}
                  disabled={syncing || !connection.base_url}>
                  <RefreshCw className={`w-4 h-4${syncing ? ' animate-spin' : ''}`} />
                </Button>
                <Button variant="ghost" size="sm" onClick={handleDisconnect}>
                  <WifiOff className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Not connected — university detected ── */}
      {!loading && !isConnected && uniInfo && (
        <div className="space-y-4">

          {/* Schedule / Timetable card */}
          <Card className="glass-card rounded-2xl border-primary/20">
            <CardContent className="p-5 space-y-3">
              <div>
                <p className="font-semibold text-sm">📅 Schedule / Timetable</p>
                <p className="text-xs text-muted-foreground">
                  Lectures, classes and seminars from{' '}
                  {emailSystem === 'google' ? 'Google Calendar' : 'Outlook'}
                </p>
              </div>

              {/* Step-by-step instructions — driven by email_system from registry */}
              <div className="bg-secondary/40 rounded-xl p-3 space-y-2">
                {scheduleInstructions.steps.map((step, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <div className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-primary text-[9px] font-bold">{i + 1}</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{step}</p>
                  </div>
                ))}
              </div>

              {/* Direct link to calendar portal */}
              <button
                onClick={() => window.open(scheduleInstructions.portalUrl, '_blank')}
                className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-xl py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity">
                <ExternalLink className="w-4 h-4" />
                {scheduleInstructions.buttonLabel}
                {uniInfo.name && ` — ${uniInfo.name}`}
              </button>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={scheduleUrl}
                  onChange={e => setScheduleUrl(e.target.value)}
                  placeholder={scheduleInstructions.placeholder}
                  className="flex-1 bg-secondary/60 rounded-xl px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40" />
                <Button
                  onClick={() => handleImport(scheduleUrl, 'schedule')}
                  disabled={!scheduleUrl.trim() || importingSchedule}
                  size="sm" className="px-4">
                  {importingSchedule ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Import'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Assignments / LMS card */}
          <Card className="glass-card rounded-2xl border-primary/20">
            <CardContent className="p-5 space-y-3">
              <div>
                <p className="font-semibold text-sm">📝 Assignments / Tasks</p>
                <p className="text-xs text-muted-foreground">
                  Deadlines and coursework from {lmsLabel}
                </p>
              </div>

              {/* Step-by-step instructions — driven by lms_type from registry */}
              <div className="bg-secondary/40 rounded-xl p-3 space-y-2">
                {lmsInstructions.steps.map((step, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <div className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-primary text-[9px] font-bold">{i + 1}</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{step}</p>
                  </div>
                ))}
              </div>

              {/* Direct link to LMS portal — built from lms_instance_url in registry */}
              {assignmentsPortalUrl ? (
                <button
                  onClick={() => window.open(assignmentsPortalUrl, '_blank')}
                  className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-xl py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity">
                  <ExternalLink className="w-4 h-4" />
                  Open {uniInfo.name} {lmsLabel}
                </button>
              ) : (
                <div className="bg-secondary/40 rounded-xl px-3 py-2.5 text-center">
                  <p className="text-xs text-muted-foreground">
                    Open your university {lmsLabel} portal and follow the steps above
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                <input
                  type="text"
                  value={assignmentsUrl}
                  onChange={e => setAssignmentsUrl(e.target.value)}
                  placeholder={lmsInstructions.placeholder}
                  className="flex-1 bg-secondary/60 rounded-xl px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40" />
                <Button
                  onClick={() => handleImport(assignmentsUrl, 'assignments')}
                  disabled={!assignmentsUrl.trim() || importingAssignments}
                  size="sm" className="px-4">
                  {importingAssignments ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Import'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Manual / fallback ── */}
      {/* Shown when no university is detected OR as an alternative option */}
      {!loading && !isConnected && (
        <>
          <button
            onClick={() => setShowManual(!showManual)}
            className="w-full flex items-center justify-between px-4 py-3 glass-card rounded-2xl text-sm text-muted-foreground">
            <span>
              {uniInfo
                ? 'My university is not listed / use manual URL'
                : 'Connect manually'}
            </span>
            {showManual ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showManual && (
            <Card className="glass-card rounded-2xl">
              <CardContent className="p-5 space-y-3">
                <p className="text-sm font-semibold">Paste any calendar URL</p>
                <p className="text-xs text-muted-foreground">
                  Works with Outlook, Canvas, Moodle, Blackboard, D2L, Google Calendar.
                  Click a platform to open it.
                </p>
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
                  <input
                    type="text"
                    value={manualUrl}
                    onChange={e => setManualUrl(e.target.value)}
                    placeholder="https://..."
                    className="flex-1 bg-secondary/60 rounded-xl px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40" />
                  <Button
                    onClick={() => handleImport(manualUrl, 'manual')}
                    disabled={!manualUrl.trim() || importingManual}
                    size="sm" className="px-4">
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
              { icon: '📝', name: 'Assignments',     desc: 'Due dates and deadlines' },
              { icon: '📊', name: 'Exams & Quizzes', desc: 'Tests and assessments' },
              { icon: '🔄', name: 'Auto Sync',       desc: 'Stays up to date' },
            ].map(p => (
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