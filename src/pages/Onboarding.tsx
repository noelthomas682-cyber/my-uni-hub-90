import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Moon, Zap, ExternalLink, RefreshCw, CheckCircle2, ArrowRight, Calendar, BookOpen, XCircle } from 'lucide-react';

const ACTIVITIES = [
  'Gym', 'Running', 'Soccer', 'Basketball', 'Swimming',
  'Piano', 'Guitar', 'Reading', 'Gaming', 'Cooking',
  'Yoga', 'Cycling', 'Dancing', 'Art', 'Meditation'
];

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

const SCHEDULE_INSTRUCTIONS: Record<string, {
  portalUrl: string;
  steps: string[];
  buttonLabel: string;
}> = {
  microsoft: {
    portalUrl: 'https://outlook.office365.com/calendar/view/month',
    steps: [
      'Open your university Outlook calendar',
      'Go to Settings → Calendar → Shared calendars → Publish a calendar',
      'Select your timetable calendar and copy the ICS link',
    ],
    buttonLabel: 'Open Outlook Calendar',
  },
  google: {
    portalUrl: 'https://calendar.google.com',
    steps: [
      'Open your university Google Calendar',
      'Click the three dots next to your timetable calendar → Settings and sharing',
      'Scroll to "Integrate calendar" and copy the "Secret address in iCal format"',
      'Paste it below',
    ],
    buttonLabel: 'Open Google Calendar',
  },
  other: {
    portalUrl: '',
    steps: [
      'Open your university calendar portal',
      'Find the export or subscribe option',
      'Copy the ICS/calendar URL and paste it below',
    ],
    buttonLabel: 'Open University Calendar',
  },
  unknown: {
    portalUrl: 'https://outlook.office365.com/calendar/view/month',
    steps: [
      'Open your university calendar (Outlook or Google)',
      'Find the calendar sharing or export settings',
      'Copy the ICS link and paste it below',
    ],
    buttonLabel: 'Open Calendar',
  },
};

function getDomain(email: string) {
  return email.split('@')[1]?.toLowerCase() || null;
}

type ImportStatus = 'idle' | 'loading' | 'success' | 'error';

interface DetectedUni {
  name: string;
  domain: string;
  lms_type?: string;
  lms_instance_url?: string;
  email_system?: string;
  news_feed_url?: string;
  color?: string;
}

