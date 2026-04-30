// src/pages/Onboarding.tsx
//
// PURPOSE: New user onboarding flow — 3 steps.
//   Step 1: Personal info (name, course, year)
//   Step 2: Connect university calendar + LMS
//   Step 3: Sleep schedule + activities
//
// HOW UNIVERSITY DETECTION WORKS:
//   On mount, we call the detect-lms Edge Function with the user's email.
//   The Edge Function checks university_registry DB, then runs detection if needed.
//   Result tells us: email_system (microsoft/google), lms_type, lms_instance_url.
//   We use these to show the correct portal links and instructions in Step 2.
//
// FALLBACK (unknown university):
//   If detection returns lms_type: 'unknown', we show a system picker
//   so the student can manually tell us what their university uses.
//   Their selection updates the instructions shown, and on successful
//   connection the data is saved to university_registry for future students.
//
// READS FROM:  detect-lms Edge Function → university_registry (Supabase)
// WRITES TO:   profiles, lms_connections, sleep_schedule (Supabase)

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  Moon, Zap, ExternalLink, RefreshCw, CheckCircle2,
  ArrowRight, Calendar, BookOpen, XCircle, Search,
} from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────

const ACTIVITIES = [
  'Gym', 'Running', 'Soccer', 'Basketball', 'Swimming',
  'Piano', 'Guitar', 'Reading', 'Gaming', 'Cooking',
  'Yoga', 'Cycling', 'Dancing', 'Art', 'Meditation',
];

// LMS-specific instructions for the assignments/calendar export step.
// assignmentsPortalPath is appended to lms_instance_url to build the direct link.
// These are shown in Step 2 based on the detected or manually selected LMS.
const LMS_INSTRUCTIONS: Record<string, {
  assignmentsPortalPath: string;
  assignmentsSteps: string[];
  assignmentsPlaceholder: string;
}> = {
  moodle: {
    assignmentsPortalPath: '/calendar/export.php',
    assignmentsSteps: [
      'Open your university Moodle site',
      'Click Calendar (top menu) → Export Calendar',
      'Set "All events" and date range: today → 1 year ahead',
      'Click "Get calendar URL" and paste it below',
    ],
    assignmentsPlaceholder: 'Paste Moodle calendar URL...',
  },
  canvas: {
    assignmentsPortalPath: '/profile/settings',
    assignmentsSteps: [
      'Open your university Canvas site',
      'Go to Account → Profile → Settings',
      'Scroll to "Other Feeds" → click "Calendar Feed"',
      'Copy the URL and paste it below',
    ],
    assignmentsPlaceholder: 'Paste Canvas calendar feed URL...',
  },
  blackboard: {
    assignmentsPortalPath: '/',
    assignmentsSteps: [
      'Open your university Blackboard site',
      'Go to Calendar (left sidebar or Tools menu)',
      'Click "Get Calendar Feed" or "Subscribe"',
      'Copy the ICS URL and paste it below',
    ],
    assignmentsPlaceholder: 'Paste Blackboard calendar URL...',
  },
  d2l: {
    assignmentsPortalPath: '/d2l/le/calendar/feed/subscribe',
    assignmentsSteps: [
      'Open your university D2L Brightspace site',
      'Click the Calendar icon in the top navigation',
      'Click Subscribe and copy the calendar URL',
      'Paste it below',
    ],
    assignmentsPlaceholder: 'Paste D2L calendar URL...',
  },
  // Shown when LMS is unknown — generic instructions covering all systems
  default: {
    assignmentsPortalPath: '/',
    assignmentsSteps: [
      'Open your university LMS (Moodle, Canvas, Blackboard, or D2L)',
      'Go to Calendar → Export or Subscribe',
      'Set date range: today → 1 year ahead if available',
      'Copy the ICS/calendar URL and paste it below',
    ],
    assignmentsPlaceholder: 'Paste LMS calendar URL...',
  },
};

// Email/calendar system instructions for the schedule (timetable) step.
// portalUrl is the direct link shown as a button — opens the student's calendar.
// Shown in Step 2 based on detected or manually selected email system.
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
      'Scroll to "Integrate calendar" → copy the "Secret address in iCal format"',
      'Paste it below',
    ],
    buttonLabel: 'Open Google Calendar',
    placeholder: 'Paste Google Calendar ICS URL...',
  },
  // Shown when email system is unknown
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

