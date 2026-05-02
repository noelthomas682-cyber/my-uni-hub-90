import { useEffect, useState } from 'react';
import { LogOut, ChevronRight, Moon, Sun, Bell, Shield, Pencil, Link, Check, X, AlertTriangle, RefreshCw, Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

const ACTIVITIES = [
  'Gym', 'Running', 'Soccer', 'Basketball', 'Swimming',
  'Piano', 'Guitar', 'Reading', 'Gaming', 'Cooking',
  'Yoga', 'Cycling', 'Dancing', 'Art', 'Meditation'
];

const ACTIVITY_EMOJIS: Record<string, string> = {
  'Gym': '🏋️', 'Running': '🏃', 'Soccer': '⚽', 'Basketball': '🏀',
  'Swimming': '🏊', 'Piano': '🎹', 'Guitar': '🎸', 'Reading': '📚',
  'Gaming': '🎮', 'Cooking': '🍳', 'Yoga': '🧘', 'Cycling': '🚴',
  'Dancing': '💃', 'Art': '🎨', 'Meditation': '🧠',
};

function useTheme() {
  const [isDark, setIsDark] = useState(() =>
    document.documentElement.classList.contains('dark') ||
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );

  const toggle = () => {
    const next = !isDark;
    setIsDark(next);
    if (next) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  return { isDark, toggle };
}

export default function MePage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { isDark, toggle: toggleTheme } = useTheme();

  const [profile, setProfile] = useState<any>(null);
  const [sleepSchedule, setSleepSchedule] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit profile
  const [editingProfile, setEditingProfile] = useState(false);
  const [fullName, setFullName] = useState('');
  const [course, setCourse] = useState('');
  const [year, setYear] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // Edit sleep
  const [editingSleep, setEditingSleep] = useState(false);
  const [sleepTime, setSleepTime] = useState('23:00');
  const [wakeTime, setWakeTime] = useState('07:00');
  const [savingSleep, setSavingSleep] = useState(false);

  // Edit activities
  const [editingActivities, setEditingActivities] = useState(false);
  const [selectedActivities, setSelectedActivities] = useState<string[]>([]);
  const [savingActivities, setSavingActivities] = useState(false);

  const loadData = () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    supabase.from('profiles').select('*').eq('id', user.id).single()
      .then(({ data, error }) => {
        if (error) { setError('Could not load profile. Tap to retry.'); setLoading(false); return; }
        setProfile(data);
        setFullName(data?.full_name || '');
        setCourse(data?.course || '');
        setYear(data?.year?.toString() || '');
        setSelectedActivities(data?.activities || []);
        setLoading(false);
      });

    supabase.from('sleep_schedule').select('*').eq('user_id', user.id).single()
      .then(({ data }) => {
        if (data) {
          setSleepSchedule(data);
          setSleepTime(data.sleep_time || '23:00');
          setWakeTime(data.wake_time || '07:00');
        }
      });
  };

  useEffect(() => { loadData(); }, [user]);

  const saveProfile = async () => {
    if (!user) return;
    setSavingProfile(true);
    const { error } = await supabase.from('profiles').update({
      full_name: fullName,
      course,
      year: parseInt(year) || null,
      updated_at: new Date().toISOString(),
    }).eq('id', user.id);
    if (error) { toast.error('Could not save profile. Please try again.'); }
    else {
      setProfile((p: any) => ({ ...p, full_name: fullName, course, year: parseInt(year) || null }));
      toast.success('Profile updated');
      setEditingProfile(false);
    }
    setSavingProfile(false);
  };

  const saveSleep = async () => {
    if (!user) return;
    setSavingSleep(true);
    const { error } = await supabase.from('sleep_schedule').upsert({
      user_id: user.id,
      sleep_time: sleepTime,
      wake_time: wakeTime,
      updated_at: new Date().toISOString(),
    });
    if (error) { toast.error('Could not save sleep schedule. Please try again.'); }
    else {
      setSleepSchedule({ sleep_time: sleepTime, wake_time: wakeTime });
      toast.success('Sleep schedule updated');
      setEditingSleep(false);
    }
    setSavingSleep(false);
  };

  const saveActivities = async () => {
    if (!user) return;
    setSavingActivities(true);
    const { error } = await supabase.from('profiles').update({
      activities: selectedActivities,
      updated_at: new Date().toISOString(),
    }).eq('id', user.id);
    if (error) { toast.error('Could not save activities. Please try again.'); }
    else {
      setProfile((p: any) => ({ ...p, activities: selectedActivities }));
      toast.success('Activities updated');
      setEditingActivities(false);
    }
    setSavingActivities(false);
  };

  const toggleActivity = (a: string) => {
    setSelectedActivities(prev =>
      prev.includes(a) ? prev.filter(x => x !== a) : prev.length < 5 ? [...prev, a] : prev
    );
  };

  function formatTime(time: string) {
    const [h, m] = time.split(':');
    const hour = parseInt(h);
    const ampm = hour >= 12 ? 'pm' : 'am';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${m}${ampm}`;
  }

  if (loading) {
    return (
      <div className="px-5 pt-14 pb-24">
        <h1 className="font-heading text-2xl font-bold mb-6">Me</h1>
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="glass-card rounded-2xl p-5 animate-pulse h-24" />)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-5 pt-14 pb-24">
        <h1 className="font-heading text-2xl font-bold mb-6">Me</h1>
        <div className="glass-card rounded-2xl p-6 flex flex-col items-center gap-3 border border-red-500/20">
          <AlertTriangle className="w-8 h-8 text-red-400" />
          <p className="text-sm text-red-400 text-center">{error}</p>
          <button onClick={loadData} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-semibold">
            <RefreshCw className="w-4 h-4" />Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-5 pt-14 animate-fade-in pb-24">
      <h1 className="font-heading text-2xl font-bold mb-6">Me</h1>

      {/* Profile Card */}
      <div className="glass-card rounded-2xl p-5 mb-4">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} className="w-full h-full rounded-full object-cover" alt="" />
            ) : (
              <span className="text-primary text-xl font-bold font-heading">
                {(profile?.full_name || user?.email || 'U').charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-heading font-bold text-base truncate">{profile?.full_name || 'Student'}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            {profile?.university && <p className="text-xs text-primary mt-0.5">{profile.university}</p>}
            {profile?.course && (
              <p className="text-xs text-muted-foreground">{profile.course}{profile?.year ? ` · Year ${profile.year}` : ''}</p>
            )}
          </div>
          <button onClick={() => setEditingProfile(!editingProfile)}
            className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
            <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>

        {editingProfile && (
          <div className="space-y-2 pt-3 border-t border-border/40">
            <input type="text" placeholder="Full name" value={fullName}
              onChange={e => setFullName(e.target.value)}
              className="w-full bg-secondary/60 rounded-xl px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40" />
            <input type="text" placeholder="Course / Program" value={course}
              onChange={e => setCourse(e.target.value)}
              className="w-full bg-secondary/60 rounded-xl px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40" />
            <input type="number" placeholder="Year (e.g. 2)" value={year}
              onChange={e => setYear(e.target.value)}
              className="w-full bg-secondary/60 rounded-xl px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40" />
            <div className="flex gap-2 pt-1">
              <button onClick={saveProfile} disabled={savingProfile}
                className="flex-1 bg-primary text-primary-foreground rounded-xl py-2 text-sm font-semibold flex items-center justify-center gap-1">
                <Check className="w-3.5 h-3.5" />{savingProfile ? 'Saving...' : 'Save'}
              </button>
              <button onClick={() => setEditingProfile(false)}
                className="px-4 bg-secondary text-muted-foreground rounded-xl py-2 text-sm flex items-center gap-1">
                <X className="w-3.5 h-3.5" />Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Sleep Schedule */}
      <div className="glass-card rounded-2xl p-5 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Moon className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-sm">Sleep Schedule</p>
              {sleepSchedule ? (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatTime(sleepSchedule.sleep_time)} → {formatTime(sleepSchedule.wake_time)}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground mt-0.5">Not set</p>
              )}
            </div>
          </div>
          <button onClick={() => setEditingSleep(!editingSleep)}
            className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
            <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>

        {editingSleep && (
          <div className="space-y-3 pt-3 mt-3 border-t border-border/40">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Bedtime</label>
                <input type="time" value={sleepTime} onChange={e => setSleepTime(e.target.value)}
                  className="w-full bg-secondary/60 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 mt-1" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Wake up</label>
                <input type="time" value={wakeTime} onChange={e => setWakeTime(e.target.value)}
                  className="w-full bg-secondary/60 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 mt-1" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={saveSleep} disabled={savingSleep}
                className="flex-1 bg-primary text-primary-foreground rounded-xl py-2 text-sm font-semibold flex items-center justify-center gap-1">
                <Check className="w-3.5 h-3.5" />{savingSleep ? 'Saving...' : 'Save'}
              </button>
              <button onClick={() => setEditingSleep(false)}
                className="px-4 bg-secondary text-muted-foreground rounded-xl py-2 text-sm">Cancel</button>
            </div>
          </div>
        )}
      </div>

      {/* Activities */}
      <div className="glass-card rounded-2xl p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Zap className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-sm">Activities</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {profile?.activities?.length > 0 ? profile.activities.join(', ') : 'None set'}
              </p>
            </div>
          </div>
          <button onClick={() => setEditingActivities(!editingActivities)}
            className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
            <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>

        {editingActivities && (
          <div className="space-y-3 pt-3 border-t border-border/40">
            <p className="text-xs text-muted-foreground">Pick up to 5</p>
            <div className="flex flex-wrap gap-2">
              {ACTIVITIES.map(a => (
                <button key={a} onClick={() => toggleActivity(a)}
                  className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                    selectedActivities.includes(a) ? 'bg-primary text-primary-foreground border-primary' : 'border-border')}>
                  <span>{ACTIVITY_EMOJIS[a]}</span>{a}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={saveActivities} disabled={savingActivities}
                className="flex-1 bg-primary text-primary-foreground rounded-xl py-2 text-sm font-semibold flex items-center justify-center gap-1">
                <Check className="w-3.5 h-3.5" />{savingActivities ? 'Saving...' : 'Save'}
              </button>
              <button onClick={() => setEditingActivities(false)}
                className="px-4 bg-secondary text-muted-foreground rounded-xl py-2 text-sm">Cancel</button>
            </div>
          </div>
        )}
      </div>

      {/* Settings */}
      <div className="glass-card rounded-2xl overflow-hidden mb-4">
        {/* Appearance — built */}
        <button onClick={toggleTheme}
          className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-secondary/50 transition-colors border-b border-border/40">
          {isDark ? <Sun className="w-4 h-4 text-muted-foreground" /> : <Moon className="w-4 h-4 text-muted-foreground" />}
          <span className="text-sm font-medium flex-1">Appearance</span>
          <span className="text-xs text-muted-foreground">{isDark ? 'Dark' : 'Light'}</span>
        </button>
        {/* Connect LMS — built */}
        <button onClick={() => navigate('/lms-settings')}
          className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-secondary/50 transition-colors">
          <Link className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium flex-1">Connect LMS</span>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Sign Out */}
      <button onClick={signOut}
        className="w-full glass-card rounded-2xl px-5 py-4 flex items-center gap-3 text-destructive hover:bg-destructive/10 transition-colors">
        <LogOut className="w-4 h-4" />
        <span className="text-sm font-medium">Sign Out</span>
      </button>
    </div>
  );
}