import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Moon, Zap, ExternalLink, RefreshCw, CheckCircle2, ArrowRight } from 'lucide-react';

const ACTIVITIES = [
  'Gym', 'Running', 'Soccer', 'Basketball', 'Swimming',
  'Piano', 'Guitar', 'Reading', 'Gaming', 'Cooking',
  'Yoga', 'Cycling', 'Dancing', 'Art', 'Meditation'
];

const UNI_REGISTRY: Record<string, { name: string; lms: string; portalUrl: string; steps: string[] }> = {
  'essex.ac.uk': {
    name: 'University of Essex', lms: 'Moodle',
    portalUrl: 'https://moodle.essex.ac.uk/calendar/export.php',
    steps: [
      'Click "Open Essex Moodle Calendar" below',
      'Select "All events" and set date range to "Custom range"',
      'Click "Get calendar URL" and copy the link',
      'Paste it in the box below',
    ],
  },
  'manchester.ac.uk': {
    name: 'University of Manchester', lms: 'Blackboard',
    portalUrl: 'https://online.manchester.ac.uk',
    steps: ['Open Manchester Blackboard below', 'Go to My Blackboard → Calendar', 'Click "Get Calendar Feed" and copy the URL', 'Paste it below'],
  },
  'ucl.ac.uk': {
    name: 'University College London', lms: 'Moodle',
    portalUrl: 'https://moodle.ucl.ac.uk/calendar/export.php',
    steps: ['Open UCL Moodle below', 'Select "All events" → "Get calendar URL"', 'Copy the URL', 'Paste it below'],
  },
  'kcl.ac.uk': {
    name: "King's College London", lms: 'Canvas',
    portalUrl: 'https://kcl.instructure.com/profile/settings',
    steps: ['Open KCL Canvas settings below', 'Scroll to "Other Feeds" → "Calendar Feed"', 'Copy the URL', 'Paste it below'],
  },
  'imperial.ac.uk': {
    name: 'Imperial College London', lms: 'Blackboard',
    portalUrl: 'https://bb.imperial.ac.uk',
    steps: ['Open Imperial Blackboard below', 'Go to Calendar → Get Calendar Feed', 'Copy the URL', 'Paste it below'],
  },
  'ox.ac.uk': {
    name: 'University of Oxford', lms: 'Canvas',
    portalUrl: 'https://canvas.ox.ac.uk/profile/settings',
    steps: ['Open Oxford Canvas below', 'Scroll to "Other Feeds" → "Calendar Feed"', 'Copy the URL', 'Paste it below'],
  },
  'cam.ac.uk': {
    name: 'University of Cambridge', lms: 'Moodle',
    portalUrl: 'https://www.vle.cam.ac.uk/calendar/export.php',
    steps: ['Open Cambridge Moodle below', 'Select "All events" → "Get calendar URL"', 'Copy the URL', 'Paste it below'],
  },
  'ed.ac.uk': {
    name: 'University of Edinburgh', lms: 'Blackboard',
    portalUrl: 'https://learn.ed.ac.uk',
    steps: ['Open Edinburgh Learn below', 'Go to Calendar → Get Calendar Feed', 'Copy the URL', 'Paste it below'],
  },
  'birmingham.ac.uk': {
    name: 'University of Birmingham', lms: 'Canvas',
    portalUrl: 'https://canvas.bham.ac.uk/profile/settings',
    steps: ['Open Birmingham Canvas below', 'Scroll to "Calendar Feed"', 'Copy the URL', 'Paste it below'],
  },
  'leeds.ac.uk': {
    name: 'University of Leeds', lms: 'Blackboard',
    portalUrl: 'https://minerva.leeds.ac.uk',
    steps: ['Open Leeds Minerva below', 'Go to Calendar → Get Calendar Feed', 'Copy the URL', 'Paste it below'],
  },
};

const GENERIC_UNI = {
  name: 'Your University', lms: 'Calendar',
  portalUrl: 'https://outlook.office365.com/calendar/view/month',
  steps: [
    'Open your university portal or Outlook below',
    'Find Calendar → Export or Share → ICS/iCal link',
    'Copy the URL',
    'Paste it below',
  ],
};

function getDomain(email: string) {
  return email.split('@')[1]?.toLowerCase() || null;
}

function detectUni(email: string) {
  const domain = getDomain(email);
  if (!domain) return null;
  if (UNI_REGISTRY[domain]) return { ...UNI_REGISTRY[domain], domain };
  if (domain.endsWith('.ac.uk') || domain.endsWith('.edu')) {
    return { ...GENERIC_UNI, name: domain, domain };
  }
  return null;
}

