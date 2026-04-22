import { useState, useEffect, useRef } from 'react';
import { UserPlus, Trophy, RefreshCw, Plus, X, Camera, MessageCircle, QrCode, Send, Clock, Check, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import QRCode from 'react-qr-code';
import { toast } from 'sonner';
import { BrowserQRCodeReader } from '@zxing/browser';

type SubTab = 'contacts' | 'teams';

const ACTIVITY_TYPES = [
  { key: 'gym', label: 'Gym', emoji: '🏋️' },
  { key: 'study', label: 'Study', emoji: '📚' },
  { key: 'coffee', label: 'Coffee', emoji: '☕' },
  { key: 'lunch', label: 'Lunch', emoji: '🍕' },
  { key: 'run', label: 'Run', emoji: '🏃' },
  { key: 'other', label: 'Other', emoji: '✨' },
];

function QRScanner({ onResult, onClose }: { onResult: (text: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const reader = new BrowserQRCodeReader();
    reader.decodeFromVideoDevice(undefined, videoRef.current!, (result) => {
      if (result) {
        BrowserQRCodeReader.releaseAllStreams();
        onResult(result.getText());
      }
    }).catch(() => {
      toast.error('Camera access denied');
      onClose();
    });
    return () => { BrowserQRCodeReader.releaseAllStreams(); };
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center">
      <div className="relative w-full max-w-sm px-6">
        <div className="flex items-center justify-between mb-4">
          <p className="text-white font-semibold">Scan QR Code</p>
          <button onClick={() => { BrowserQRCodeReader.releaseAllStreams(); onClose(); }}
            className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
            <X className="w-4 h-4 text-white" />
          </button>
        </div>
        <video ref={videoRef} className="w-full rounded-2xl" />
        <p className="text-white/50 text-xs text-center mt-4">Point camera at a Rute QR code</p>
      </div>
    </div>
  );
}

function GroupChatPrompt({ teamName, onYes, onNo }: { teamName: string; onYes: () => void; onNo: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-6">
      <div className="glass-card rounded-2xl p-6 w-full max-w-sm">
        <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
          <MessageCircle className="w-6 h-6 text-primary" />
        </div>
        <p className="font-heading font-bold text-base text-center mb-1">Create a group chat?</p>
        <p className="text-xs text-muted-foreground text-center mb-6">
          Would you like to automatically create a group chat for{' '}
          <span className="text-foreground font-medium">{teamName}</span>? Members who join will be added automatically.
        </p>
        <div className="flex gap-3">
          <button onClick={onNo} className="flex-1 bg-secondary text-muted-foreground rounded-xl py-2.5 text-sm font-semibold">
            No thanks
          </button>
          <button onClick={onYes} className="flex-1 bg-primary text-primary-foreground rounded-xl py-2.5 text-sm font-semibold">
            Yes, create it
          </button>
        </div>
      </div>
    </div>
  );
}

function ActivityRequestSheet({ contact, onClose, onSent }: { contact: any; onClose: () => void; onSent: () => void }) {
  const { user } = useAuth();
  const [selectedType, setSelectedType] = useState('');
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!selectedType || !user) return;
    setSending(true);
    const activity = ACTIVITY_TYPES.find(a => a.key === selectedType);

    const { error } = await supabase.from('shared_activities').insert({
      owner_id: user.id,
      partner_id: contact.id,
      activity_type: selectedType,
      title: `${activity?.emoji} ${activity?.label}`,
      note: note.trim() || null,
      status: 'pending',
      require_consent: true,
    });

    if (error) { toast.error('Could not send request'); setSending(false); return; }

    await supabase.from('notifications').insert({
      user_id: contact.id,
      title: 'Activity Request',
      body: `wants to ${activity?.label.toLowerCase()} with you${note ? `: "${note}"` : ''}`,
      notification_type: 'activity_request',
    });

    toast.success(`Request sent to ${contact.full_name || contact.email}!`);
    setSending(false);
    onSent();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center">
      <div className="glass-card rounded-t-3xl w-full max-w-lg p-6 pb-10">
        <div className="flex items-center justify-between mb-5">
          <p className="font-heading font-bold text-base">Send a request</p>
          <button onClick={onClose}><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          What do you want to do with <span className="text-foreground font-medium">{contact.full_name || contact.email}</span>?
        </p>
        <div className="grid grid-cols-3 gap-2 mb-5">
          {ACTIVITY_TYPES.map(a => (
            <button key={a.key} onClick={() => setSelectedType(a.key)}
              className={cn('flex flex-col items-center gap-1.5 p-3 rounded-2xl border transition-all',
                selectedType === a.key ? 'border-primary bg-primary/10' : 'border-border/40 bg-secondary/40')}>
              <span className="text-2xl">{a.emoji}</span>
              <span className="text-xs font-medium">{a.label}</span>
            </button>
          ))}
        </div>
        <input type="text" placeholder="Add a note (optional)" value={note}
          onChange={e => setNote(e.target.value)}
          className="w-full bg-secondary/60 rounded-xl px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 mb-4" />
        <button onClick={send} disabled={!selectedType || sending}
          className="w-full bg-primary text-primary-foreground rounded-xl py-3 text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
          <Send className="w-4 h-4" />{sending ? 'Sending...' : 'Send Request'}
        </button>
      </div>
    </div>
  );
}

