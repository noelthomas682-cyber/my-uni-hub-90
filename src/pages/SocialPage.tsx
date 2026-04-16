import { useState, useEffect } from 'react';
import { UserPlus, Trophy, QrCode } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

type SubTab = 'contacts' | 'sports' | 'qr';

export default function SocialPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<SubTab>('contacts');
  const [contacts, setContacts] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setLoading(true);

    if (activeTab === 'contacts') {
      supabase
        .from('contacts')
        .select('*')
        .then(({ data }) => { setContacts(data || []); setLoading(false); });
    } else if (activeTab === 'sports') {
      supabase
        .from('teams')
        .select('*')
        .then(({ data }) => { setTeams(data || []); setLoading(false); });
    } else {
      setLoading(false);
    }
  }, [user, activeTab]);

  const tabs: { key: SubTab; label: string; icon: typeof UserPlus }[] = [
    { key: 'contacts', label: 'Contacts', icon: UserPlus },
    { key: 'sports', label: 'Sports', icon: Trophy },
    { key: 'qr', label: 'QR Codes', icon: QrCode },
  ];

  return (
    <div className="px-5 pt-14 animate-fade-in">
      <h1 className="font-heading text-2xl font-bold mb-5">Social</h1>

      <div className="flex gap-2 mb-5">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all",
              activeTab === tab.key
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground"
            )}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="glass-card rounded-xl p-4 animate-pulse h-16" />)}
        </div>
      ) : (
        <>
          {activeTab === 'contacts' && (
            <div className="space-y-2">
              {contacts.length === 0 ? (
                <div className="text-center py-10">
                  <UserPlus className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm">No contacts yet</p>
                  <p className="text-muted-foreground text-xs mt-1">Add classmates via QR code</p>
                </div>
              ) : contacts.map(c => (
                <div key={c.id} className="glass-card rounded-xl p-4 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center">
                    <span className="text-primary text-sm font-bold">
                      {(c.nickname || 'U').charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{c.nickname || 'Unknown'}</p>
                    <p className="text-xs text-muted-foreground capitalize">{c.status}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'sports' && (
            <div className="space-y-2">
              {teams.length === 0 ? (
                <div className="text-center py-10">
                  <Trophy className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm">No teams yet</p>
                </div>
              ) : teams.map(t => (
                <div key={t.id} className="glass-card rounded-xl p-4">
                  <p className="font-medium text-sm">{t.name}</p>
                  {t.description && <p className="text-xs text-muted-foreground mt-1">{t.description}</p>}
                  {t.course_code && (
                    <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full mt-2 inline-block">
                      {t.course_code}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {activeTab === 'qr' && (
            <div className="text-center py-10">
              <div className="glass-card rounded-2xl p-8 inline-block mb-4">
                <QrCode className="w-32 h-32 text-primary mx-auto" />
              </div>
              <p className="text-sm text-muted-foreground">Share your QR code to add contacts</p>
              <p className="text-xs text-muted-foreground mt-1">Scan a friend's code to connect</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