export default function Onboarding() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Step 1 — Profile
  const [fullName, setFullName] = useState('');
  const [course, setCourse] = useState('');
  const [year, setYear] = useState('');
  const [detected, setDetected] = useState<any>(null);

  // Step 2 — LMS
  const [calUrl, setCalUrl] = useState('');
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(false);

  // Step 3 — Sleep + Activities
  const [sleepTime, setSleepTime] = useState('23:00');
  const [wakeTime, setWakeTime] = useState('07:00');
  const [selectedActivities, setSelectedActivities] = useState<string[]>([]);

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate('/auth', { replace: true }); return; }
    const check = async () => {
      const { data } = await supabase.from('profiles')
        .select('onboarding_complete').eq('id', user.id).single();
      if (data?.onboarding_complete === true) {
        navigate('/home', { replace: true });
        return;
      }
      // Auto-detect uni from signup email immediately
      if (user.email) {
        const uni = detectUni(user.email);
        if (uni) setDetected(uni);
      }
      setChecking(false);
    };
    check();
  }, [user, loading]);

  const handleImport = async () => {
    if (!calUrl.trim() || !user) return;
    setImporting(true);
    try {
      await supabase.functions.invoke('fetch-ics', {
        body: { url: calUrl.trim(), userId: user.id }
      });
    } catch (err) {
      console.error('ICS import error:', err);
    }

    // Always save lms_connection regardless of import success
    const domain = detected?.domain || getDomain(user.email || '');
    await supabase.from('lms_connections').insert({
      user_id: user.id,
      email_domain: domain,
      lms_type: 'ics',
      lms_name: detected?.name || 'Calendar Sync',
      base_url: calUrl.trim(),
      auth_method: 'none',
      is_connected: true,
    });

    setImported(true);
    setImporting(false);
  };

  const handleSkipLms = async () => {
    if (!user) return;
    const domain = detected?.domain || getDomain(user.email || '');
    if (domain) {
      await supabase.from('lms_connections').insert({
        user_id: user.id,
        email_domain: domain,
        lms_type: 'ics',
        lms_name: detected?.name || 'Calendar Sync',
        base_url: null,
        auth_method: 'none',
        is_connected: false,
      });
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

    const uniName = detected?.domain?.split('.')[0] || '';

    await supabase.from('profiles').update({
      full_name: fullName,
      university: uniName,
      course,
      year: parseInt(year) || null,
      use_mode: 'student',
      onboarding_complete: true,
      updated_at: new Date().toISOString(),
    }).eq('id', user.id);

    await supabase.from('sleep_schedule').upsert({
      user_id: user.id,
      sleep_time: sleepTime,
      wake_time: wakeTime,
      updated_at: new Date().toISOString(),
    });

    setSaving(false);
    navigate('/home');
  };

  if (checking) return null;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Progress — 3 dots */}
        <div className="flex justify-center gap-2 mb-8">
          {[1, 2, 3].map(s => (
            <div key={s} className={`h-2 rounded-full transition-all ${
              s === step ? 'w-8 bg-primary' : s < step ? 'w-2 bg-primary/40' : 'w-2 bg-muted'
            }`} />
          ))}
        </div>

        {/* ── STEP 1 — Profile ── */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold">Welcome to Rute 👋</h1>
              <p className="text-muted-foreground mt-2 text-sm">
                {detected
                  ? `We detected you're from ${detected.name}`
                  : 'Tell us about yourself'}
              </p>
            </div>

            <div className="space-y-3">
              <Input
                placeholder="Full name"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
              />
              <Input
                placeholder="Course / Program"
                value={course}
                onChange={e => setCourse(e.target.value)}
              />
              <Input
                placeholder="Year (e.g. 2)"
                type="number"
                value={year}
                onChange={e => setYear(e.target.value)}
              />
            </div>

            {detected && (
              <div className="flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-xl px-4 py-3">
                <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                <p className="text-sm text-primary font-medium">{detected.name} · {detected.lms} detected</p>
              </div>
            )}

            <Button className="w-full" disabled={!fullName} onClick={() => setStep(2)}>
              Continue
            </Button>
          </div>
        )}

        {/* ── STEP 2 — LMS Connect ── */}
        {step === 2 && (
          <div className="space-y-5">
            <div className="text-center">
              <h1 className="text-2xl font-bold">Connect Your Timetable</h1>
              <p className="text-muted-foreground mt-2 text-sm">
                Sync your classes, deadlines and exams from {detected?.name || 'your university'}
              </p>
            </div>

            {imported ? (
              <div className="flex flex-col items-center gap-3 py-6">
                <CheckCircle2 className="w-16 h-16 text-primary" />
                <p className="font-semibold text-lg">Timetable connected!</p>
                <p className="text-sm text-muted-foreground text-center">
                  Your classes and deadlines are being imported
                </p>
                <Button className="w-full mt-2" onClick={() => setStep(3)}>
                  Continue
                </Button>
              </div>
            ) : (
              <>
                {/* Steps */}
                {detected && (
                  <div className="bg-secondary/40 rounded-xl p-4 space-y-2.5">
                    {detected.steps.map((s: string, i: number) => (
                      <div key={i} className="flex items-start gap-2.5">
                        <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                          <span className="text-primary text-[10px] font-bold">{i + 1}</span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">{s}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Open portal */}
                <button
                  onClick={() => window.open(detected?.portalUrl || 'https://outlook.office365.com', '_blank')}
                  className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-xl py-3 text-sm font-semibold"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open {detected?.name || 'University'} Calendar
                </button>

                {/* Paste URL */}
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Paste your calendar URL here:</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={calUrl}
                      onChange={e => setCalUrl(e.target.value)}
                      placeholder="Paste your calendar URL..."
                      className="flex-1 bg-secondary/60 rounded-xl px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                    <button
                      onClick={handleImport}
                      disabled={!calUrl.trim() || importing}
                      className="px-4 bg-primary text-primary-foreground rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center gap-1"
                    >
                      {importing
                        ? <RefreshCw className="w-4 h-4 animate-spin" />
                        : <ArrowRight className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>Back</Button>
                  <Button variant="outline" className="flex-1" onClick={handleSkipLms}>
                    Skip for now
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── STEP 3 — Sleep + Activities ── */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold">Almost done!</h1>
              <p className="text-muted-foreground mt-2 text-sm">Set your sleep hours and what you love doing</p>
            </div>

            {/* Sleep */}
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

            {/* Activities */}
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