import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Search, Loader2, CheckCircle2, AlertCircle, Wifi, WifiOff,
  Calendar, BookOpen, GraduationCap, RefreshCw, Upload, Eye, EyeOff,
} from 'lucide-react';

type LmsType = 'canvas' | 'moodle' | 'blackboard' | 'd2l' | 'unknown';
type Step = 'email' | 'detected' | 'moodle_creds' | 'manual' | 'connecting' | 'importing' | 'done';

interface LmsInfo {
  type: LmsType;
  baseUrl: string;
  name: string;
  authMethod: 'oauth2' | 'token';
  ssoProvider?: 'microsoft' | 'google';
}

interface DetectionResult {
  found: boolean;
  lms?: LmsInfo;
  domain?: string;
  message?: string;
}

const LMS_ICONS: Record<string, string> = {
  canvas: '🟠', moodle: '🟡', blackboard: '⬛', d2l: '🔴', unknown: '🎓',
};

const LMS_NAMES: Record<string, string> = {
  canvas: 'Canvas (Instructure)', moodle: 'Moodle', blackboard: 'Blackboard Learn', d2l: 'D2L Brightspace', unknown: 'Unknown LMS',
};

export default function LmsConnect() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState(user?.email || '');
  const [detection, setDetection] = useState<DetectionResult | null>(null);
  const [moodleUsername, setMoodleUsername] = useState('');
  const [moodlePassword, setMoodlePassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [manualUrl, setManualUrl] = useState('');
  const [manualType, setManualType] = useState<LmsType>('moodle');
  const [importResult, setImportResult] = useState<{ courses: number; tasks: number; events: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Detect LMS from email
  const handleDetect = useCallback(async () => {
    if (!email.includes('@')) { setError('Enter your full university email address'); return; }
    setError(null);
    setLoading(true);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('detect-lms', { body: { email } });
      if (fnErr) throw new Error(fnErr.message);
      const result = data as DetectionResult;
      setDetection(result);
      if (result.found && result.lms) {
        if (result.lms.type === 'moodle') {
          setMoodleUsername(email);
          setStep('moodle_creds');
        } else {
          setStep('detected');
        }
      } else {
        setStep('manual');
        setError(result.message || 'Could not detect your LMS automatically. You can enter it manually below, or use ICS file import.');
      }
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  }, [email]);

  // Step 2a: Connect Moodle with credentials
  const handleMoodleConnect = useCallback(async () => {
    if (!moodleUsername.trim() || !moodlePassword.trim()) { setError('Enter your university email and password'); return; }
    const lms = detection?.lms;
    if (!lms) return;
    setStep('connecting');
    setError(null);

    try {
      const { data, error: fnErr } = await supabase.functions.invoke('moodle-import', {
        body: { baseUrl: lms.baseUrl, lmsName: lms.name, username: moodleUsername.trim(), password: moodlePassword },
      });
      if (fnErr) throw new Error(fnErr.message);
      if (data?.error) {
        if (data.errorCode === 'SSO_ONLY') {
          setStep('moodle_creds');
          setError('Your university requires browser login. Please use ICS file import instead (go to the Import tab above).');
          return;
        }
        throw new Error(data.error);
      }
      setImportResult({ courses: data.courses || 0, tasks: data.tasks || 0, events: data.events || 0 });
      setStep('done');
      toast({ title: 'Connected!', description: `Imported ${data.tasks || 0} assignments and ${data.events || 0} schedule events.` });
    } catch (err: any) {
      setError(err.message);
      setStep('moodle_creds');
    }
  }, [moodleUsername, moodlePassword, detection, toast]);

  // Step 2b: OAuth connect (Canvas, Blackboard, D2L)
  const handleOAuthInfo = useCallback(() => {
    toast({
      title: 'OAuth requires university registration',
      description: 'Your university IT needs to register Rute as an OAuth app. Use ICS file import as an alternative.',
      variant: 'destructive',
    });
  }, [toast]);

  // Manual URL connect
  const handleManualConnect = useCallback(() => {
    if (!manualUrl.trim().startsWith('http')) { setError('Enter a valid URL starting with https://'); return; }
    setDetection({
      found: true,
      lms: { type: manualType, baseUrl: manualUrl.replace(/\/$/, ''), name: LMS_NAMES[manualType], authMethod: manualType === 'moodle' ? 'token' : 'oauth2' },
    });
    if (manualType === 'moodle') { setStep('moodle_creds'); }
    else { setStep('detected'); }
    setError(null);
  }, [manualUrl, manualType]);

  // Re-sync existing connection
  const handleResync = useCallback(async () => {
    if (!detection?.lms) return;
    setStep('importing');
    setError(null);
    const fnName = `${detection.lms.type}-import`;
    try {
      const { data, error: fnErr } = await supabase.functions.invoke(fnName);
      if (fnErr) throw new Error(fnErr.message);
      if (data?.error) throw new Error(data.error);
      setImportResult({ courses: data.courses || 0, tasks: data.tasks || 0, events: data.events || 0 });
      setStep('done');
      toast({ title: 'Sync complete!', description: `Updated ${data.tasks || 0} assignments and ${data.events || 0} events.` });
    } catch (err: any) {
      setError(err.message);
      setStep('detected');
    }
  }, [detection, toast]);

  const resetFlow = () => {
    setStep('email');
    setDetection(null);
    setError(null);
    setImportResult(null);
    setMoodlePassword('');
  };

  const lmsColour = detection?.lms?.type === 'canvas' ? 'border-orange-500/40' :
    detection?.lms?.type === 'moodle' ? 'border-yellow-500/40' :
    detection?.lms?.type === 'blackboard' ? 'border-gray-500/40' :
    detection?.lms?.type === 'd2l' ? 'border-red-500/40' : 'border-primary/40';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Wifi className="w-5 h-5 text-primary" />
          Connect Your University LMS
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Rute reads your timetable, assignments, quizzes and exam dates directly from your university's system. Supports Canvas, Moodle, Blackboard and D2L Brightspace at 200+ universities.
        </p>

        {/* Step: Email entry */}
        {step === 'email' && (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Your university email</Label>
              <div className="flex gap-2">
                <Input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@university.ac.uk"
                  type="email"
                  onKeyDown={(e) => e.key === 'Enter' && handleDetect()}
                />
                <Button onClick={handleDetect} disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  {loading ? 'Finding...' : 'Find'}
                </Button>
              </div>
            </div>
            {error && <p className="text-sm text-destructive flex items-center gap-1"><AlertCircle className="w-4 h-4" />{error}</p>}
          </div>
        )}

        {/* Step: LMS Detected (OAuth) */}
        {step === 'detected' && detection?.lms && (
          <div className="space-y-3">
            <div className={`rounded-lg border-2 ${lmsColour} p-4 flex items-center gap-3`}>
              <span className="text-2xl">{LMS_ICONS[detection.lms.type]}</span>
              <div>
                <p className="font-medium text-foreground">{detection.lms.name}</p>
                <p className="text-xs text-muted-foreground">{detection.lms.baseUrl}</p>
              </div>
              <Badge className="ml-auto bg-success/10 text-success">Detected</Badge>
            </div>

            {detection.lms.authMethod === 'oauth2' ? (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  {detection.lms.name} uses OAuth authentication. This requires your university IT to register Rute as an approved application.
                </p>
                <div className="flex gap-2">
                  <Button onClick={handleOAuthInfo} variant="outline" className="flex-1">
                    Connect via OAuth (requires IT approval)
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  💡 Alternatively, export your calendar from {detection.lms.name} as an .ics file and use the ICS Import tab above.
                </p>
              </div>
            ) : (
              <Button onClick={() => { setMoodleUsername(email); setStep('moodle_creds'); }} className="w-full">
                Enter Credentials →
              </Button>
            )}

            <Button variant="ghost" size="sm" onClick={resetFlow}>← Try different email</Button>
          </div>
        )}

        {/* Step: Moodle credentials */}
        {step === 'moodle_creds' && detection?.lms && (
          <div className="space-y-3">
            <div className={`rounded-lg border-2 ${lmsColour} p-3 flex items-center gap-3`}>
              <span className="text-xl">{LMS_ICONS[detection.lms.type]}</span>
              <div>
                <p className="font-medium text-foreground text-sm">{detection.lms.name}</p>
                <p className="text-xs text-muted-foreground">{detection.lms.baseUrl}</p>
              </div>
            </div>

            {detection.lms.ssoProvider && (
              <div className="rounded-lg bg-blue-500/10 p-3 text-sm">
                <p className="font-medium text-foreground">🔐 Your university uses {detection.lms.ssoProvider === 'microsoft' ? 'Microsoft' : 'Google'} SSO</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Use your full university email and {detection.lms.ssoProvider === 'microsoft' ? 'Microsoft' : 'Google'} password.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label>University email / username</Label>
              <Input value={moodleUsername} onChange={(e) => setMoodleUsername(e.target.value)} placeholder="name@university.ac.uk" />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={moodlePassword}
                  onChange={(e) => setMoodlePassword(e.target.value)}
                  placeholder="Your university password"
                  onKeyDown={(e) => e.key === 'Enter' && handleMoodleConnect()}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && <p className="text-sm text-destructive flex items-center gap-1"><AlertCircle className="w-4 h-4" />{error}</p>}

            <div className="flex gap-2">
              <Button onClick={handleMoodleConnect} disabled={loading} className="flex-1">
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Connect & Import
              </Button>
              <Button variant="ghost" onClick={resetFlow}>← Back</Button>
            </div>

            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <p>Your credentials are sent directly to your university's Moodle server. We never store your password — only the session token is kept server-side.</p>
            </div>
          </div>
        )}

        {/* Step: Manual entry */}
        {step === 'manual' && (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>LMS Type</Label>
              <div className="flex gap-2 flex-wrap">
                {(['moodle', 'canvas', 'blackboard', 'd2l'] as LmsType[]).map((type) => (
                  <Button
                    key={type}
                    variant={manualType === type ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setManualType(type)}
                  >
                    {LMS_ICONS[type]} {LMS_NAMES[type]}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>LMS URL</Label>
              <Input value={manualUrl} onChange={(e) => setManualUrl(e.target.value)} placeholder="https://moodle.youruniversity.ac.uk" />
            </div>

            {error && <p className="text-sm text-destructive flex items-center gap-1"><AlertCircle className="w-4 h-4" />{error}</p>}

            <div className="flex gap-2">
              <Button onClick={handleManualConnect} className="flex-1">Continue →</Button>
              <Button variant="ghost" onClick={resetFlow}>← Back</Button>
            </div>
          </div>
        )}

        {/* Step: Connecting/Importing */}
        {(step === 'connecting' || step === 'importing') && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
            <p className="text-sm font-medium text-foreground">
              {step === 'connecting' ? 'Connecting to your university...' : 'Importing your schedule and assignments...'}
            </p>
            <p className="text-xs text-muted-foreground">This may take a moment</p>
          </div>
        )}

        {/* Step: Done */}
        {step === 'done' && importResult && (
          <div className="space-y-4">
            <div className="rounded-lg bg-success/10 p-4 flex items-start gap-3">
              <CheckCircle2 className="w-6 h-6 text-success mt-0.5" />
              <div>
                <p className="font-medium text-foreground">Successfully connected!</p>
                <p className="text-sm text-muted-foreground mt-1">Your schedule and assignments have been imported.</p>
                <div className="flex gap-3 mt-2">
                  <Badge variant="secondary" className="text-xs">
                    <GraduationCap className="w-3 h-3 mr-1" /> {importResult.courses} courses
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    <Calendar className="w-3 h-3 mr-1" /> {importResult.events} events
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    <BookOpen className="w-3 h-3 mr-1" /> {importResult.tasks} assignments
                  </Badge>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleResync}>
                <RefreshCw className="w-4 h-4 mr-2" /> Re-sync
              </Button>
              <Button variant="ghost" onClick={resetFlow}>Connect different university</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
