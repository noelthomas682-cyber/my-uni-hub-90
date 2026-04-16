import { useEffect, useState } from 'react';
import { LogOut, ChevronRight, Moon, Bell, Shield } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export default function MePage() {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from('profiles').select('*').eq('id', user.id).single().then(({ data }) => {
      setProfile(data);
    });
  }, [user]);

  const settingsItems = [
    { icon: Bell, label: 'Notifications' },
    { icon: Moon, label: 'Appearance' },
    { icon: Shield, label: 'Privacy & Security' },
  ];

  return (
    <div className="px-5 pt-14 animate-fade-in">
      <h1 className="font-heading text-2xl font-bold mb-6">Me</h1>

      {/* Profile Card */}
      <div className="glass-card rounded-2xl p-5 mb-6 flex items-center gap-4">
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
        </div>
      </div>

      {/* Settings */}
      <div className="glass-card rounded-2xl overflow-hidden mb-6">
        {settingsItems.map((item, i) => (
          <button
            key={item.label}
            className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-secondary/50 transition-colors border-b border-border/40 last:border-0"
          >
            <item.icon className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium flex-1">{item.label}</span>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        ))}
      </div>

      {/* Sign Out */}
      <button
        onClick={signOut}
        className="w-full glass-card rounded-2xl px-5 py-4 flex items-center gap-3 text-destructive hover:bg-destructive/10 transition-colors"
      >
        <LogOut className="w-4 h-4" />
        <span className="text-sm font-medium">Sign Out</span>
      </button>
    </div>
  );
}