export default function Onboarding() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  const [fullName, setFullName] = useState('');
  const [course, setCourse] = useState('');
  const [year, setYear] = useState('');

  const [detected, setDetected] = useState<DetectedUni | null>(null);
  const [detectedLms, setDetectedLms] = useState<string>('default');
  const [detectedEmailSystem, setDetectedEmailSystem] = useState<string>('unknown');
  const [lmsInstanceUrl, setLmsInstanceUrl] = useState<string>('');

  const [scheduleUrl, setScheduleUrl] = useState('');
  const [assignmentsUrl, setAssignmentsUrl] = useState('');
  const [scheduleStatus, setScheduleStatus] = useState<ImportStatus>('idle');
  const [assignmentsStatus, setAssignmentsStatus] = useState<ImportStatus>('idle');
  const [scheduleCount, setScheduleCount] = useState<number | null>(null);
  const [assignmentsCount, setAssignmentsCount] = useState<number | null>(null);

  const [sleepTime, setSleepTime] = useState('23:00');
  const [wakeTime, setWakeTime] = useState('07:00');
  const [selectedActivities, setSelectedActivities] = useState<string[]>([]);

  const importedSchedule = scheduleStatus === 'success';
  const importedAssignments = assignmentsStatus === 'success';

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate('/auth', { replace: true }); return; }

    const init = async () => {
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

      const domain = getDomain(user.email || '');
      if (domain) {
        // Single query — reads everything needed from registry
        const { data: uni } = await supabase
          .from('university_registry')
          .select('name, domain, news_feed_url, color, lms_type, lms_instance_url, email_system')
          .eq('domain', domain)
          .eq('is_active', true)
          .maybeSingle();

        if (uni) {
          setDetected({
            name: uni.name,
            domain: uni.domain,
            news_feed_url: uni.news_feed_url,
            color: uni.color,
            lms_type: uni.lms_type,
            lms_instance_url: uni.lms_instance_url,
            email_system: uni.email_system,
          });

          // Set LMS type from registry — no detect-lms call needed
          if (uni.lms_type && uni.lms_type !== 'unknown') {
            setDetectedLms(uni.lms_type);
          }

          // Set email system from registry
          if (uni.email_system && uni.email_system !== 'unknown') {
            setDetectedEmailSystem(uni.email_system);
          }

          // Set LMS instance URL from registry
          if (uni.lms_instance_url) {
            setLmsInstanceUrl(uni.lms_instance_url);
          }
        }
      }

      setChecking(false);
    };

    init();
  }, [user, loading]);

  const importUrl = async (url: string, type: 'schedule' | 'assignments') => {
    if (!url.trim() || !user) return;
    if (type === 'schedule') setScheduleStatus('loading');
    else setAssignmentsStatus('loading');

    try {
      const { data, error } = await supabase.functions.invoke('fetch-ics', {
        body: { url: url.trim(), userId: user.id }
      });
      if (error) throw new Error(error.message);

      const count = type === 'schedule' ? (data?.events ?? 0) : (data?.tasks ?? 0);
      const domain = detected?.domain || getDomain(user.email || '');

      await supabase.from('lms_connections').upsert({
        user_id: user.id,
        email_domain: domain,
        lms_type: detectedLms === 'default' ? 'ics' : detectedLms,
        lms_name: detected?.name || 'Calendar Sync',
        base_url: lmsInstanceUrl || url.trim(),
        auth_method: 'none',
        is_connected: true,
      }, { onConflict: 'user_id' });

      if (type === 'schedule') { setScheduleStatus('success'); setScheduleCount(count); }
      else { setAssignmentsStatus('success'); setAssignmentsCount(count); }
    } catch {
      if (type === 'schedule') setScheduleStatus('error');
      else setAssignmentsStatus('error');
    }
  };

  const handleContinueFromCalendars = async () => {
    if (!user) return;
    if (!importedSchedule && !importedAssignments) {
      const domain = detected?.domain || getDomain(user.email || '');
      if (domain) {
        await supabase.from('lms_connections').upsert({
          user_id: user.id,
          email_domain: domain,
          lms_type: detectedLms === 'default' ? 'ics' : detectedLms,
          lms_name: detected?.name || 'Calendar Sync',
          base_url: null,
          auth_method: 'none',
          is_connected: false,
        }, { onConflict: 'user_id' });
      }
    }
    setStep(3);
  };

  const toggleActivity = (a: string) => {
    setSelectedActivities(prev =>
      prev.includes(a) ? prev.filter(x => x !== a) : prev.length < 5 ? [...prev, a] : prev
    );
  };

  const handleFinish = async () => {
    if (!user) return;
    setSaving(true);
    const uniDomain = detected?.domain || getDomain(user.email || '') || '';

    await supabase.from('profiles').upsert({
      id: user.id,
      email: user.email,
      full_name: fullName,
      university: detected?.name || uniDomain,
      course,
      year: parseInt(year) || null,
      use_mode: 'student',
      onboarding_complete: true,
      activities: selectedActivities,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });

    await supabase.from('sleep_schedule').upsert({
      user_id: user.id,
      sleep_time: sleepTime,
      wake_time: wakeTime,
      updated_at: new Date().toISOString(),
    });

    setSaving(false);
    navigate('/home', { replace: true });
  };

  // Derive UI from registry data
  const lmsInstructions = LMS_INSTRUCTIONS[detectedLms] || LMS_INSTRUCTIONS.default;
  const scheduleInstructions = SCHEDULE_INSTRUCTIONS[detectedEmailSystem] || SCHEDULE_INSTRUCTIONS.unknown;
  const lmsLabel = detectedLms === 'default' ? 'University LMS'
    : detectedLms.charAt(0).toUpperCase() + detectedLms.slice(1);

  const assignmentsPortalUrl = lmsInstanceUrl
    ? `${lmsInstanceUrl}${lmsInstructions.assignmentsPortalPath}`
    : null;

  const schedulePortalUrl = scheduleInstructions.portalUrl || null;

  if (checking) return null;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        <div className="flex justify-center gap-2 mb-8">
          {[1, 2, 3].map(s => (
            <div key={s} className={`h-2 rounded-full transition-all ${
              s === step ? 'w-8 bg-primary' : s < step ? 'w-2 bg-primary/40' : 'w-2 bg-muted'
            }`} />
          ))}
        </div>

        {/* ── STEP 1 ── */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold">Welcome to Rute 👋</h1>
              <p className="text-muted-foreground mt-2 text-sm">
                {detected ? `We detected you're from ${detected.name}` : 'Tell us about yourself'}
              </p>
            </div>
            <div className="space-y-3">
              <Input placeholder="Full name" value={fullName} onChange={e => setFullName(e.target.value)} />
              <Input placeholder="Course / Program" value={course} onChange={e => setCourse(e.target.value)} />
              <Input placeholder="Year (e.g. 2)" type="number" value={year} onChange={e => setYear(e.target.value)} />
            </div>
            {detected && (
              <div className="flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-xl px-4 py-3">
                <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                <div>
                  <p className="text-sm text-primary font-medium">{detected.name}</p>
                  {detectedLms !== 'default' && (
                    <p className="text-xs text-primary/70">
                      {detectedEmailSystem !== 'unknown' && `${detectedEmailSystem === 'google' ? 'Google Workspace' : 'Microsoft 365'} · `}
                      {lmsLabel} detected
                    </p>
                  )}
                </div>
              </div>
            )}
            <Button className="w-full" disabled={!fullName} onClick={() => setStep(2)}>
              Continue
            </Button>
          </div>
        )}

        {/* ── STEP 2 ── */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="text-center">
              <h1 className="text-2xl font-bold">Sync Your University</h1>
              <p className="text-muted-foreground mt-2 text-sm">
                Connect your timetable and assignments — both are optional
              </p>
            </div>

            {/* Schedule */}
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
                {scheduleStatus === 'error' && <XCircle className="w-5 h-5 text-red-400 shrink-0" />}
              </div>

              {scheduleStatus === 'success' && (
                <div className="bg-primary/10 rounded-xl px-3 py-2">
                  <p className="text-xs text-primary font-medium">
                    ✓ Synced {scheduleCount !== null ? `${scheduleCount} event${scheduleCount !== 1 ? 's' : ''}` : 'successfully'}
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
                  {schedulePortalUrl && (
                    <button
                      onClick={() => window.open(schedulePortalUrl, '_blank')}
                      className="w-full flex items-center justify-center gap-2 bg-secondary text-foreground rounded-xl py-2.5 text-xs font-semibold hover:bg-secondary/80 transition-colors">
                      <ExternalLink className="w-3.5 h-3.5" />
                      {scheduleInstructions.buttonLabel}
                      {detected && ` — ${detected.name}`}
                    </button>
                  )}
                  <div className="space-y-1">
                    {scheduleInstructions.steps.map((s, i) => (
                      <p key={i} className="text-[10px] text-muted-foreground leading-relaxed flex gap-1.5">
                        <span className="text-primary/50 font-bold shrink-0">{i + 1}.</span>{s}
                      </p>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input type="text" value={scheduleUrl} onChange={e => setScheduleUrl(e.target.value)}
                      placeholder={detectedEmailSystem === 'google' ? 'Paste Google Calendar ICS URL...' : 'Paste Outlook ICS URL...'}
                      className="flex-1 bg-secondary/60 rounded-xl px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40" />
                    <button onClick={() => importUrl(scheduleUrl, 'schedule')}
                      disabled={!scheduleUrl.trim() || scheduleStatus === 'loading'}
                      className="px-3 bg-primary text-primary-foreground rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center">
                      {scheduleStatus === 'loading' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Assignments — LMS specific */}
            <div className="glass-card rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <BookOpen className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm">Assignments / Tasks</p>
                  <p className="text-xs text-muted-foreground">
                    {detectedLms !== 'default' ? `Deadlines from ${lmsLabel}` : 'Deadlines, quizzes and coursework'}
                  </p>
                </div>
                {assignmentsStatus === 'success' && <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />}
                {assignmentsStatus === 'error' && <XCircle className="w-5 h-5 text-red-400 shrink-0" />}
              </div>

              {assignmentsStatus === 'success' && (
                <div className="bg-primary/10 rounded-xl px-3 py-2">
                  <p className="text-xs text-primary font-medium">
                    ✓ Synced {assignmentsCount !== null ? `${assignmentsCount} task${assignmentsCount !== 1 ? 's' : ''}` : 'successfully'}
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
                  {assignmentsPortalUrl ? (
                    <button
                      onClick={() => window.open(assignmentsPortalUrl, '_blank')}
                      className="w-full flex items-center justify-center gap-2 bg-secondary text-foreground rounded-xl py-2.5 text-xs font-semibold hover:bg-secondary/80 transition-colors">
                      <ExternalLink className="w-3.5 h-3.5" />
                      Open {detected?.name} {lmsLabel}
                    </button>
                  ) : (
                    <div className="bg-secondary/40 rounded-xl px-3 py-2.5 text-center">
                      <p className="text-xs text-muted-foreground">
                        Open your university {lmsLabel} portal and follow the steps below
                      </p>
                    </div>
                  )}
                  <div className="space-y-1">
                    {lmsInstructions.assignmentsSteps.map((s, i) => (
                      <p key={i} className="text-[10px] text-muted-foreground leading-relaxed flex gap-1.5">
                        <span className="text-primary/50 font-bold shrink-0">{i + 1}.</span>{s}
                      </p>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input type="text" value={assignmentsUrl} onChange={e => setAssignmentsUrl(e.target.value)}
                      placeholder={lmsInstructions.assignmentsPlaceholder}
                      className="flex-1 bg-secondary/60 rounded-xl px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40" />
                    <button onClick={() => importUrl(assignmentsUrl, 'assignments')}
                      disabled={!assignmentsUrl.trim() || assignmentsStatus === 'loading'}
                      className="px-3 bg-primary text-primary-foreground rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center">
                      {assignmentsStatus === 'loading' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                    </button>
                  </div>
                </>
              )}
            </div>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>Back</Button>
              <Button className="flex-1" onClick={handleContinueFromCalendars}>
                {importedSchedule || importedAssignments ? 'Continue' : 'Skip for now'}
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 3 ── */}
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
                <p className="font-semibold text-sm">Your Activities <span className="text-muted-foreground font-normal">(pick up to 5)</span></p>
              </div>
              <div className="flex flex-wrap gap-2">
                {ACTIVITIES.map(a => (
                  <button key={a} onClick={() => toggleActivity(a)}
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