import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import {
  ArrowLeft, QrCode, MessageCircle, Edit2, Trash2, X,
  UserMinus, RefreshCw, Check, Plus, Megaphone, Calendar,
  Crown, UserPlus, Search,
} from 'lucide-react';
import { toast } from 'sonner';
import QRCode from 'react-qr-code';

const EMOJIS = ['🏆', '⚽', '🏀', '🏈', '🎾', '🏊', '🏋️', '🎭', '🎵', '🏃', '🚴', '🤸', '🎯', '🏐', '🥊'];

interface Member {
  user_id: string;
  role: string;
  profiles: {
    id: string;
    full_name: string | null;
    email: string | null;
    university: string | null;
  } | null;
}

interface Session {
  id: string;
  title: string;
  session_date: string;
  location: string | null;
  notes: string | null;
  created_at: string;
}

interface Announcement {
  id: string;
  body: string;
  created_at: string;
  sender: { full_name: string | null; email: string | null } | null;
}

export default function TeamHubPage() {
  const { teamId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [team, setTeam] = useState<any>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [myRole, setMyRole] = useState<string>('member');
  const [loading, setLoading] = useState(true);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const [sessions, setSessions] = useState<Session[]>([]);
  const [showCreateSession, setShowCreateSession] = useState(false);
  const [sessionTitle, setSessionTitle] = useState('');
  const [sessionDate, setSessionDate] = useState('');
  const [sessionLocation, setSessionLocation] = useState('');
  const [sessionNotes, setSessionNotes] = useState('');
  const [creatingSession, setCreatingSession] = useState(false);

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [showCreateAnnouncement, setShowCreateAnnouncement] = useState(false);
  const [announcementBody, setAnnouncementBody] = useState('');
  const [postingAnnouncement, setPostingAnnouncement] = useState(false);

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editSport, setEditSport] = useState('');
  const [editEmoji, setEditEmoji] = useState('🏆');
  const [saving, setSaving] = useState(false);

  const [showInvite, setShowInvite] = useState(false);
  const [inviteSearch, setInviteSearch] = useState('');
  const [inviteResults, setInviteResults] = useState<any[]>([]);
  const [searchingInvite, setSearchingInvite] = useState(false);
  const [sentInvites, setSentInvites] = useState<Set<string>>(new Set());

  const [transferTarget, setTransferTarget] = useState<string | null>(null);
  const [transferring, setTransferring] = useState(false);

  const [showQR, setShowQR] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isCaptain = myRole === 'captain';

  const loadTeam = async () => {
    if (!teamId || !user) return;
    setLoading(true);

    const [teamRes, membersRes, myMemberRes, convRes, sessionsRes, announcementsRes] = await Promise.all([
      supabase.from('teams').select('*').eq('id', teamId).single(),
      supabase.from('team_members')
        .select('user_id, role, profiles(id, full_name, email, university)')
        .eq('team_id', teamId),
      supabase.from('team_members')
        .select('role').eq('team_id', teamId).eq('user_id', user.id).single(),
      supabase.from('conversations')
        .select('id').eq('team_id', teamId).maybeSingle(),
      supabase.from('team_sessions')
        .select('*').eq('team_id', teamId)
        .gte('session_date', new Date().toISOString())
        .order('session_date').limit(5),
      supabase.from('notifications')
        .select('id, body, created_at, sender:profiles!notifications_sender_id_fkey(full_name, email)')
        .eq('related_team_id', teamId)
        .eq('notification_type', 'announcement')
        .order('created_at', { ascending: false })
        .limit(10),
    ]);

    if (teamRes.data) {
      setTeam(teamRes.data);
      setEditName(teamRes.data.name);
      setEditSport(teamRes.data.sport || '');
      setEditEmoji(teamRes.data.emoji || '🏆');
    }
    if (membersRes.data) setMembers(membersRes.data as Member[]);
    if (myMemberRes.data) setMyRole(myMemberRes.data.role);
    if (convRes.data) setConversationId(convRes.data.id);
    if (sessionsRes.data) setSessions(sessionsRes.data);
    if (announcementsRes.data) setAnnouncements(announcementsRes.data as any);

    setLoading(false);
  };

  useEffect(() => {
    if (!teamId || !user) return;
    loadTeam();
  }, [teamId, user]);

  useEffect(() => {
    if (!inviteSearch.trim() || !user) {
      setInviteResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearchingInvite(true);
      const memberIds = new Set(members.map(m => m.user_id));
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, email, university')
        .ilike('full_name', `%${inviteSearch.trim()}%`)
        .neq('id', user.id)
        .limit(8);
      setInviteResults((data || []).filter((p: any) => !memberIds.has(p.id)));
      setSearchingInvite(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [inviteSearch, members, user]);

  const saveEdit = async () => {
    if (!editName.trim() || !teamId) return;
    setSaving(true);
    const { error } = await supabase.from('teams').update({
      name: editName.trim(),
      sport: editSport || null,
      emoji: editEmoji,
    }).eq('id', teamId);
    if (error) { toast.error('Could not update team'); setSaving(false); return; }
    setTeam((t: any) => ({ ...t, name: editName.trim(), sport: editSport || null, emoji: editEmoji }));
    setEditing(false);
    setSaving(false);
    toast.success('Team updated');
  };

  const removeMember = async (memberId: string, memberName: string) => {
    if (memberId === user?.id) { toast.error("You can't remove yourself"); return; }
    const { error } = await supabase.from('team_members')
      .delete().eq('team_id', teamId).eq('user_id', memberId);
    if (error) { toast.error('Could not remove member'); return; }
    setMembers(prev => prev.filter(m => m.user_id !== memberId));
    toast.success(`${memberName} removed`);
  };

  const transferCaptaincy = async (newCaptainId: string) => {
    if (!teamId || !user) return;
    setTransferring(true);
    await supabase.from('team_members').update({ role: 'member' }).eq('team_id', teamId).eq('user_id', user.id);
    await supabase.from('team_members').update({ role: 'captain' }).eq('team_id', teamId).eq('user_id', newCaptainId);
    await supabase.from('teams').update({ captain_id: newCaptainId }).eq('id', teamId);
    toast.success('Captaincy transferred');
    setTransferTarget(null);
    setTransferring(false);
    setMyRole('member');
    setMembers(prev => prev.map(m => ({
      ...m,
      role: m.user_id === newCaptainId ? 'captain' : m.user_id === user.id ? 'member' : m.role,
    })));
  };

  const inviteMember = async (target: any) => {
    if (!user || !team) return;
    const { error } = await supabase.from('notifications').insert({
      user_id: target.id,
      sender_id: user.id,
      title: 'Team Invite',
      body: `invited you to join ${team.name}`,
      notification_type: 'team_invite',
      related_team_id: teamId,
    });
    if (error) { toast.error('Could not send invite'); return; }
    setSentInvites(prev => new Set([...prev, target.id]));
    toast.success(`Invite sent to ${target.full_name || target.email}`);
  };

  const createSession = async () => {
    if (!sessionTitle.trim() || !sessionDate || !teamId || !user) return;
    setCreatingSession(true);
    const { data: session, error } = await supabase.from('team_sessions').insert({
      team_id: teamId,
      title: sessionTitle.trim(),
      session_date: new Date(sessionDate).toISOString(),
      location: sessionLocation.trim() || null,
      notes: sessionNotes.trim() || null,
      created_by: user.id,
    }).select().single();
    if (error) { toast.error('Could not create session'); setCreatingSession(false); return; }
    const memberNotifications = members
      .filter(m => m.user_id !== user.id)
      .map(m => ({
        user_id: m.user_id,
        sender_id: user.id,
        title: 'New Session',
        body: `${team.name}: ${sessionTitle} on ${new Date(sessionDate).toLocaleDateString()}`,
        notification_type: 'session_invite',
        related_team_id: teamId,
      }));
    if (memberNotifications.length > 0) await supabase.from('notifications').insert(memberNotifications);
    setSessions(prev => [...prev, session].sort(
      (a, b) => new Date(a.session_date).getTime() - new Date(b.session_date).getTime()
    ));
    setSessionTitle(''); setSessionDate(''); setSessionLocation(''); setSessionNotes('');
    setShowCreateSession(false);
    setCreatingSession(false);
    toast.success('Session created!');
  };

  const postAnnouncement = async () => {
    if (!announcementBody.trim() || !teamId || !user) return;
    setPostingAnnouncement(true);
    const memberNotifications = members
      .filter(m => m.user_id !== user.id)
      .map(m => ({
        user_id: m.user_id,
        sender_id: user.id,
        title: `📣 ${team.name}`,
        body: announcementBody.trim(),
        notification_type: 'announcement',
        related_team_id: teamId,
      }));
    if (memberNotifications.length > 0) {
      const { error } = await supabase.from('notifications').insert(memberNotifications);
      if (error) { toast.error('Could not post announcement'); setPostingAnnouncement(false); return; }
    }
    const newAnnouncement: Announcement = {
      id: crypto.randomUUID(),
      body: announcementBody.trim(),
      created_at: new Date().toISOString(),
      sender: null,
    };
    setAnnouncements(prev => [newAnnouncement, ...prev]);
    setAnnouncementBody('');
    setShowCreateAnnouncement(false);
    setPostingAnnouncement(false);
    toast.success('Announcement posted!');
  };

  const deleteTeam = async () => {
    if (!teamId) return;
    setDeleting(true);
    const { error } = await supabase.from('teams').delete().eq('id', teamId);
    if (error) { toast.error('Could not delete team'); setDeleting(false); return; }
    toast.success('Team deleted');
    navigate('/social');
  };

  const leaveTeam = async () => {
    if (!teamId || !user) return;
    const { error } = await supabase.from('team_members')
      .delete().eq('team_id', teamId).eq('user_id', user.id);
    if (error) { toast.error('Could not leave team'); return; }
    // Also remove from group chat if exists
    if (conversationId) {
      await supabase.from('conversation_members')
        .delete().eq('conversation_id', conversationId).eq('user_id', user.id);
    }
    toast.success(`Left ${team.name}`);
    navigate('/social');
  };

  const openGroupChat = async () => {
    if (!conversationId || !teamId) return;
    navigate(`/chat/${conversationId}`);
  };

  const getTeamQRValue = () =>
    team ? `rute://team/${team.invite_token || team.invite_code}` : '';

  if (loading) {
    return (
      <div className="px-5 pt-14 pb-24 space-y-3">
        {[1, 2, 3].map(i => <div key={i} className="glass-card rounded-xl p-4 animate-pulse h-16" />)}
      </div>
    );
  }

  if (!team) {
    return (
      <div className="px-5 pt-14 pb-24 text-center">
        <p className="text-muted-foreground">Team not found</p>
        <button onClick={() => navigate('/social')} className="text-primary text-sm mt-2">← Back to Social</button>
      </div>
    );
  }

  return (
    <div className="px-5 pt-14 animate-fade-in pb-24">

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/social')}
          className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center shrink-0">
          <ArrowLeft className="w-4 h-4 text-foreground" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-heading text-2xl font-bold truncate">{team.emoji} {team.name}</h1>
          {team.sport && <p className="text-xs text-muted-foreground">{team.sport}</p>}
        </div>
        {isCaptain && (
          <button onClick={() => setEditing(!editing)}
            className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center shrink-0">
            <Edit2 className="w-4 h-4 text-foreground" />
          </button>
        )}
      </div>

      {/* Edit Team Form */}
      {editing && isCaptain && (
        <div className="glass-card rounded-2xl p-4 space-y-3 mb-4">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-sm">Edit Team</p>
            <button onClick={() => setEditing(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
          </div>
          <div className="flex flex-wrap gap-2">
            {EMOJIS.map(e => (
              <button key={e} onClick={() => setEditEmoji(e)}
                className={cn('text-xl p-2 rounded-xl transition-all',
                  editEmoji === e ? 'bg-primary/20 ring-2 ring-primary' : 'bg-secondary')}>
                {e}
              </button>
            ))}
          </div>
          <input type="text" value={editName} onChange={e => setEditName(e.target.value)}
            placeholder="Team name"
            className="w-full bg-secondary/60 rounded-xl px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40" />
          <input type="text" value={editSport} onChange={e => setEditSport(e.target.value)}
            placeholder="Sport / Activity (optional)"
            className="w-full bg-secondary/60 rounded-xl px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40" />
          <div className="flex gap-2">
            <button onClick={saveEdit} disabled={!editName.trim() || saving}
              className="flex-1 bg-primary text-primary-foreground rounded-xl py-2 text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {saving ? 'Saving...' : 'Save changes'}
            </button>
            <button onClick={() => setEditing(false)}
              className="px-4 bg-secondary text-muted-foreground rounded-xl py-2 text-sm">Cancel</button>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        {conversationId && (
          <button onClick={openGroupChat}
            className="glass-card rounded-2xl p-4 flex items-center gap-3 hover:bg-white/5 transition-colors">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <MessageCircle className="w-4 h-4 text-primary" />
            </div>
            <div className="text-left">
              <p className="font-semibold text-sm">Group Chat</p>
              <p className="text-xs text-muted-foreground">Open chat</p>
            </div>
          </button>
        )}
        <button onClick={() => setShowQR(!showQR)}
          className="glass-card rounded-2xl p-4 flex items-center gap-3 hover:bg-white/5 transition-colors">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <QrCode className="w-4 h-4 text-primary" />
          </div>
          <div className="text-left">
            <p className="font-semibold text-sm">Invite Code</p>
            <p className="text-xs text-muted-foreground">{showQR ? 'Hide QR' : 'Show QR'}</p>
          </div>
        </button>
      </div>

      {/* QR Code */}
      {showQR && (
        <div className="glass-card rounded-2xl p-4 mb-4 text-center">
          <div className="bg-white p-4 rounded-2xl inline-block mb-3">
            <QRCode value={getTeamQRValue()} size={160} level="M" />
          </div>
          <p className="text-xs text-muted-foreground mb-2">Or share this code:</p>
          <p className="text-sm font-mono font-bold text-foreground bg-secondary/50 px-4 py-2 rounded-lg inline-block tracking-widest">
            {team.invite_code}
          </p>
        </div>
      )}

      {/* Announcements */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold">Announcements</p>
          {isCaptain && (
            <button onClick={() => setShowCreateAnnouncement(!showCreateAnnouncement)}
              className="flex items-center gap-1 text-xs text-primary font-medium">
              <Plus className="w-3 h-3" />Post
            </button>
          )}
        </div>
        {isCaptain && showCreateAnnouncement && (
          <div className="glass-card rounded-2xl p-4 space-y-3 mb-3">
            <textarea value={announcementBody} onChange={e => setAnnouncementBody(e.target.value)}
              placeholder="Write your announcement..." rows={3}
              className="w-full bg-secondary/60 rounded-xl px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none" />
            <div className="flex gap-2">
              <button onClick={postAnnouncement} disabled={!announcementBody.trim() || postingAnnouncement}
                className="flex-1 bg-primary text-primary-foreground rounded-xl py-2 text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
                <Megaphone className="w-4 h-4" />
                {postingAnnouncement ? 'Posting...' : 'Post Announcement'}
              </button>
              <button onClick={() => setShowCreateAnnouncement(false)}
                className="px-4 bg-secondary text-muted-foreground rounded-xl py-2 text-sm">Cancel</button>
            </div>
          </div>
        )}
        {announcements.length === 0 ? (
          <div className="glass-card rounded-xl px-4 py-3 text-center">
            <p className="text-xs text-muted-foreground">No announcements yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {announcements.map(a => (
              <div key={a.id} className="glass-card rounded-xl px-4 py-3">
                <p className="text-sm text-foreground">{a.body}</p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {a.sender?.full_name || 'Captain'} · {new Date(a.created_at).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sessions */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold">Upcoming Sessions</p>
          {isCaptain && (
            <button onClick={() => setShowCreateSession(!showCreateSession)}
              className="flex items-center gap-1 text-xs text-primary font-medium">
              <Plus className="w-3 h-3" />Add
            </button>
          )}
        </div>
        {isCaptain && showCreateSession && (
          <div className="glass-card rounded-2xl p-4 space-y-3 mb-3">
            <input type="text" value={sessionTitle} onChange={e => setSessionTitle(e.target.value)}
              placeholder="Session title (e.g. Training, Practice)"
              className="w-full bg-secondary/60 rounded-xl px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40" />
            <input type="datetime-local" value={sessionDate} onChange={e => setSessionDate(e.target.value)}
              className="w-full bg-secondary/60 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
            <input type="text" value={sessionLocation} onChange={e => setSessionLocation(e.target.value)}
              placeholder="Location (optional)"
              className="w-full bg-secondary/60 rounded-xl px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40" />
            <textarea value={sessionNotes} onChange={e => setSessionNotes(e.target.value)}
              placeholder="Notes (optional)" rows={2}
              className="w-full bg-secondary/60 rounded-xl px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none" />
            <div className="flex gap-2">
              <button onClick={createSession} disabled={!sessionTitle.trim() || !sessionDate || creatingSession}
                className="flex-1 bg-primary text-primary-foreground rounded-xl py-2 text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
                <Calendar className="w-4 h-4" />
                {creatingSession ? 'Creating...' : 'Create Session'}
              </button>
              <button onClick={() => setShowCreateSession(false)}
                className="px-4 bg-secondary text-muted-foreground rounded-xl py-2 text-sm">Cancel</button>
            </div>
          </div>
        )}
        {sessions.length === 0 ? (
          <div className="glass-card rounded-xl px-4 py-3 text-center">
            <p className="text-xs text-muted-foreground">No upcoming sessions</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sessions.map(s => (
              <div key={s.id} className="glass-card rounded-xl px-4 py-3">
                <p className="font-semibold text-sm">{s.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {new Date(s.session_date).toLocaleDateString('en-GB', {
                    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                  })}
                  {s.location ? ` · ${s.location}` : ''}
                </p>
                {s.notes && <p className="text-xs text-muted-foreground mt-0.5 italic">{s.notes}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Invite Members */}
      {isCaptain && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold">Invite Members</p>
            <button onClick={() => setShowInvite(!showInvite)}
              className="flex items-center gap-1 text-xs text-primary font-medium">
              <UserPlus className="w-3 h-3" />{showInvite ? 'Close' : 'Search'}
            </button>
          </div>
          {showInvite && (
            <div className="glass-card rounded-2xl p-4 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input type="text" value={inviteSearch} onChange={e => setInviteSearch(e.target.value)}
                  placeholder="Search students by name..."
                  className="w-full bg-secondary/60 rounded-xl pl-9 pr-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40" />
              </div>
              {searchingInvite && <p className="text-xs text-muted-foreground text-center">Searching...</p>}
              {!searchingInvite && inviteSearch && inviteResults.length === 0 && (
                <p className="text-xs text-muted-foreground text-center">No students found</p>
              )}
              {inviteResults.map(p => (
                <div key={p.id} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                    <span className="text-primary text-sm font-bold">
                      {(p.full_name || p.email || 'U').charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{p.full_name || p.email}</p>
                    {p.university && <p className="text-xs text-muted-foreground truncate">{p.university}</p>}
                  </div>
                  <button onClick={() => inviteMember(p)} disabled={sentInvites.has(p.id)}
                    className={cn('shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors',
                      sentInvites.has(p.id)
                        ? 'bg-secondary text-muted-foreground'
                        : 'bg-primary/10 text-primary hover:bg-primary/20')}>
                    {sentInvites.has(p.id) ? '✓ Sent' : 'Invite'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Members */}
      <div className="mb-4">
        <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold mb-2">
          Members ({members.length})
        </p>
        <div className="space-y-2">
          {members.map(m => {
            const profile = m.profiles;
            const name = profile?.full_name || profile?.email || 'Unknown';
            const isMe = m.user_id === user?.id;
            return (
              <div key={m.user_id} className="glass-card rounded-xl px-4 py-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                  <span className="text-primary text-sm font-bold">{name.charAt(0).toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">
                    {name} {isMe && <span className="text-muted-foreground">(you)</span>}
                  </p>
                  {profile?.university && (
                    <p className="text-xs text-muted-foreground truncate">{profile.university}</p>
                  )}
                </div>
                <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0',
                  m.role === 'captain' ? 'bg-primary/20 text-primary' : 'bg-secondary text-muted-foreground')}>
                  {m.role === 'captain' ? 'Captain' : 'Member'}
                </span>
                {isCaptain && !isMe && m.role !== 'captain' && (
                  <div className="flex items-center gap-1 ml-1">
                    <button onClick={() => setTransferTarget(transferTarget === m.user_id ? null : m.user_id)}
                      className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center" title="Transfer captaincy">
                      <Crown className="w-3.5 h-3.5 text-primary" />
                    </button>
                    <button onClick={() => removeMember(m.user_id, name)}
                      className="w-7 h-7 rounded-full bg-red-500/10 flex items-center justify-center" title="Remove member">
                      <UserMinus className="w-3.5 h-3.5 text-red-400" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {transferTarget && (
          <div className="glass-card rounded-2xl p-4 mt-3 border border-primary/20">
            <p className="font-semibold text-sm mb-1">Transfer Captaincy?</p>
            <p className="text-xs text-muted-foreground mb-4">
              You will become a regular member. This cannot be undone without the new captain's approval.
            </p>
            <div className="flex gap-2">
              <button onClick={() => transferCaptaincy(transferTarget)} disabled={transferring}
                className="flex-1 bg-primary text-primary-foreground rounded-xl py-2 text-sm font-semibold disabled:opacity-50">
                {transferring ? 'Transferring...' : 'Yes, transfer'}
              </button>
              <button onClick={() => setTransferTarget(null)}
                className="px-4 bg-secondary text-muted-foreground rounded-xl py-2 text-sm">Cancel</button>
            </div>
          </div>
        )}
      </div>

      {/* Delete Team (captain only) */}
      {isCaptain && (
        <div className="mt-6">
          {showDeleteConfirm ? (
            <div className="glass-card rounded-2xl p-4 border border-red-500/20">
              <p className="font-semibold text-sm text-red-400 mb-1">Delete {team.name}?</p>
              <p className="text-xs text-muted-foreground mb-4">
                This permanently deletes the team, all members, sessions and group chat. Cannot be undone.
              </p>
              <div className="flex gap-2">
                <button onClick={deleteTeam} disabled={deleting}
                  className="flex-1 bg-red-500 text-white rounded-xl py-2 text-sm font-semibold disabled:opacity-50">
                  {deleting ? 'Deleting...' : 'Yes, delete team'}
                </button>
                <button onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 bg-secondary text-muted-foreground rounded-xl py-2 text-sm">Cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowDeleteConfirm(true)}
              className="w-full flex items-center justify-center gap-2 text-red-400 text-sm font-medium py-3 rounded-2xl border border-red-500/20 hover:bg-red-500/5 transition-colors">
              <Trash2 className="w-4 h-4" />Delete team
            </button>
          )}
        </div>
      )}

      {/* Leave Team (members only) */}
      {!isCaptain && (
        <div className="mt-6">
          <button onClick={leaveTeam}
            className="w-full flex items-center justify-center gap-2 text-red-400 text-sm font-medium py-3 rounded-2xl border border-red-500/20 hover:bg-red-500/5 transition-colors">
            <UserMinus className="w-4 h-4" />Leave team
          </button>
        </div>
      )}
    </div>
  );
}