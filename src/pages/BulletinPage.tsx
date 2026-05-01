import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { MapPin, Clock, Check, Plus, X, Megaphone, GraduationCap, ExternalLink, RefreshCw, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { trackEvent } from '@/lib/trackEvent'; // bulletin_view + session_rsvp signals
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

type BulletinTab = 'university' | 'sessions';
type AnnouncementFilter = 'all' | 'news' | 'events';

interface TeamSession {
  id: string;
  title: string;
  session_date: string;
  location: string | null;
  notes: string | null;
  teams: { name: string; emoji: string } | null;
}

interface Announcement {
  id: string;
  title: string;
  description: string | null;
  source: string;
  source_label: string | null;
  published_at: string | null;
  url: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SESSION_TYPES = ['training', 'match', 'practice', 'trip', 'meeting', 'social', 'other'];

// ─── Sub-components ───────────────────────────────────────────────────────────

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

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BulletinPage() {
  const { user } = useAuth();

  // ── Tab state ─────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<BulletinTab>('university');

  // ── University tab state ──────────────────────────────────────────────────
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [announcementFilter, setAnnouncementFilter] = useState<AnnouncementFilter>('all');
  const [userDomain, setUserDomain] = useState<string | null>(null);
  const [uniName, setUniName] = useState<string>('Your University');
  const [domainLoading, setDomainLoading] = useState(true);
  const [fetchingFeed, setFetchingFeed] = useState(false);

  // ── Sessions tab state ────────────────────────────────────────────────────
  const [sessions, setSessions] = useState<TeamSession[]>([]);
  const [rsvps, setRsvps] = useState<Record<string, string>>({});
  const [captainTeams, setCaptainTeams] = useState<any[]>([]);

  // ── Add session form state ────────────────────────────────────────────────
  const [showAddSession, setShowAddSession] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [newTeamId, setNewTeamId] = useState('');
  const [newType, setNewType] = useState('training');
  const [saving, setSaving] = useState(false);

  // ── Shared state ──────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Initialisation: load captain teams + user domain ─────────────────────

  useEffect(() => {
    if (!user) return;

    // Load teams where user is captain (for session creation)
    supabase
      .from('team_members')
      .select('team_id, role')
      .eq('user_id', user.id)
      .eq('role', 'captain')
      .then(async ({ data: memberships }) => {
        if (!memberships || memberships.length === 0) return;
        const teamIds = memberships.map((m: any) => m.team_id);
        const { data: teamsData } = await supabase
          .from('teams')
          .select('id, name, emoji')
          .in('id', teamIds);
        const teams = teamsData || [];
        setCaptainTeams(teams);
        if (teams.length > 0) setNewTeamId(teams[0].id);
      });

    // Determine university domain from LMS connection or profile
    supabase
      .from('profiles')
      .select('university')
      .eq('id', user.id)
      .single()
      .then(async ({ data: profile, error }) => {
        if (error || !profile) { setDomainLoading(false); return; }

        // Derive domain from university field
        if (profile.university) {
          const domain = profile.university.includes('.')
            ? profile.university.toLowerCase()
            : profile.university.toLowerCase().replace(/\s+/g, '') + '.ac.uk';
          setUserDomain(domain);
          const displayName = profile.university.charAt(0).toUpperCase() + profile.university.slice(1).split('.')[0];
          setUniName('University of ' + displayName);
        }

        // Override with LMS connection data if available (more accurate)
        const { data: lmsConn } = await supabase
          .from('lms_connections')
          .select('email_domain, lms_name')
          .eq('user_id', user.id)
          .maybeSingle();

        if (lmsConn?.email_domain) {
          setUserDomain(lmsConn.email_domain);
          if (lmsConn.lms_name && lmsConn.lms_name !== 'Calendar Sync') {
            setUniName(lmsConn.lms_name);
          }
        }

        setDomainLoading(false);
      });
  }, [user]);

  // ── Tab-specific data loading ─────────────────────────────────────────────

  useEffect(() => {
    if (!user) return;
    setError(null);

    if (activeTab === 'sessions') {
      loadSessions();
    } else if (activeTab === 'university') {
      // Wait for domain to resolve before loading announcements
      if (domainLoading) return;
      if (!userDomain) { setLoading(false); return; }
      loadAnnouncements(userDomain);
    }
  }, [user, activeTab, userDomain, domainLoading]);

  // ── Data fetching ─────────────────────────────────────────────────────────

  const loadSessions = async () => {
    if (!user) return;
    setLoading(true);

    const { data: memberships, error: membError } = await supabase
      .from('team_members')
      .select('team_id')
      .eq('user_id', user.id);

    if (membError) { setError('Could not load sessions.'); setLoading(false); return; }

    const teamIds = (memberships || []).map((m: any) => m.team_id);
    if (teamIds.length === 0) { setSessions([]); setLoading(false); return; }

    // Fetch upcoming sessions and user's RSVPs in parallel
    const [sessRes, rsvpRes] = await Promise.all([
      supabase
        .from('team_sessions')
        .select('*, teams(name, emoji)')
        .in('team_id', teamIds)
        .gte('session_date', new Date().toISOString())  // ✅ correct column name
        .order('session_date')
        .limit(20),
      supabase
        .from('session_rsvps')
        .select('*')
        .eq('user_id', user.id),
    ]);

    if (sessRes.error) { setError('Could not load sessions.'); setLoading(false); return; }

    setSessions(sessRes.data as TeamSession[] || []);

    // Build RSVP lookup map: session_id → status
    const rsvpMap: Record<string, string> = {};
    (rsvpRes.data || []).forEach((r: any) => { rsvpMap[r.session_id] = r.status; });
    setRsvps(rsvpMap);

    setLoading(false);
  };

  const loadAnnouncements = async (domain: string) => {
    if (user) await trackEvent(user.id, 'bulletin_view', { domain });
    setLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .eq('university_domain', domain)
      .order('published_at', { ascending: false })
      .limit(30);

    if (error) { setError('Could not load announcements.'); setLoading(false); return; }

    setAnnouncements(data as Announcement[] || []);
    setLoading(false);

    // If no cached announcements, try fetching fresh from Edge Function
    if (!data || data.length === 0) fetchUniFeed(domain);
  };

  // Fetch fresh university news via Edge Function — fails gracefully if not deployed
  const fetchUniFeed = async (domain: string) => {
    if (!domain) return;
    setFetchingFeed(true);

    try {
      const { data, error } = await supabase.functions.invoke('fetch-uni-feed', { body: { domain } });

      if (error) {
        // Edge Function not deployed yet — silent fail
        console.warn('fetch-uni-feed not available:', error.message);
        setFetchingFeed(false);
        return;
      }

      if (data?.error === 'University not supported yet') {
        toast.error("Your university isn't in our system yet — we're adding new ones regularly.");
        setFetchingFeed(false);
        return;
      }

      const count = (data?.news ?? 0) + (data?.events ?? 0);
      if (count > 0) {
        toast.success(`Feed updated: ${count} items`);
        // Reload announcements with fresh data
        const { data: fresh } = await supabase
          .from('announcements')
          .select('*')
          .eq('university_domain', domain)
          .order('published_at', { ascending: false })
          .limit(30);
        setAnnouncements(fresh as Announcement[] || []);
      }
    } catch (err: any) {
      // Swallow network/deploy errors silently
      console.warn('fetch-uni-feed error:', err?.message);
    }

    setFetchingFeed(false);
  };

  // ── Actions ───────────────────────────────────────────────────────────────

  const handleRsvp = async (sessionId: string) => {
    if (!user) return;
    const isGoing = !!rsvps[sessionId];

    if (isGoing) {
      // Remove RSVP
      const { error } = await supabase
        .from('session_rsvps')
        .delete()
        .eq('session_id', sessionId)
        .eq('user_id', user.id);
      if (error) { toast.error('Could not update RSVP'); return; }
      setRsvps(prev => { const n = { ...prev }; delete n[sessionId]; return n; });
      toast.success('RSVP removed');
    } else {
      // Add RSVP
      const { error } = await supabase
        .from('session_rsvps')
        .insert({ session_id: sessionId, user_id: user.id, status: 'going' });
      if (error) { toast.error('Could not RSVP'); return; }
      await trackEvent(user.id, 'session_rsvp', { session_id: sessionId });
      setRsvps(prev => ({ ...prev, [sessionId]: 'going' }));
      toast.success('You are going!');
    }
  };

  const addSession = async () => {
    if (!newTitle.trim() || !newDate || !user || !newTeamId) return;
    setSaving(true);

    const { data, error } = await supabase
      .from('team_sessions')
      .insert({
        team_id: newTeamId,
        created_by: user.id,
        title: newTitle.trim(),
        session_date: new Date(newDate).toISOString(),  // ✅ correct column name
        location: newLocation.trim() || null,
        notes: newNotes.trim() || null,                  // ✅ correct column name
      })
      .select('*, teams(name, emoji)')
      .single();

    if (error) { toast.error('Could not create session. Please try again.'); setSaving(false); return; }

    // Add to list, sorted by date
    setSessions(prev =>
      [...prev, data as TeamSession].sort(
        (a, b) => new Date(a.session_date).getTime() - new Date(b.session_date).getTime()
      )
    );

    // Reset form
    setNewTitle('');
    setNewDate('');
    setNewLocation('');
    setNewNotes('');
    setShowAddSession(false);
    setSaving(false);
    toast.success('Session posted to your team');
  };

  // ── Derived values ────────────────────────────────────────────────────────

  const filteredAnnouncements = announcements.filter(a =>
    announcementFilter === 'all' ? true : a.source === announcementFilter
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="px-5 pt-14 animate-fade-in pb-24">
      <h1 className="font-heading text-2xl font-bold mb-5">Bulletin</h1>

      {/* ── Tab Switcher ── */}
      <div className="flex gap-2 mb-5">
        {[
          { key: 'university', label: 'University', Icon: GraduationCap },
          { key: 'sessions', label: 'Sessions', Icon: Megaphone },
        ].map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key as BulletinTab)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all shrink-0',
              activeTab === key ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
            )}>
            <Icon className="w-3.5 h-3.5" />{label}
          </button>
        ))}
      </div>

      {/* ── Error Banner ── */}
      {error && (
        <ErrorBanner
          message={error}
          onRetry={activeTab === 'sessions'
            ? loadSessions
            : userDomain ? () => loadAnnouncements(userDomain) : undefined}
        />
      )}

      {/* ── Loading Skeleton ── */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="glass-card rounded-xl p-4 animate-pulse h-24" />)}
        </div>
      ) : (
        <>

          {/* ══ SESSIONS TAB ══ */}
          {activeTab === 'sessions' && (
            <div className="space-y-3">

              {/* Add session button/form — captain only */}
              {captainTeams.length > 0 && (
                showAddSession ? (
                  <div className="glass-card rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-sm">Post a Session</p>
                      <button onClick={() => setShowAddSession(false)}>
                        <X className="w-4 h-4 text-muted-foreground" />
                      </button>
                    </div>

                    {/* Team selector — only if captain of multiple teams */}
                    {captainTeams.length > 1 && (
                      <select
                        value={newTeamId}
                        onChange={e => setNewTeamId(e.target.value)}
                        className="w-full bg-secondary/60 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
                        {captainTeams.map(t => <option key={t.id} value={t.id}>{t.emoji} {t.name}</option>)}
                      </select>
                    )}

                    {/* Session type pills */}
                    <div className="flex flex-wrap gap-2">
                      {SESSION_TYPES.map(type => (
                        <button
                          key={type}
                          onClick={() => setNewType(type)}
                          className={cn(
                            'px-3 py-1 rounded-full text-xs font-medium capitalize transition-all',
                            newType === type ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
                          )}>
                          {type}
                        </button>
                      ))}
                    </div>

                    <input
                      type="text"
                      placeholder="Session title"
                      value={newTitle}
                      onChange={e => setNewTitle(e.target.value)}
                      className="w-full bg-secondary/60 rounded-xl px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40" />

                    <input
                      type="datetime-local"
                      value={newDate}
                      onChange={e => setNewDate(e.target.value)}
                      className="w-full bg-secondary/60 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />

                    <input
                      type="text"
                      placeholder="Location (optional)"
                      value={newLocation}
                      onChange={e => setNewLocation(e.target.value)}
                      className="w-full bg-secondary/60 rounded-xl px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40" />

                    <textarea
                      placeholder="Notes for your team (optional)"
                      value={newNotes}
                      onChange={e => setNewNotes(e.target.value)}
                      rows={2}
                      className="w-full bg-secondary/60 rounded-xl px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none" />

                    <div className="flex gap-2">
                      <button
                        onClick={addSession}
                        disabled={saving || !newTitle.trim() || !newDate}
                        className="flex-1 bg-primary text-primary-foreground rounded-xl py-2 text-sm font-semibold disabled:opacity-50">
                        {saving ? 'Posting...' : 'Post to team'}
                      </button>
                      <button
                        onClick={() => setShowAddSession(false)}
                        className="px-4 bg-secondary text-muted-foreground rounded-xl py-2 text-sm">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowAddSession(true)}
                    className="w-full glass-card rounded-2xl p-4 flex items-center justify-center gap-2 text-sm font-semibold text-primary border border-dashed border-primary/30 hover:bg-primary/5 transition-colors">
                    <Plus className="w-4 h-4" />Post a session
                  </button>
                )
              )}

              {/* Sessions list */}
              {sessions.length === 0 ? (
                <div className="text-center py-10">
                  <Megaphone className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm">No upcoming sessions</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {captainTeams.length > 0
                      ? 'Post a session for your team above'
                      : 'Join a team to see sessions here'}
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
                        </div>
                        <h3 className="font-semibold text-sm truncate">{s.title}</h3>
                        {s.notes && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{s.notes}</p>
                        )}
                      </div>
                      <button
                        onClick={() => handleRsvp(s.id)}
                        className={cn(
                          'shrink-0 ml-3 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all',
                          going ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
                        )}>
                        {going && <Check className="w-3 h-3" />}
                        {going ? 'Going' : 'RSVP'}
                      </button>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {format(new Date(s.session_date), 'MMM d · h:mm a')}
                      </span>
                      {s.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />{s.location}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ══ UNIVERSITY TAB ══ */}
          {activeTab === 'university' && (
            <div className="space-y-4">
              {!userDomain ? (
                // User hasn't connected their university yet
                <div className="text-center py-16">
                  <GraduationCap className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm">Connect your university first</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Go to Me → Connect LMS to link your university
                  </p>
                </div>
              ) : (
                <>
                  {/* University header + refresh */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sm">{uniName}</p>
                      <p className="text-xs text-muted-foreground">Latest news and events</p>
                    </div>
                    <button
                      onClick={() => fetchUniFeed(userDomain)}
                      disabled={fetchingFeed}
                      className="flex items-center gap-1.5 text-xs text-primary font-medium">
                      <RefreshCw className={cn('w-3.5 h-3.5', fetchingFeed && 'animate-spin')} />
                      {fetchingFeed ? 'Updating...' : 'Refresh'}
                    </button>
                  </div>

                  {/* Filter pills */}
                  <div className="flex gap-2">
                    {(['all', 'news', 'events'] as const).map(f => (
                      <button
                        key={f}
                        onClick={() => setAnnouncementFilter(f)}
                        className={cn(
                          'px-3 py-1 rounded-full text-xs font-medium capitalize transition-all',
                          announcementFilter === f ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
                        )}>
                        {f}
                      </button>
                    ))}
                  </div>

                  {/* Announcements list */}
                  {filteredAnnouncements.length === 0 ? (
                    <div className="text-center py-16">
                      <GraduationCap className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                      <p className="text-muted-foreground text-sm">No announcements yet</p>
                      <button
                        onClick={() => fetchUniFeed(userDomain)}
                        className="text-xs text-primary font-medium mt-2">
                        Fetch now
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredAnnouncements.map(a => (
                        <div key={a.id} className="glass-card rounded-xl p-4">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={cn(
                                  'text-[10px] px-2 py-0.5 rounded-full font-medium capitalize',
                                  a.source === 'news'
                                    ? 'bg-blue-500/10 text-blue-400'
                                    : 'bg-purple-500/10 text-purple-400'
                                )}>
                                  {a.source_label || a.source}
                                </span>
                                {a.published_at && (
                                  <span className="text-[10px] text-muted-foreground">
                                    {format(new Date(a.published_at), 'MMM d')}
                                  </span>
                                )}
                              </div>
                              <h3 className="font-semibold text-sm leading-snug mb-1">{a.title}</h3>
                              {a.description && (
                                <p className="text-xs text-muted-foreground line-clamp-2">
                                  {a.description
                                    .replace(/<[^>]*>/g, '')
                                    .replace(/&nbsp;/g, ' ')
                                    .replace(/&amp;/g, '&')
                                    .replace(/&lt;/g, '<')
                                    .replace(/&gt;/g, '>')
                                    .trim()}
                                </p>
                              )}
                            </div>
                            {a.url && (
                              <button
                                onClick={() => window.open(a.url!, '_blank')}
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