// LMS options shown in the manual picker fallback (unknown university)
const LMS_OPTIONS = ['moodle', 'canvas', 'blackboard', 'd2l'] as const;
const EMAIL_OPTIONS = ['microsoft', 'google'] as const;

// ─── Types ────────────────────────────────────────────────────────────────────

type ImportStatus = 'idle' | 'loading' | 'success' | 'error';

interface DetectedUni {
  name:             string | null;
  domain:           string;
  lms_type:         string;
  lms_instance_url: string | null;
  email_system:     string;
  calendar_type:    string;
  country:          string;
  is_active:        boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDomain(email: string): string | null {
  return email.split('@')[1]?.toLowerCase() || null;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Onboarding() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  // ── Flow state ────────────────────────────────────────────────────────────
  const [checking, setChecking] = useState(true);  // initial detection running
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // ── Step 1 state ──────────────────────────────────────────────────────────
  const [fullName, setFullName] = useState('');
  const [course, setCourse] = useState('');
  const [year, setYear] = useState('');

  // ── Detection state ───────────────────────────────────────────────────────
  // Populated by detect-lms Edge Function on mount.
  // If null after detection = university not found, show fallback picker.
  const [detected, setDetected] = useState<DetectedUni | null>(null);
  const [detecting, setDetecting] = useState(false);

  // Active LMS and email system — either from detection or manual picker
  const [activeLms, setActiveLms] = useState<string>('default');
  const [activeEmailSystem, setActiveEmailSystem] = useState<string>('unknown');
  const [lmsInstanceUrl, setLmsInstanceUrl] = useState<string>('');

  // Whether to show the manual system picker (shown when detection fails)
  const [showManualPicker, setShowManualPicker] = useState(false);

  // ── Step 2 state ──────────────────────────────────────────────────────────
  const [scheduleUrl, setScheduleUrl] = useState('');
  const [assignmentsUrl, setAssignmentsUrl] = useState('');
  const [scheduleStatus, setScheduleStatus] = useState<ImportStatus>('idle');
  const [assignmentsStatus, setAssignmentsStatus] = useState<ImportStatus>('idle');
  const [scheduleCount, setScheduleCount] = useState<number | null>(null);
  const [assignmentsCount, setAssignmentsCount] = useState<number | null>(null);

  // ── Step 3 state ──────────────────────────────────────────────────────────
  const [sleepTime, setSleepTime] = useState('23:00');
  const [wakeTime, setWakeTime] = useState('07:00');
  const [selectedActivities, setSelectedActivities] = useState<string[]>([]);

  const importedSchedule   = scheduleStatus   === 'success';
  const importedAssignments = assignmentsStatus === 'success';

  // ── Initialisation ────────────────────────────────────────────────────────
  // On mount: check if onboarding already complete, then run university detection.

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate('/auth', { replace: true }); return; }

    const init = async () => {
      // Check if this user has already completed onboarding
      const { data: profile } = await supabase
        .from('profiles')
        .select('onboarding_complete, full_name')
        .eq('id', user.id)
        .single();

      if (profile?.onboarding_complete === true) {
        navigate('/home', { replace: true });
        return;
      }

      if (profile?.full_name) setFullName(profile.full_name);

      // Run university detection via Edge Function.
      // detect-lms checks university_registry DB first, then runs
      // Microsoft/Google API checks and LMS URL probing if needed.
      // See: supabase/functions/detect-lms/index.ts
      await runDetection();

      setChecking(false);
    };