function IncomingRequests({ userId }: { userId: string }) {
  const [requests, setRequests] = useState<any[]>([]);
  const [suggestingFor, setSuggestingFor] = useState<string | null>(null);
  const [proposedTime, setProposedTime] = useState('');

  useEffect(() => {
    supabase.from('shared_activities')
      .select('*, owner:profiles!shared_activities_owner_id_fkey(full_name, email)')
      .eq('partner_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .then(({ data }) => setRequests(data || []));
  }, [userId]);

  const respond = async (id: string, status: 'accepted' | 'declined') => {
    await supabase.from('shared_activities').update({ status }).eq('id', id);
    setRequests(prev => prev.filter(r => r.id !== id));
    toast.success(status === 'accepted' ? 'Request accepted!' : 'Request declined');
  };

  const suggestTime = async (id: string) => {
    if (!proposedTime) return;
    await supabase.from('shared_activities').update({
      status: 'rescheduled',
      proposed_time: new Date(proposedTime).toISOString(),
    }).eq('id', id);
    setRequests(prev => prev.filter(r => r.id !== id));
    setSuggestingFor(null);
    toast.success('Alternative time suggested!');
  };

  if (requests.length === 0) return null;

  return (
    <div className="space-y-2 mb-2">
      <p className="text-[10px] text-primary uppercase tracking-widest font-bold">Incoming Requests</p>
      {requests.map(r => (
        <div key={r.id} className="glass-card rounded-xl p-4 border border-primary/20">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
              <span className="text-primary text-sm font-bold">
                {(r.owner?.full_name || r.owner?.email || 'U').charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">{r.owner?.full_name || r.owner?.email}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {r.title}{r.note ? ` · "${r.note}"` : ''}
              </p>
            </div>
          </div>
          {suggestingFor === r.id ? (
            <div className="space-y-2">
              <input type="datetime-local" value={proposedTime} onChange={e => setProposedTime(e.target.value)}
                className="w-full bg-secondary/60 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
              <div className="flex gap-2">
                <button onClick={() => suggestTime(r.id)} disabled={!proposedTime}
                  className="flex-1 bg-primary text-primary-foreground rounded-xl py-2 text-xs font-semibold disabled:opacity-50">
                  Send suggestion
                </button>
                <button onClick={() => setSuggestingFor(null)}
                  className="px-3 bg-secondary text-muted-foreground rounded-xl text-xs">Cancel</button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => respond(r.id, 'accepted')}
                className="flex-1 flex items-center justify-center gap-1 bg-primary text-primary-foreground rounded-xl py-2 text-xs font-semibold">
                <Check className="w-3 h-3" />Accept
              </button>
              <button onClick={() => setSuggestingFor(r.id)}
                className="flex-1 flex items-center justify-center gap-1 bg-secondary text-muted-foreground rounded-xl py-2 text-xs font-semibold">
                <Clock className="w-3 h-3" />Another time
              </button>
              <button onClick={() => respond(r.id, 'declined')}
                className="flex-1 flex items-center justify-center gap-1 bg-destructive/10 text-destructive rounded-xl py-2 text-xs font-semibold">
                <XCircle className="w-3 h-3" />Decline
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function SocialPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<SubTab>('contacts');
  const [contacts, setContacts] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [scanInput, setScanInput] = useState('');
  const [scanning, setScanning] = useState(false);
  const [showContactScanner, setShowContactScanner] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [requestTarget, setRequestTarget] = useState<any>(null);
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [teamSport, setTeamSport] = useState('');
  const [teamEmoji, setTeamEmoji] = useState('🏆');
  const [creatingTeam, setCreatingTeam] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<any>(null);
  const [joinInput, setJoinInput] = useState('');
  const [joining, setJoining] = useState(false);
  const [showJoinScanner, setShowJoinScanner] = useState(false);
  const [pendingGroupChatTeam, setPendingGroupChatTeam] = useState<any>(null);

  const EMOJIS = ['🏆', '⚽', '🏀', '🏈', '🎾', '🏊', '🏋️', '🎭', '🎵', '🏃', '🚴', '🤸'];

  useEffect(() => {
    if (!user) return;
    supabase.from('profiles').select('qr_token, full_name, university')
      .eq('id', user.id).single()
      .then(({ data }) => { if (data) setProfile(data); });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    if (activeTab === 'contacts') {
      supabase.from('contacts')
        .select('contact_id, profiles!contacts_contact_id_fkey(id, full_name, email, university, course)')
        .eq('user_id', user.id)
        .then(({ data }) => {
          setContacts(data?.map((d: any) => d.profiles).filter(Boolean) || []);
          setLoading(false);
        });
    } else if (activeTab === 'teams') {
      supabase.from('team_members').select('team_id, role').eq('user_id', user.id)
        .then(async ({ data: memberships }) => {
          if (!memberships || memberships.length === 0) { setTeams([]); setLoading(false); return; }
          const teamIds = memberships.map((m: any) => m.team_id);
          const { data: teamsData } = await supabase.from('teams').select('*').in('id', teamIds);
          const merged = (teamsData || []).map((t: any) => {
            const m = memberships.find((mm: any) => mm.team_id === t.id);
            return { ...t, myRole: m?.role || 'member' };
          });
          setTeams(merged);
          setLoading(false);
        });
    }
  }, [user, activeTab]);

  const regenerateToken = async () => {
    if (!user) return;
    setRegenerating(true);
    const newToken = crypto.randomUUID();
    await supabase.from('profiles').update({ qr_token: newToken }).eq('id', user.id);
    setProfile((p: any) => ({ ...p, qr_token: newToken }));
    setRegenerating(false);
    toast.success('QR code refreshed');
  };

  const addContactByToken = async (raw: string) => {
    if (!raw.trim() || !user) return;
    setScanning(true);
    const token = raw.includes('rute://add/') ? raw.split('rute://add/')[1] : raw.trim();
    const { data: found } = await supabase.from('profiles').select('id, full_name, email').eq('qr_token', token).single();
    if (!found) { toast.error('Invalid QR code'); setScanning(false); return; }
    if (found.id === user.id) { toast.error("That's your own QR code"); setScanning(false); return; }
    const { data: existing } = await supabase.from('contacts').select('id').eq('user_id', user.id).eq('contact_id', found.id).maybeSingle();
    if (existing) { toast.error('Already in your contacts'); setScanning(false); return; }
    await supabase.from('contacts').insert([
      { user_id: user.id, contact_id: found.id },
      { user_id: found.id, contact_id: user.id },
    ]);
    toast.success(`Added ${found.full_name || found.email} as a contact`);
    setScanInput('');
    setScanning(false);
    setShowQR(false);
  };

  const joinTeamByCode = async (raw: string) => {
    if (!raw.trim() || !user) return;
    setJoining(true);
    const code = raw.includes('rute://team/') ? raw.split('rute://team/')[1] : raw.trim();
    const { data: team, error: teamError } = await supabase.from('teams').select('*').eq('invite_code', code).single();
    if (!team || teamError) { toast.error('Invalid team code'); setJoining(false); return; }
    const { data: existing } = await supabase.from('team_members').select('team_id').eq('team_id', team.id).eq('user_id', user.id).maybeSingle();
    if (existing) { toast.error('Already in this team'); setJoining(false); return; }
    const { error: insertError } = await supabase.from('team_members').insert({ team_id: team.id, user_id: user.id, role: 'member' });
    if (insertError) { toast.error('Could not join team'); setJoining(false); return; }
    const { data: conv } = await supabase.from('conversations').select('id').eq('team_id', team.id).maybeSingle();
    if (conv) {
      await supabase.from('conversation_members').insert({ conversation_id: conv.id, user_id: user.id });
      toast.success(`Joined ${team.name}! Added to group chat.`);
    } else { toast.success(`Joined ${team.name}!`); }
    setTeams(prev => [...prev, { ...team, myRole: 'member' }]);
    setJoinInput('');
    setJoining(false);
  };

  const createTeam = async () => {
    if (!teamName.trim() || !user) return;
    setCreatingTeam(true);
    const inviteCode = Math.random().toString(36).substring(2, 10).toUpperCase();
    const { data: team, error } = await supabase.from('teams').insert({
      name: teamName.trim(), sport: teamSport || null, emoji: teamEmoji,
      captain_id: user.id, university: profile?.university || null,
      invite_code: inviteCode, invite_token: crypto.randomUUID(),
    }).select().single();
    if (error) { toast.error('Could not create team: ' + error.message); setCreatingTeam(false); return; }
    await supabase.from('team_members').insert({ team_id: team.id, user_id: user.id, role: 'captain' });
    const newTeam = { ...team, myRole: 'captain' };
    setTeams(prev => [...prev, newTeam]);
    setTeamName(''); setTeamSport(''); setTeamEmoji('🏆');
    setShowCreateTeam(false);
    setCreatingTeam(false);
    setSelectedTeam(newTeam);
    setPendingGroupChatTeam(newTeam);
  };

  const createGroupChat = async (team: any) => {
    if (!user) return;
    const { data: conv, error } = await supabase.from('conversations').insert({ type: 'group', name: team.name, team_id: team.id }).select().single();
    if (conv && !error) {
      await supabase.from('conversation_members').insert({ conversation_id: conv.id, user_id: user.id });
      toast.success(`Group chat created for ${team.name}!`);
    } else { toast.error('Could not create group chat'); }
    setPendingGroupChatTeam(null);
  };

  const skipGroupChat = (team: any) => {
    setPendingGroupChatTeam(null);
    toast.success(`${team.name} created! Share the QR code to add members.`);
  };

  const getTeamQRValue = (team: any) => `rute://team/${team.invite_token || team.invite_code}`;
  const qrValue = profile?.qr_token ? `rute://add/${profile.qr_token}` : '';

  return (
    <div className="px-5 pt-14 animate-fade-in pb-24">
      {showJoinScanner && <QRScanner onResult={(text) => { setShowJoinScanner(false); joinTeamByCode(text); }} onClose={() => setShowJoinScanner(false)} />}
      {showContactScanner && <QRScanner onResult={(text) => { setShowContactScanner(false); addContactByToken(text); }} onClose={() => setShowContactScanner(false)} />}
      {pendingGroupChatTeam && <GroupChatPrompt teamName={pendingGroupChatTeam.name} onYes={() => createGroupChat(pendingGroupChatTeam)} onNo={() => skipGroupChat(pendingGroupChatTeam)} />}
      {requestTarget && <ActivityRequestSheet contact={requestTarget} onClose={() => setRequestTarget(null)} onSent={() => {}} />}

      <h1 className="font-heading text-2xl font-bold mb-5">Social</h1>

      <div className="flex gap-2 mb-5">
        {[{ key: 'contacts', label: 'Contacts', icon: UserPlus }, { key: 'teams', label: 'Teams', icon: Trophy }].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as SubTab)}
            className={cn('flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all',
              activeTab === tab.key ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground')}>
            <tab.icon className="w-3.5 h-3.5" />{tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="glass-card rounded-xl p-4 animate-pulse h-16" />)}</div>
      ) : (
        <>
          {activeTab === 'contacts' && (
            <div className="space-y-3">
              {user && <IncomingRequests userId={user.id} />}

              <div className="glass-card rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-semibold text-sm">Your QR Code</p>
                    <p className="text-xs text-muted-foreground">Share so classmates can add you</p>
                  </div>
                  <button onClick={() => setShowQR(!showQR)} className="flex items-center gap-1 text-xs text-primary font-medium">
                    <QrCode className="w-3.5 h-3.5" />{showQR ? 'Hide' : 'Show'}
                  </button>
                </div>

                {showQR && (
                  <div className="text-center pt-2">
                    {qrValue ? (
                      <div className="bg-white p-4 rounded-2xl inline-block mb-3">
                        <QRCode value={qrValue} size={160} level="M" />
                      </div>
                    ) : <div className="w-[160px] h-[160px] bg-secondary rounded-2xl mx-auto mb-3 animate-pulse" />}
                    <p className="text-xs text-muted-foreground mb-2">
                      {profile?.full_name || 'Your name'}{profile?.university ? ` · ${profile.university}` : ''}
                    </p>
                    <button onClick={regenerateToken} disabled={regenerating}
                      className="flex items-center gap-1.5 mx-auto text-xs text-muted-foreground hover:text-foreground transition-colors">
                      <RefreshCw className={cn('w-3 h-3', regenerating && 'animate-spin')} />
                      {regenerating ? 'Refreshing...' : 'Refresh QR code'}
                    </button>
                  </div>
                )}

                <div className={cn('space-y-2', showQR && 'mt-4 pt-4 border-t border-border/40')}>
                  <button onClick={() => setShowContactScanner(true)}
                    className="w-full flex items-center justify-center gap-2 bg-primary/10 text-primary rounded-xl py-3 text-sm font-semibold hover:bg-primary/20 transition-colors">
                    <Camera className="w-4 h-4" />Scan to Add Contact
                  </button>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-xs text-muted-foreground">or paste token</span>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                  <div className="flex gap-2">
                    <input type="text" value={scanInput} onChange={e => setScanInput(e.target.value)} placeholder="Paste token..."
                      className="flex-1 bg-secondary/60 rounded-xl px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40" />
                    <button onClick={() => addContactByToken(scanInput)} disabled={!scanInput.trim() || scanning}
                      className="px-4 bg-primary text-primary-foreground rounded-xl text-sm font-semibold disabled:opacity-50">
                      {scanning ? '...' : 'Add'}
                    </button>
                  </div>
                </div>
              </div>

              {contacts.length === 0 ? (
                <div className="text-center py-8">
                  <UserPlus className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm">No contacts yet</p>
                  <p className="text-xs text-muted-foreground mt-1">Scan a classmate's QR code to add them</p>
                </div>
              ) : contacts.map(c => (
                <div key={c.id} className="glass-card rounded-xl p-4 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                    <span className="text-primary text-sm font-bold">{(c.full_name || c.email || 'U').charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{c.full_name || c.email}</p>
                    {c.university && <p className="text-xs text-muted-foreground truncate">{c.university}</p>}
                  </div>
                  <button onClick={() => setRequestTarget(c)}
                    className="shrink-0 flex items-center gap-1 bg-primary/10 text-primary px-3 py-1.5 rounded-full text-xs font-semibold hover:bg-primary/20 transition-colors">
                    <Send className="w-3 h-3" />Request
                  </button>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'teams' && (
            <div className="space-y-3">
              {showCreateTeam ? (
                <div className="glass-card rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-sm">Create Team</p>
                    <button onClick={() => setShowCreateTeam(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {EMOJIS.map(e => (
                      <button key={e} onClick={() => setTeamEmoji(e)}
                        className={cn('text-xl p-2 rounded-xl transition-all', teamEmoji === e ? 'bg-primary/20 ring-2 ring-primary' : 'bg-secondary')}>
                        {e}
                      </button>
                    ))}
                  </div>
                  <input type="text" placeholder="Team name" value={teamName} onChange={e => setTeamName(e.target.value)}
                    className="w-full bg-secondary/60 rounded-xl px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40" />
                  <input type="text" placeholder="Sport / Activity (optional)" value={teamSport} onChange={e => setTeamSport(e.target.value)}
                    className="w-full bg-secondary/60 rounded-xl px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40" />
                  <div className="flex gap-2">
                    <button onClick={createTeam} disabled={!teamName.trim() || creatingTeam}
                      className="flex-1 bg-primary text-primary-foreground rounded-xl py-2 text-sm font-semibold disabled:opacity-50">
                      {creatingTeam ? 'Creating...' : 'Create Team'}
                    </button>
                    <button onClick={() => setShowCreateTeam(false)} className="px-4 bg-secondary text-muted-foreground rounded-xl py-2 text-sm">Cancel</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setShowCreateTeam(true)}
                  className="w-full glass-card rounded-2xl p-4 flex items-center justify-center gap-2 text-sm font-semibold text-primary border border-dashed border-primary/30 hover:bg-primary/5 transition-colors">
                  <Plus className="w-4 h-4" />Create a team
                </button>
              )}

              <div className="glass-card rounded-2xl p-4">
                <p className="font-semibold text-sm mb-3">Join a Team</p>
                <button onClick={() => setShowJoinScanner(true)}
                  className="w-full flex items-center justify-center gap-2 bg-primary/10 text-primary rounded-xl py-3 text-sm font-semibold mb-3 hover:bg-primary/20 transition-colors">
                  <Camera className="w-4 h-4" />Scan Team QR Code
                </button>
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground">or paste code</span>
                  <div className="flex-1 h-px bg-border" />
                </div>
                <div className="flex gap-2">
                  <input type="text" value={joinInput} onChange={e => setJoinInput(e.target.value)} placeholder="Paste invite code..."
                    className="flex-1 bg-secondary/60 rounded-xl px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40" />
                  <button onClick={() => joinTeamByCode(joinInput)} disabled={!joinInput.trim() || joining}
                    className="px-4 bg-primary text-primary-foreground rounded-xl text-sm font-semibold disabled:opacity-50">
                    {joining ? '...' : 'Join'}
                  </button>
                </div>
              </div>

              {teams.length === 0 ? (
                <div className="text-center py-8">
                  <Trophy className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm">No teams yet</p>
                  <p className="text-xs text-muted-foreground mt-1">Create or join a team above</p>
                </div>
              ) : teams.map(t => (
                <div key={t.id} className="glass-card rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{t.emoji || '🏆'}</span>
                      <div>
                        <p className="font-medium text-sm">{t.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {t.sport && <p className="text-xs text-muted-foreground">{t.sport}</p>}
                          <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium',
                            t.myRole === 'captain' ? 'bg-primary/20 text-primary' : 'bg-secondary text-muted-foreground')}>
                            {t.myRole === 'captain' ? 'Captain' : 'Member'}
                          </span>
                        </div>
                      </div>
                    </div>
                    {t.myRole === 'captain' && (
                      <button onClick={() => setSelectedTeam(selectedTeam?.id === t.id ? null : t)}
                        className="flex items-center gap-1 text-xs text-primary font-medium">
                        <QrCode className="w-3.5 h-3.5" />{selectedTeam?.id === t.id ? 'Hide' : 'Share'}
                      </button>
                    )}
                  </div>
                  {selectedTeam?.id === t.id && (
                    <div className="mt-4 pt-4 border-t border-border text-center">
                      <p className="text-xs text-muted-foreground mb-3">Share this QR so members can join</p>
                      <div className="bg-white p-3 rounded-2xl inline-block mb-3">
                        <QRCode value={getTeamQRValue(t)} size={150} level="M" />
                      </div>
                      <p className="text-xs text-muted-foreground mb-1">Or share this code:</p>
                      <p className="text-sm font-mono font-bold text-foreground bg-secondary/50 px-4 py-2 rounded-lg inline-block tracking-widest">{t.invite_code}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}