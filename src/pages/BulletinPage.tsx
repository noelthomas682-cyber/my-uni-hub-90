import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { MapPin, Clock, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

export default function BulletinPage() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<any[]>([]);
  const [rsvps, setRsvps] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    Promise.all([
      supabase
        .from('team_sessions')
        .select('*')
        .gte('start_time', new Date().toISOString())
        .order('start_time')
        .limit(20),
      supabase
        .from('session_rsvps')
        .select('*')
    ]).then(([sessRes, rsvpRes]) => {
      setSessions(sessRes.data || []);
      const map: Record<string, string> = {};
      (rsvpRes.data || []).forEach((r: any) => {
        if (r.user_id === user.id) map[r.session_id] = r.status;
      });
      setRsvps(map);
      setLoading(false);
    });
  }, [user]);

  const handleRsvp = async (sessionId: string) => {
    if (!user) return;
    const current = rsvps[sessionId];

    if (current) {
      await supabase.from('session_rsvps').delete().eq('session_id', sessionId).eq('user_id', user.id);
      setRsvps(prev => { const n = { ...prev }; delete n[sessionId]; return n; });
    } else {
      await supabase.from('session_rsvps').insert({ session_id: sessionId, user_id: user.id, status: 'going' });
      setRsvps(prev => ({ ...prev, [sessionId]: 'going' }));
    }
  };

  return (
    <div className="px-5 pt-14 animate-fade-in">
      <h1 className="font-heading text-2xl font-bold mb-5">Bulletin</h1>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="glass-card rounded-xl p-4 animate-pulse h-24" />)}
        </div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-muted-foreground text-sm">No upcoming events</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map(s => {
            const going = !!rsvps[s.id];
            return (
              <div key={s.id} className="glass-card rounded-xl p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm">{s.title}</h3>
                    {s.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{s.description}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleRsvp(s.id)}
                    className={cn(
                      "shrink-0 ml-3 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                      going
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-muted-foreground"
                    )}
                  >
                    {going && <Check className="w-3 h-3" />}
                    {going ? 'Going' : 'RSVP'}
                  </button>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {format(new Date(s.start_time), 'MMM d · h:mm a')}
                  </span>
                  {s.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {s.location}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