    init();
  }, [user, loading]);

  // ── University detection ──────────────────────────────────────────────────
  // Calls detect-lms Edge Function with user's email.
  // On success: sets detected state and active LMS/email system.
  // On failure or unknown result: sets showManualPicker = true.

  const runDetection = async () => {
    if (!user?.email) return;
    setDetecting(true);

    try {
      const { data, error } = await supabase.functions.invoke('detect-lms', {
        body: { email: user.email },
      });

      if (error || !data) {
        // Edge Function failed — show manual picker
        setShowManualPicker(true);
        setDetecting(false);
        return;
      }

      const result = data as DetectedUni & { found: boolean; source: string };

      if (result.found && result.lms_type && result.lms_type !== 'unknown') {
        // Full detection success — set all state from result
        setDetected(result);
        setActiveLms(result.lms_type);
        setActiveEmailSystem(result.email_system || 'unknown');
        if (result.lms_instance_url) setLmsInstanceUrl(result.lms_instance_url);
      } else if (result.email_system && result.email_system !== 'unknown') {
        // Partial detection — email system known but LMS unknown
        setDetected(result);
        setActiveEmailSystem(result.email_system);
        setShowManualPicker(true);  // ask student to pick their LMS
      } else {
        // Nothing detected — show full manual picker
        setShowManualPicker(true);
      }
    } catch {
      // Network error or Edge Function not deployed — fail gracefully
      setShowManualPicker(true);
    }

    setDetecting(false);
  };

  // ── LMS/Email import ──────────────────────────────────────────────────────
  // Calls fetch-ics Edge Function to import calendar data from a URL.
  // On success: saves connection to lms_connections and updates detected state.

  const importUrl = async (url: string, type: 'schedule' | 'assignments') => {
    if (!url.trim() || !user) return;
    if (type === 'schedule')    setScheduleStatus('loading');
    else                        setAssignmentsStatus('loading');

    try {
      const { data, error } = await supabase.functions.invoke('fetch-ics', {
        body: { url: url.trim(), userId: user.id },
      });
      if (error) throw new Error(error.message);

      const count = type === 'schedule' ? (data?.events ?? 0) : (data?.tasks ?? 0);
      const domain = detected?.domain || getDomain(user.email || '');

      // Save confirmed LMS connection to lms_connections table.
      // This is separate from university_registry — it's per-user.
      await supabase.from('lms_connections').upsert({
        user_id:      user.id,
        email_domain: domain,
        lms_type:     activeLms === 'default' ? 'ics' : activeLms,
        lms_name:     detected?.name || 'Calendar Sync',
        base_url:     lmsInstanceUrl || url.trim(),
        auth_method:  'none',
        is_connected: true,
      }, { onConflict: 'user_id' });

      if (type === 'schedule')    { setScheduleStatus('success');    setScheduleCount(count); }
      else                         { setAssignmentsStatus('success'); setAssignmentsCount(count); }
    } catch {
      if (type === 'schedule')    setScheduleStatus('error');
      else                         setAssignmentsStatus('error');
    }
  };

  // ── Continue from Step 2 ──────────────────────────────────────────────────
  // If student skipped both imports, still save an lms_connection record
  // with is_connected: false so we know they went through onboarding.

  const handleContinueFromCalendars = async () => {
    if (!user) return;
    if (!importedSchedule && !importedAssignments) {
      const domain = detected?.domain || getDomain(user.email || '');
      if (domain) {
        await supabase.from('lms_connections').upsert({
          user_id:      user.id,
          email_domain: domain,
          lms_type:     activeLms === 'default' ? 'ics' : activeLms,
          lms_name:     detected?.name || 'Calendar Sync',
          base_url:     null,
          auth_method:  'none',
          is_connected: false,
        }, { onConflict: 'user_id' });
      }
    }
    setStep(3);
  };

  // ── Finish onboarding ─────────────────────────────────────────────────────
  // Saves profile + sleep schedule, marks onboarding complete.

  const handleFinish = async () => {
    if (!user) return;
    setSaving(true);
    const uniDomain = detected?.domain || getDomain(user.email || '') || '';

    await supabase.from('profiles').upsert({
      id:                  user.id,
      email:               user.email,
      full_name:           fullName,
      university:          detected?.name || uniDomain,
      course,
      year:                parseInt(year) || null,
      use_mode:            'student',
      onboarding_complete: true,
      activities:          selectedActivities,
      updated_at:          new Date().toISOString(),
    }, { onConflict: 'id' });

    await supabase.from('sleep_schedule').upsert({
      user_id:    user.id,
      sleep_time: sleepTime,
      wake_time:  wakeTime,
      updated_at: new Date().toISOString(),
    });

    setSaving(false);
    navigate('/home', { replace: true });
  };

  const toggleActivity = (a: string) => {
    setSelectedActivities(prev =>
      prev.includes(a) ? prev.filter(x => x !== a) : prev.length < 5 ? [...prev, a] : prev
    );
  };

  // ── Derived values for Step 2 UI ──────────────────────────────────────────
  // These determine which instructions, links, and placeholders to show.
  // All derived from activeLms + activeEmailSystem — set by detection or manual picker.

  const lmsInstructions    = LMS_INSTRUCTIONS[activeLms]          || LMS_INSTRUCTIONS.default;
  const scheduleInstructions = SCHEDULE_INSTRUCTIONS[activeEmailSystem] || SCHEDULE_INSTRUCTIONS.unknown;

  const lmsLabel = activeLms === 'default'
    ? 'University LMS'
    : activeLms.charAt(0).toUpperCase() + activeLms.slice(1);

  // Direct link to LMS calendar export page — built from instance URL + portal path
  const assignmentsPortalUrl = lmsInstanceUrl
    ? `${lmsInstanceUrl}${lmsInstructions.assignmentsPortalPath}`
    : null;

  // Direct link to email calendar portal (Outlook or Google)
  const schedulePortalUrl = scheduleInstructions.portalUrl || null;

  // Whether we have enough info to show a meaningful detected badge in Step 1
  const hasDetection = detected && (
    (detected.lms_type && detected.lms_type !== 'unknown') ||
    (detected.email_system && detected.email_system !== 'unknown')
  );

  // ── Loading state ─────────────────────────────────────────────────────────
  // Show nothing while checking onboarding status / running initial detection

  if (checking) return null;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Step progress indicator */}
        <div className="flex justify-center gap-2 mb-8">
          {[1, 2, 3].map(s => (
            <div key={s} className={`h-2 rounded-full transition-all ${
              s === step ? 'w-8 bg-primary' : s < step ? 'w-2 bg-primary/40' : 'w-2 bg-muted'
            }`} />
          ))}
        </div>

        {/* ══ STEP 1 — Personal info ══ */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold">Welcome to Rute 👋</h1>
              <p className="text-muted-foreground mt-2 text-sm">
                {detecting
                  ? 'Detecting your university...'
                  : hasDetection
                    ? `We detected you're from ${detected!.name || detected!.domain}`
                    : 'Tell us about yourself'}
              </p>
            </div>

            <div className="space-y-3">
              <Input placeholder="Full name"           value={fullName} onChange={e => setFullName(e.target.value)} />
              <Input placeholder="Course / Program"    value={course}   onChange={e => setCourse(e.target.value)} />
              <Input placeholder="Year (e.g. 2)" type="number" value={year} onChange={e => setYear(e.target.value)} />
            </div>

            {/* Detection result badge — shown when university is recognised */}
            {hasDetection && !detecting && (
              <div className="flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-xl px-4 py-3">
                <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                <div>
                  <p className="text-sm text-primary font-medium">
                    {detected!.name || detected!.domain}
                  </p>
                  <p className="text-xs text-primary/70">
                    {activeEmailSystem !== 'unknown' && (
                      activeEmailSystem === 'google' ? 'Google Workspace' : 'Microsoft 365'
                    )}
                    {activeEmailSystem !== 'unknown' && activeLms !== 'default' && ' · '}
                    {activeLms !== 'default' && lmsLabel + ' detected'}
                  </p>
                </div>
              </div>
            )}

            {/* Unknown university notice — shown when detection failed */}
            {!detecting && !hasDetection && showManualPicker && (
              <div className="bg-secondary/60 rounded-xl px-4 py-3">
                <p className="text-xs text-muted-foreground">
                  We'll help you connect your university in the next step.
                </p>
              </div>
            )}

            <Button className="w-full" disabled={!fullName || detecting} onClick={() => setStep(2)}>
              {detecting ? 'Detecting your university...' : 'Continue'}
            </Button>
          </div>
        )}

        {/* ══ STEP 2 — Connect university ══ */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="text-center">
              <h1 className="text-2xl font-bold">Sync Your University</h1>
              <p className="text-muted-foreground mt-2 text-sm">
                Connect your timetable and assignments — both are optional
              </p>
            </div>

            {/* ── Manual system picker ── */}
            {/* Shown when detection failed or returned 'unknown'.          */}
            {/* Student picks their email system and LMS — updates          */}
            {/* activeLms and activeEmailSystem which drive all instructions */}
            {showManualPicker && (
              <div className="glass-card rounded-2xl p-4 space-y-3">
                <p className="font-semibold text-sm">What does your university use?</p>

                <div>
                  <p className="text-xs text-muted-foreground mb-2">Email & calendar</p>
                  <div className="flex gap-2 flex-wrap">
                    {EMAIL_OPTIONS.map(opt => (
                      <button
                        key={opt}
                        onClick={() => setActiveEmailSystem(opt)}
                        className={cn(
                          'px-3 py-1.5 rounded-full text-xs font-medium border transition-all capitalize',
                          activeEmailSystem === opt
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'border-border text-muted-foreground'
                        )}>
                        {opt === 'microsoft' ? 'Microsoft 365' : 'Google Workspace'}
                      </button>
                    ))}
                    <button
                      onClick={() => setActiveEmailSystem('unknown')}
                      className={cn(
                        'px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                        activeEmailSystem === 'unknown'
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'border-border text-muted-foreground'
                      )}>
                      Not sure
                    </button>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground mb-2">Learning system (LMS)</p>
                  <div className="flex gap-2 flex-wrap">
                    {LMS_OPTIONS.map(opt => (
                      <button
                        key={opt}
                        onClick={() => setActiveLms(opt)}
                        className={cn(
                          'px-3 py-1.5 rounded-full text-xs font-medium border transition-all capitalize',
                          activeLms === opt
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'border-border text-muted-foreground'
                        )}>
                        {opt === 'd2l' ? 'D2L Brightspace' : opt.charAt(0).toUpperCase() + opt.slice(1)}
                      </button>
                    ))}
                    <button
                      onClick={() => setActiveLms('default')}
                      className={cn(
                        'px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                        activeLms === 'default'
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'border-border text-muted-foreground'
                      )}>
                      Not sure
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── Schedule / Timetable ── */}
            <div className="glass-card rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Calendar className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm">Schedule / Timetable</p>
                  <p className="text-xs text-muted-foreground">Lectures, classes and seminars</p>
                </div>
                {scheduleStatus === 'success' && <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />}
                {scheduleStatus === 'error'   && <XCircle      className="w-5 h-5 text-red-400 shrink-0" />}
              </div>

              {scheduleStatus === 'success' && (
                <div className="bg-primary/10 rounded-xl px-3 py-2">
                  <p className="text-xs text-primary font-medium">
                    ✓ Synced {scheduleCount !== null
                      ? `${scheduleCount} event${scheduleCount !== 1 ? 's' : ''}`
                      : 'successfully'}
                  </p>
                </div>
              )}
              {scheduleStatus === 'error' && (
                <div className="bg-red-500/10 rounded-xl px-3 py-2">
                  <p className="text-xs text-red-400">Could not import — check the URL and try again</p>
                </div>
              )}

              {scheduleStatus !== 'success' && (
                <>
                  {/* Direct link to student's calendar portal */}
                  {schedulePortalUrl && (
                    <button
                      onClick={() => window.open(schedulePortalUrl, '_blank')}
                      className="w-full flex items-center justify-center gap-2 bg-secondary text-foreground rounded-xl py-2.5 text-xs font-semibold hover:bg-secondary/80 transition-colors">
                      <ExternalLink className="w-3.5 h-3.5" />
                      {scheduleInstructions.buttonLabel}
                      {detected?.name && ` — ${detected.name}`}
                    </button>
                  )}
                  {/* Step-by-step instructions based on detected email system */}
                  <div className="space-y-1">
                    {scheduleInstructions.steps.map((s, i) => (
                      <p key={i} className="text-[10px] text-muted-foreground leading-relaxed flex gap-1.5">
                        <span className="text-primary/50 font-bold shrink-0">{i + 1}.</span>{s}
                      </p>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={scheduleUrl}
                      onChange={e => setScheduleUrl(e.target.value)}
                      placeholder={scheduleInstructions.placeholder}
                      className="flex-1 bg-secondary/60 rounded-xl px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40" />
                    <button
                      onClick={() => importUrl(scheduleUrl, 'schedule')}
                      disabled={!scheduleUrl.trim() || scheduleStatus === 'loading'}
                      className="px-3 bg-primary text-primary-foreground rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center">
                      {scheduleStatus === 'loading'
                        ? <RefreshCw className="w-4 h-4 animate-spin" />
                        : <ArrowRight className="w-4 h-4" />}
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* ── Assignments / LMS ── */}
            <div className="glass-card rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <BookOpen className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm">Assignments / Tasks</p>
                  <p className="text-xs text-muted-foreground">
                    {activeLms !== 'default'
                      ? `Deadlines from ${lmsLabel}`
                      : 'Deadlines, quizzes and coursework'}
                  </p>
                </div>
                {assignmentsStatus === 'success' && <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />}
                {assignmentsStatus === 'error'   && <XCircle      className="w-5 h-5 text-red-400 shrink-0" />}
              </div>

              {assignmentsStatus === 'success' && (
                <div className="bg-primary/10 rounded-xl px-3 py-2">
                  <p className="text-xs text-primary font-medium">
                    ✓ Synced {assignmentsCount !== null
                      ? `${assignmentsCount} task${assignmentsCount !== 1 ? 's' : ''}`
                      : 'successfully'}
                  </p>
                </div>
              )}
              {assignmentsStatus === 'error' && (
                <div className="bg-red-500/10 rounded-xl px-3 py-2">
                  <p className="text-xs text-red-400">Could not import — check the URL and try again</p>
                </div>
              )}

              {assignmentsStatus !== 'success' && (
                <>
                  {/* Direct link to LMS portal — built from detected instance URL */}
                  {assignmentsPortalUrl ? (
                    <button
                      onClick={() => window.open(assignmentsPortalUrl, '_blank')}
                      className="w-full flex items-center justify-center gap-2 bg-secondary text-foreground rounded-xl py-2.5 text-xs font-semibold hover:bg-secondary/80 transition-colors">
                      <ExternalLink className="w-3.5 h-3.5" />
                      Open {detected?.name || 'your university'} {lmsLabel}
                    </button>
                  ) : (
                    <div className="bg-secondary/40 rounded-xl px-3 py-2.5 text-center">
                      <p className="text-xs text-muted-foreground">
                        Open your university {lmsLabel} portal and follow the steps below
                      </p>
                    </div>
                  )}
                  {/* Step-by-step instructions based on detected/selected LMS */}
                  <div className="space-y-1">
                    {lmsInstructions.assignmentsSteps.map((s, i) => (
                      <p key={i} className="text-[10px] text-muted-foreground leading-relaxed flex gap-1.5">
                        <span className="text-primary/50 font-bold shrink-0">{i + 1}.</span>{s}
                      </p>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={assignmentsUrl}
                      onChange={e => setAssignmentsUrl(e.target.value)}
                      placeholder={lmsInstructions.assignmentsPlaceholder}
                      className="flex-1 bg-secondary/60 rounded-xl px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40" />
                    <button
                      onClick={() => importUrl(assignmentsUrl, 'assignments')}
                      disabled={!assignmentsUrl.trim() || assignmentsStatus === 'loading'}
                      className="px-3 bg-primary text-primary-foreground rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center">
                      {assignmentsStatus === 'loading'
                        ? <RefreshCw className="w-4 h-4 animate-spin" />
                        : <ArrowRight className="w-4 h-4" />}
                    </button>
                  </div>
                </>
              )}
            </div>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>Back</Button>
              <Button className="flex-1" onClick={handleContinueFromCalendars}>
                {importedSchedule || importedAssignments ? 'Continue' : "I'll do this later"}
              </Button>
            </div>
          </div>
        )}

        {/* ══ STEP 3 — Sleep + activities ══ */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold">Almost done!</h1>
              <p className="text-muted-foreground mt-2 text-sm">Set your sleep hours and what you love doing</p>
            </div>

            <div className="glass-card rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <Moon className="w-4 h-4 text-primary" />
                <p className="font-semibold text-sm">Sleep Schedule</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Bedtime</label>
                  <Input type="time" value={sleepTime} onChange={e => setSleepTime(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Wake up</label>
                  <Input type="time" value={wakeTime} onChange={e => setWakeTime(e.target.value)} className="mt-1" />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" />
                <p className="font-semibold text-sm">
                  Your Activities <span className="text-muted-foreground font-normal">(pick up to 5)</span>
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {ACTIVITIES.map(a => (
                  <button
                    key={a}
                    onClick={() => toggleActivity(a)}
                    className={`px-4 py-2 rounded-full text-sm border transition-all ${
                      selectedActivities.includes(a)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-border'
                    }`}>
                    {a}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setStep(2)}>Back</Button>
              <Button className="flex-1" onClick={handleFinish} disabled={saving}>
                {saving ? 'Setting up...' : '🚀 Get Started'}
              </Button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}