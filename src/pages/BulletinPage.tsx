import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { MapPin, Clock, Check, Plus, X, Megaphone, GraduationCap, ExternalLink, RefreshCw, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type BulletinTab = 'university' | 'sessions';

function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="glass-card rounded-xl p-4 flex items-center gap-3 border border-red-500/20">
      <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
      <p className="text-xs text-red-400 flex-1">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="shrink-0 text-red-400">
          <RefreshCw className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

export default function BulletinPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<BulletinTab>('university');
  const [sessions, setSessions] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [rsvps, setRsvps] = useState<Record<string, string>>({});
  const [captainTeams, setCaptainTeams] = useState<any[]>([]);
  const [userDomain, setUserDomain] = useState<string | null>(null);
  const [uniName, setUniName] = useState<string>('Your University');
  const [loading, setLoading] = useState(true);
  const [domainLoading, setDomainLoading] = useState(true);
  const [fetchingFeed, setFetchingFeed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddSession, setShowAddSession] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newStart, setNewStart] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [newTeamId, setNewTeamId] = useState('');
  const [newType, setNewType] = useState('training');
  const [saving, setSaving] = useState(false);
  const [announcementFilter, setAnnouncementFilter] = useState<'all' | 'news' | 'events'>('all');

  useEffect(() => {
    if (!user) return;

    supabase.from('team_members')
      .select('team_id, role')
      .eq('user_id', user.id)
      .eq('role', 'captain')
      .then(async ({ data: memberships }) => {
        if (!memberships || memberships.length === 0) return;
        const teamIds = memberships.map((m: any) => m.team_id);
        const { data: teamsData } = await supabase.from('teams').select('id, name, emoji').in('id', teamIds);
        const teams = teamsData || [];
        setCaptainTeams(teams);
        if (teams.length > 0) setNewTeamId(teams[0].id);
      });

    supabase.from('profiles')
      .select('university')
      .eq('id', user.id)
      .single()
      .then(async ({ data: profile, error }) => {
        if (error || !profile) { setDomainLoading(false); return; }

        if (profile.university) {
          let domain: string;
          if (profile.university.includes('.')) {
            domain = profile.university.toLowerCase();
          } else {
            domain = profile.university.toLowerCase().replace(/\s+/g, '') + '.ac.uk';
          }
          setUserDomain(domain);
          setUniName('University of ' + profile.university.charAt(0).toUpperCase() + profile.university.slice(1).split('.')[0]);
        }

        const { data: lmsConn } = await supabase
          .from('lms_connections').select('email_domain, lms_name')
          .eq('user_id', user.id).maybeSingle();

        if (lmsConn?.email_domain) {
          setUserDomain(lmsConn.email_domain);
          if (lmsConn.lms_name && lmsConn.lms_name !== 'Calendar Sync') {
            setUniName(lmsConn.lms_name);
          }
        }

        setDomainLoading(false);
      });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    setError(null);

    if (activeTab === 'sessions') {
      setLoading(true);
      supabase.from('team_members').select('team_id').eq('user_id', user.id)
        .then(async ({ data: memberships, error: membError }) => {
          if (membError) { setError('Could not load sessions.'); setLoading(false); return; }
          const teamIds = (memberships || []).map((m: any) => m.team_id);
          if (teamIds.length === 0) { setSessions([]); setLoading(false); return; }

          const [sessRes, rsvpRes] = await Promise.all([
            supabase.from('team_sessions')
              .select('*, teams(name, emoji)')
              .in('team_id', teamIds)
              .gte('start_time', new Date().toISOString())
              .order('start_time').limit(20),
            supabase.from('session_rsvps').select('*').eq('user_id', user.id),
          ]);

          if (sessRes.error) { setError('Could not load sessions.'); setLoading(false); return; }
          setSessions(sessRes.data || []);
          const map: Record<string, string> = {};
          (rsvpRes.data || []).forEach((r: any) => { map[r.session_id] = r.status; });
          setRsvps(map);
          setLoading(false);
        });

    } else if (activeTab === 'university') {
      if (domainLoading) return;
      if (!userDomain) { setLoading(false); return; }
      loadAnnouncements(userDomain);
    }
  }, [user, activeTab, userDomain, domainLoading]);

  const loadAnnouncements = async (domain: string) => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('announcements').select('*')
      .eq('university_domain', domain)
      .order('published_at', { ascending: false }).limit(30);
    if (error) { setError('Could not load announcements.'); setLoading(false); return; }
    setAnnouncements(data || []);
    setLoading(false);
    if (!data || data.length === 0) fetchUniFeed(domain);
  };

  const fetchUniFeed = async (domain: string) => {
    if (!domain) return;
    setFetchingFeed(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-uni-feed', { body: { domain } });
      if (error) throw new Error(error.message);
      if (data?.error === 'University not supported yet') {
        toast.error("Your university isn't in our system yet — we're adding new ones regularly.");
        setFetchingFeed(false);
        return;
      }
      toast.success('Feed updated: ' + ((data?.news ?? 0) + (data?.events ?? 0)) + ' items');
      const { data: fresh } = await supabase
        .from('announcements').select('*')
        .eq('university_domain', domain)
        .order('published_at', { ascending: false }).limit(30);
      setAnnouncements(fresh || []);
    } catch (err: any) {
      toast.error('Could not fetch feed. Please try again later.');
    }
    setFetchingFeed(false);
  };

  const handleRsvp = async (sessionId: string) => {
    if (!user) return;
    const current = rsvps[sessionId];
    if (current) {
      const { error } = await supabase.from('session_rsvps').delete().eq('session_id', sessionId).eq('user_id', user.id);
      if (error) { toast.error('Could not update RSVP'); return; }
      setRsvps(prev => { const n = { ...prev }; delete n[sessionId]; return n; });
      toast.success('RSVP removed');
    } else {
      const { error } = await supabase.from('session_rsvps').insert({ session_id: sessionId, user_id: user.id, status: 'going' });
      if (error) { toast.error('Could not RSVP'); return; }
      setRsvps(prev => ({ ...prev, [sessionId]: 'going' }));
      toast.success('You are going!');
    }
  };

  const addSession = async () => {
    if (!newTitle.trim() || !newStart || !user || !newTeamId) return;
    setSaving(true);
    const { data, error } = await supabase.from('team_sessions').insert({
      team_id: newTeamId,
      title: newTitle.trim(),
      start_time: new Date(newStart).toISOString(),
      end_time: new Date(newStart).toISOString(),
      location: newLocation || null,
      notes: newNotes || null,
      session_type: newType,
    }).select('*, teams(name, emoji)').single();

    if (error) { toast.error('Could not create session. Please try again.'); setSaving(false); return; }
    setSessions(prev => [data, ...prev].sort((a, b) =>
      new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    ));
    setNewTitle(''); setNewStart(''); setNewLocation(''); setNewNotes('');
    setShowAddSession(false);
    toast.success('Session posted to your team');
    setSaving(false);
  };

  const SESSION_TYPES = ['training', 'match', 'practice', 'trip', 'meeting', 'social', 'other'];
  const filteredAnnouncements = announcements.filter(a =>
    announcementFilter === 'all' ? true : a.source === announcementFilter
  );

  return (
    <div className="px-5 pt-14 animate-fade-in pb-24">
      <h1 className="font-heading text-2xl font-bold mb-5">Bulletin</h1>

      <div className="flex gap-2 mb-5">
        {[
          { key: 'university', label: 'University', Icon: GraduationCap },
          { key: 'sessions', label: 'Sessions', Icon: Megaphone },
        ].map(({ key, label, Icon }) => (
          <button key={key} onClick={() => setActiveTab(key as BulletinTab)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all shrink-0',
              activeTab === key ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
            )}>
            <Icon className="w-3.5 h-3.5" />{label}
          </button>
        ))}
      </div>

      {error && <ErrorBanner message={error} onRetry={() => activeTab === 'sessions'
        ? (setError(null) as any)
        : userDomain && loadAnnouncements(userDomain)} />}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="glass-card rounded-xl p-4 animate-pulse h-24" />)}
        </div>
      ) : (
        <>
          {activeTab === 'sessions' && (
            <div className="space-y-3">
              {captainTeams.length > 0 && (
                showAddSession ? (
                  <div className="glass-card rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-sm">Post a Session</p>
                      <button onClick={() => setShowAddSession(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
                    </div>
                    {captainTeams.length > 1 && (
                      <select value={newTeamId} onChange={e => setNewTeamId(e.target.value)}
                        className="w-full bg-secondary/60 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
                        {captainTeams.map(t => <option key={t.id} value={t.id}>{t.emoji} {t.name}</option>)}
                      </select>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {SESSION_TYPES.map(type => (
                        <button key={type} onClick={() => setNewType(type)}
                          className={cn('px-3 py-1 rounded-full text-xs font-medium capitalize transition-all',
                            newType === type ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground')}>
                          {type}
                        </button>
                      ))}
                    </div>
                    <input type="text" placeholder="Session title" value={newTitle}
                      onChange={e => setNewTitle(e.target.value)}
                      className="w-full bg-secondary/60 rounded-xl px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40" />
                    <input type="datetime-local" value={newStart} onChange={e => setNewStart(e.target.value)}
                      className="w-full bg-secondary/60 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
                    <input type="text" placeholder="Location (optional)" value={newLocation}
                      onChange={e => setNewLocation(e.target.value)}
                      className="w-full bg-secondary/60 rounded-xl px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40" />
                    <textarea placeholder="Notes for your team (optional)" value={newNotes}
                      onChange={e => setNewNotes(e.target.value)} rows={2}
                      className="w-full bg-secondary/60 rounded-xl px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none" />
                    <div className="flex gap-2">
                      <button onClick={addSession} disabled={saving || !newTitle.trim() || !newStart}
                        className="flex-1 bg-primary text-primary-foreground rounded-xl py-2 text-sm font-semibold disabled:opacity-50">
                        {saving ? 'Posting...' : 'Post to team'}
                      </button>
                      <button onClick={() => setShowAddSession(false)}
                        className="px-4 bg-secondary text-muted-foreground rounded-xl py-2 text-sm">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setShowAddSession(true)}
                    className="w-full glass-card rounded-2xl p-4 flex items-center justify-center gap-2 text-sm font-semibold text-primary border border-dashed border-primary/30 hover:bg-primary/5 transition-colors">
                    <Plus className="w-4 h-4" />Post a session
                  </button>
                )
              )}
              {sessions.length === 0 ? (
                <div className="text-center py-10">
                  <Megaphone className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm">No upcoming sessions</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {captainTeams.length > 0 ? 'Post a session for your team above' : 'Join a team to see sessions here'}
                  </p>
                </div>
              ) : sessions.map(s => {
                const going = !!rsvps[s.id];
                return (
                  <div key={s.id} className="glass-card rounded-xl p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          {s.teams?.emoji && <span className="text-base">{s.teams.emoji}</span>}
                          <p className="text-xs text-primary font-medium">{s.teams?.name}</p>
                          {s.session_type && <span className="text-[10px] bg-secondary text-muted-foreground px-2 py-0.5 rounded-full capitalize">{s.session_type}</span>}
                        </div>
                        <h3 className="font-semibold text-sm truncate">{s.title}</h3>
                        {s.notes && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{s.notes}</p>}
                      </div>
                      <button onClick={() => handleRsvp(s.id)}
                        className={cn('shrink-0 ml-3 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all',
                          going ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground')}>
                        {going && <Check className="w-3 h-3" />}{going ? 'Going' : 'RSVP'}
                      </button>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2">
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{format(new Date(s.start_time), 'MMM d · h:mm a')}</span>
                      {s.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{s.location}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === 'university' && (
            <div className="space-y-4">
              {!userDomain ? (
                <div className="text-center py-16">
                  <GraduationCap className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm">Connect your university first</p>
                  <p className="text-xs text-muted-foreground mt-1">Go to Me → Connect LMS to link your university</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sm">{uniName}</p>
                      <p className="text-xs text-muted-foreground">Latest news and events</p>
                    </div>
                    <button onClick={() => fetchUniFeed(userDomain)} disabled={fetchingFeed}
                      className="flex items-center gap-1.5 text-xs text-primary font-medium">
                      <RefreshCw className={cn('w-3.5 h-3.5', fetchingFeed && 'animate-spin')} />
                      {fetchingFeed ? 'Updating...' : 'Refresh'}
                    </button>
                  </div>
                  <div className="flex gap-2">
                    {(['all', 'news', 'events'] as const).map(f => (
                      <button key={f} onClick={() => setAnnouncementFilter(f)}
                        className={cn('px-3 py-1 rounded-full text-xs font-medium capitalize transition-all',
                          announcementFilter === f ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground')}>
                        {f}
                      </button>
                    ))}
                  </div>
                  {filteredAnnouncements.length === 0 ? (
                    <div className="text-center py-16">
                      <GraduationCap className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                      <p className="text-muted-foreground text-sm">No announcements yet</p>
                      <button onClick={() => fetchUniFeed(userDomain)} className="text-xs text-primary font-medium mt-2">Fetch now</button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredAnnouncements.map(a => (
                        <div key={a.id} className="glass-card rounded-xl p-4">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium capitalize',
                                  a.source === 'news' ? 'bg-blue-500/10 text-blue-400' : 'bg-purple-500/10 text-purple-400')}>
                                  {a.source_label || a.source}
                                </span>
                                {a.published_at && <span className="text-[10px] text-muted-foreground">{format(new Date(a.published_at), 'MMM d')}</span>}
                              </div>
                              <h3 className="font-semibold text-sm leading-snug mb-1">{a.title}</h3>
                              {a.description && (
                                <p className="text-xs text-muted-foreground line-clamp-2">
                                  {a.description.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim()}
                                </p>
                              )}
                            </div>
                            {a.url && (
                              <button onClick={() => window.open(a.url, '_blank')}
                                className="shrink-0 w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                                <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}