import { useEffect, useState } from 'react';
import { LogOut, ChevronRight, Moon, Bell, Shield, Pencil, Link, Check, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function MePage() {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState('');
  const [university, setUniversity] = useState('');
  const [course, setCourse] = useState('');
  const [year, setYear] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from('profiles').select('*').eq('id', user.id).single().then(({ data }) => {
      setProfile(data);
      setFullName(data?.full_name || '');
      setUniversity(data?.university || '');
      setCourse(data?.course || '');
      setYear(data?.year?.toString() || '');
    });
  }, [user]);

  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from('profiles').update({
      full_name: fullName,
      university,
      course,
      year: parseInt(year) || null,
      updated_at: new Date().toISOString(),
    }).eq('id', user.id);
    if (error) { toast.error('Could not save profile'); }
    else {
      setProfile((p: any) => ({ ...p, full_name: fullName, university, course, year: parseInt(year) || null }));
      toast.success('Profile updated');
      setEditing(false);
    }
    setSaving(false);
  };

  const settingsItems = [
    { icon: Bell, label: 'Notifications' },
    { icon: Moon, label: 'Appearance' },
    { icon: Shield, label: 'Privacy & Security' },
    { icon: Link, label: 'Connect LMS', href: '/lms-settings' },
  ];

  return (
    <div className="px-5 pt-14 animate-fade-in pb-24">
      <h1 className="font-heading text-2xl font-bold mb-6">Me</h1>

      {/* Profile Card */}
      <div className="glass-card rounded-2xl p-5 mb-6">
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
            <p className="font-heading font-bold text-base truncate">
              {profile?.full_name || 'Student'}
            </p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            {profile?.university && (
              <p className="text-xs text-primary mt-0.5">{profile.university}</p>
            )}
            {profile?.course && (
              <p className="text-xs text-muted-foreground">{profile.course}{profile?.year ? ` · Year ${profile.year}` : ''}</p>
            )}
          </div>
          <button onClick={() => setEditing(!editing)}
            className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
            <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>

        {/* Edit form */}
        {editing && (
          <div className="space-y-2 pt-3 border-t border-border/40">
            <input type="text" placeholder="Full name" value={fullName}
              onChange={e => setFullName(e.target.value)}
              className="w-full bg-secondary/60 rounded-xl px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40" />
            <input type="text" placeholder="University" value={university}
              onChange={e => setUniversity(e.target.value)}
              className="w-full bg-secondary/60 rounded-xl px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40" />
            <input type="text" placeholder="Course / Program" value={course}
              onChange={e => setCourse(e.target.value)}
              className="w-full bg-secondary/60 rounded-xl px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40" />
            <input type="number" placeholder="Year (e.g. 2)" value={year}
              onChange={e => setYear(e.target.value)}
              className="w-full bg-secondary/60 rounded-xl px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40" />
            <div className="flex gap-2 pt-1">
              <button onClick={saveProfile} disabled={saving}
                className="flex-1 bg-primary text-primary-foreground rounded-xl py-2 text-sm font-semibold flex items-center justify-center gap-1">
                <Check className="w-3.5 h-3.5" />{saving ? 'Saving...' : 'Save'}
              </button>
              <button onClick={() => setEditing(false)}
                className="px-4 bg-secondary text-muted-foreground rounded-xl py-2 text-sm flex items-center gap-1">
                <X className="w-3.5 h-3.5" />Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Settings */}
      <div className="glass-card rounded-2xl overflow-hidden mb-6">
        {settingsItems.map((item) => (
          <button key={item.label}
            onClick={() => item.href && (window.location.href = item.href)}
            className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-secondary/50 transition-colors border-b border-border/40 last:border-0">
            <item.icon className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium flex-1">{item.label}</span>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        ))}
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