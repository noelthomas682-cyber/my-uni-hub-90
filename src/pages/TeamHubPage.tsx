import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { ArrowLeft, QrCode, MessageCircle, Edit2, Trash2, X, UserMinus, RefreshCw, Check } from 'lucide-react';
import { toast } from 'sonner';
import QRCode from 'react-qr-code';

const EMOJIS = ['🏆', '⚽', '🏀', '🏈', '🎾', '🏊', '🏋️', '🎭', '🎵', '🏃', '🚴', '🤸', '🎯', '🏐', '🥊'];

export default function TeamHubPage() {
  const { teamId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [team, setTeam] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [myRole, setMyRole] = useState<string>('member');
  const [loading, setLoading] = useState(true);
  const [showQR, setShowQR] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editSport, setEditSport] = useState('');
  const [editEmoji, setEditEmoji] = useState('🏆');
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);

  useEffect(() => {
    if (!teamId || !user) return;
    loadTeam();
  }, [teamId, user]);

  const loadTeam = async () => {
    if (!teamId || !user) return;
    setLoading(true);

    const [teamRes, membersRes, myMemberRes, convRes] = await Promise.all([
      supabase.from('teams').select('*').eq('id', teamId).single(),
      supabase.from('team_members')
        .select('user_id, role, profiles(id, full_name, email, university)')
        .eq('team_id', teamId),
      supabase.from('team_members')
        .select('role').eq('team_id', teamId).eq('user_id', user.id).single(),
      supabase.from('conversations')
        .select('id').eq('team_id', teamId).maybeSingle(),
    ]);

    if (teamRes.data) {
      setTeam(teamRes.data);
      setEditName(teamRes.data.name);
      setEditSport(teamRes.data.sport || '');
      setEditEmoji(teamRes.data.emoji || '🏆');
    }
    if (membersRes.data) setMembers(membersRes.data);
    if (myMemberRes.data) setMyRole(myMemberRes.data.role);
    if (convRes.data) setConversationId(convRes.data.id);

    setLoading(false);
  };

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
    toast.success(`${memberName} removed from team`);
  };

  const deleteTeam = async () => {
    if (!teamId) return;
    setDeleting(true);
    const { error } = await supabase.from('teams').delete().eq('id', teamId);
    if (error) { toast.error('Could not delete team'); setDeleting(false); return; }
    toast.success('Team deleted');
    navigate('/social');
  };

  const getTeamQRValue = () => team ? `rute://team/${team.invite_token || team.invite_code}` : '';

  if (loading) {
    return (
      <div className="px-5 pt-14 pb-24">
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="glass-card rounded-xl p-4 animate-pulse h-16" />)}
        </div>
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

  const isCaptain = myRole === 'captain';

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

      {/* Edit Form */}
      {editing && isCaptain && (
        <div className="glass-card rounded-2xl p-4 space-y-3 mb-4">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-sm">Edit Team</p>
            <button onClick={() => setEditing(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
          </div>
          <div className="flex flex-wrap gap-2">
            {EMOJIS.map(e => (
              <button key={e} onClick={() => setEditEmoji(e)}
                className={cn('text-xl p-2 rounded-xl transition-all', editEmoji === e ? 'bg-primary/20 ring-2 ring-primary' : 'bg-secondary')}>
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

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        {conversationId && (
          <button onClick={() => navigate('/chat')}
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
                  <p className="font-medium text-sm truncate">{name} {isMe && <span className="text-muted-foreground">(you)</span>}</p>
                  {profile?.university && <p className="text-xs text-muted-foreground truncate">{profile.university}</p>}
                </div>
                <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0',
                  m.role === 'captain' ? 'bg-primary/20 text-primary' : 'bg-secondary text-muted-foreground')}>
                  {m.role === 'captain' ? 'Captain' : 'Member'}
                </span>
                {isCaptain && !isMe && m.role !== 'captain' && (
                  <button onClick={() => removeMember(m.user_id, name)}
                    className="shrink-0 w-7 h-7 rounded-full bg-red-500/10 flex items-center justify-center ml-1">
                    <UserMinus className="w-3.5 h-3.5 text-red-400" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Delete Team */}
      {isCaptain && (
        <div className="mt-6">
          {showDeleteConfirm ? (
            <div className="glass-card rounded-2xl p-4 border border-red-500/20">
              <p className="font-semibold text-sm text-red-400 mb-1">Delete {team.name}?</p>
              <p className="text-xs text-muted-foreground mb-4">
                This will permanently delete the team, all members, sessions and the group chat. This cannot be undone.
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
    </div>
  );
}