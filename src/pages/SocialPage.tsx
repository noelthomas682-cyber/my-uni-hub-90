import { useState, useEffect, useRef } from 'react';
import { UserPlus, Trophy, QrCode, RefreshCw, Plus, X, Camera, MessageCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import QRCode from 'react-qr-code';
import { toast } from 'sonner';
import { BrowserQRCodeReader } from '@zxing/browser';

type SubTab = 'contacts' | 'sports' | 'qr';

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
          <button
            onClick={() => { BrowserQRCodeReader.releaseAllStreams(); onClose(); }}
            className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center"
          >
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
    supabase
      .from('profiles')
      .select('qr_token, full_name, university')
      .eq('id', user.id)
      .single()
      .then(({ data }) => { if (data) setProfile(data); });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);

    if (activeTab === 'contacts') {
      supabase
        .from('contacts')
        .select('contact_id, profiles!contacts_contact_id_fkey(id, full_name, email, university, course)')
        .eq('user_id', user.id)
        .then(({ data, error }) => {
          if (error) console.error('contacts fetch error:', error);
          setContacts(data?.map((d: any) => d.profiles).filter(Boolean) || []);
          setLoading(false);
        });

    } else if (activeTab === 'sports') {
      supabase
        .from('team_members')
        .select('team_id, role')
        .eq('user_id', user.id)
        .then(async ({ data: memberships, error: memError }) => {
          if (memError) {
            console.error('team_members fetch error:', memError);
            setTeams([]);
            setLoading(false);
            return;
          }
          if (!memberships || memberships.length === 0) {
            setTeams([]);
            setLoading(false);
            return;
          }

          const teamIds = memberships.map((m: any) => m.team_id);
          const { data: teamsData, error: teamsError } = await supabase
            .from('teams')
            .select('*')
            .in('id', teamIds);

          if (teamsError) {
            console.error('teams fetch error:', teamsError);
            setTeams([]);
            setLoading(false);
            return;
          }

          const merged = (teamsData || []).map((t: any) => {
            const membership = memberships.find((m: any) => m.team_id === t.id);
            return { ...t, myRole: membership?.role || 'member' };
          });

          setTeams(merged);
          setLoading(false);
        });

    } else {
      setLoading(false);
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

    const { data: found } = await supabase
      .from('profiles').select('id, full_name, email')
      .eq('qr_token', token).single();

    if (!found) { toast.error('Invalid QR code'); setScanning(false); return; }
    if (found.id === user.id) { toast.error("That's your own QR code"); setScanning(false); return; }

    const { data: existing } = await supabase.from('contacts').select('id')
      .eq('user_id', user.id).eq('contact_id', found.id).maybeSingle();

    if (existing) { toast.error('Already in your contacts'); setScanning(false); return; }

    await supabase.from('contacts').insert([
      { user_id: user.id, contact_id: found.id },
      { user_id: found.id, contact_id: user.id },
    ]);

    toast.success(`Added ${found.full_name || found.email} as a contact`);
    setScanInput('');
    setScanning(false);
    setActiveTab('contacts');
  };

  const joinTeamByCode = async (raw: string) => {
    if (!raw.trim() || !user) return;
    setJoining(true);
    const code = raw.includes('rute://team/') ? raw.split('rute://team/')[1] : raw.trim();

    const { data: team, error: teamError } = await supabase
      .from('teams').select('*').eq('invite_code', code).single();

    if (!team || teamError) {
      console.error('join team error:', teamError);
      toast.error('Invalid team code');
      setJoining(false);
      return;
    }

    const { data: existing } = await supabase.from('team_members').select('team_id')
      .eq('team_id', team.id).eq('user_id', user.id).maybeSingle();

    if (existing) { toast.error('Already in this team'); setJoining(false); return; }

    const { error: insertError } = await supabase.from('team_members').insert({
      team_id: team.id, user_id: user.id, role: 'member',
    });

    if (insertError) {
      console.error('team_members insert error:', insertError);
      toast.error('Could not join team');
      setJoining(false);
      return;
    }

    const { data: conv } = await supabase.from('conversations')
      .select('id').eq('team_id', team.id).maybeSingle();

    if (conv) {
      await supabase.from('conversation_members').insert({ conversation_id: conv.id, user_id: user.id });
      toast.success(`Joined ${team.name}! You've been added to the group chat.`);
    } else {
      toast.success(`Joined ${team.name}!`);
    }

    setTeams(prev => [...prev, { ...team, myRole: 'member' }]);
    setJoinInput('');
    setJoining(false);
    setActiveTab('sports');
  };

  const createTeam = async () => {
    if (!teamName.trim() || !user) return;
    setCreatingTeam(true);

    const inviteCode = Math.random().toString(36).substring(2, 10).toUpperCase();

    const { data: team, error } = await supabase
      .from('teams')
      .insert({
        name: teamName.trim(),
        sport: teamSport || null,
        emoji: teamEmoji,
        captain_id: user.id,
        university: profile?.university || null,
        invite_code: inviteCode,
        invite_token: crypto.randomUUID(),
      })
      .select()
      .single();

    if (error) {
      console.error('create team error:', error);
      toast.error('Could not create team: ' + error.message);
      setCreatingTeam(false);
      return;
    }

    const { error: memberError } = await supabase.from('team_members').insert({
      team_id: team.id, user_id: user.id, role: 'captain',
    });

    if (memberError) {
      console.error('captain insert error:', memberError);
    }

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
    const { data: conv, error } = await supabase
      .from('conversations')
      .insert({ type: 'group', name: team.name, team_id: team.id })
      .select().single();

    if (conv && !error) {
      await supabase.from('conversation_members').insert({ conversation_id: conv.id, user_id: user.id });
      toast.success(`Group chat created for ${team.name}!`);
    } else {
      toast.error('Could not create group chat');
    }
    setPendingGroupChatTeam(null);
  };

  const skipGroupChat = (team: any) => {
    setPendingGroupChatTeam(null);
    toast.success(`${team.name} created! Share the QR code to add members.`);
  };

  const getTeamQRValue = (team: any) =>
    `rute://team/${team.invite_token || team.invite_code}`;

  const qrValue = profile?.qr_token ? `rute://add/${profile.qr_token}` : '';

  const tabs: { key: SubTab; label: string; icon: typeof UserPlus }[] = [
    { key: 'contacts', label: 'Contacts', icon: UserPlus },
    { key: 'sports', label: 'Teams', icon: Trophy },
    { key: 'qr', label: 'QR Codes', icon: QrCode },
  ];

  return (
    <div className="px-5 pt-14 animate-fade-in pb-24">
      {showJoinScanner && (
        <QRScanner
          onResult={(text) => { setShowJoinScanner(false); joinTeamByCode(text); }}
          onClose={() => setShowJoinScanner(false)}
        />
      )}
      {showContactScanner && (
        <QRScanner
          onResult={(text) => { setShowContactScanner(false); addContactByToken(text); }}
          onClose={() => setShowContactScanner(false)}
        />
      )}
      {pendingGroupChatTeam && (
        <GroupChatPrompt
          teamName={pendingGroupChatTeam.name}
          onYes={() => createGroupChat(pendingGroupChatTeam)}
          onNo={() => skipGroupChat(pendingGroupChatTeam)}
        />
      )}

      <h1 className="font-heading text-2xl font-bold mb-5">Social</h1>

      <div className="flex gap-2 mb-5">
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all',
              activeTab === tab.key ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
            )}>
            <tab.icon className="w-3.5 h-3.5" />{tab.label}
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
                  <p className="text-muted-foreground text-xs mt-1">Add classmates via QR code or join a team</p>
                </div>
              ) : contacts.map(c => (
                <div key={c.id} className="glass-card rounded-xl p-4 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                    <span className="text-primary text-sm font-bold">
                      {(c.full_name || c.email || 'U').charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{c.full_name || c.email}</p>
                    {c.university && <p className="text-xs text-muted-foreground truncate">{c.university}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'sports' && (
            <div className="space-y-3">
              {showCreateTeam ? (
                <div className="glass-card rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-sm">Create Team</p>
                    <button onClick={() => setShowCreateTeam(false)}>
                      <X className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {EMOJIS.map(e => (
                      <button key={e} onClick={() => setTeamEmoji(e)}
                        className={cn('text-xl p-2 rounded-xl transition-all',
                          teamEmoji === e ? 'bg-primary/20 ring-2 ring-primary' : 'bg-secondary')}>
                        {e}
                      </button>
                    ))}
                  </div>
                  <input type="text" placeholder="Team name" value={teamName}
                    onChange={e => setTeamName(e.target.value)}
                    className="w-full bg-secondary/60 rounded-xl px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40" />
                  <input type="text" placeholder="Sport / Activity (optional)" value={teamSport}
                    onChange={e => setTeamSport(e.target.value)}
                    className="w-full bg-secondary/60 rounded-xl px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40" />
                  <div className="flex gap-2">
                    <button onClick={createTeam} disabled={!teamName.trim() || creatingTeam}
                      className="flex-1 bg-primary text-primary-foreground rounded-xl py-2 text-sm font-semibold disabled:opacity-50">
                      {creatingTeam ? 'Creating...' : 'Create Team'}
                    </button>
                    <button onClick={() => setShowCreateTeam(false)}
                      className="px-4 bg-secondary text-muted-foreground rounded-xl py-2 text-sm">
                      Cancel
                    </button>
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
                  <input type="text" value={joinInput} onChange={e => setJoinInput(e.target.value)}
                    placeholder="Paste invite code..."
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
                        <QrCode className="w-3.5 h-3.5" />
                        {selectedTeam?.id === t.id ? 'Hide' : 'Share'}
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
                      <p className="text-sm font-mono font-bold text-foreground bg-secondary/50 px-4 py-2 rounded-lg inline-block tracking-widest">
                        {t.invite_code}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {activeTab === 'qr' && (
            <div className="space-y-4">
              <div className="glass-card rounded-2xl p-6 text-center">
                <p className="font-heading font-bold text-base mb-1">Your QR Code</p>
                <p className="text-xs text-muted-foreground mb-5">Share this so classmates can add you</p>
                {qrValue ? (
                  <div className="bg-white p-4 rounded-2xl inline-block mb-4">
                    <QRCode value={qrValue} size={180} level="M" />
                  </div>
                ) : (
                  <div className="w-[180px] h-[180px] bg-secondary rounded-2xl mx-auto mb-4 animate-pulse" />
                )}
                <p className="text-xs text-muted-foreground mb-3">
                  {profile?.full_name || 'Your name'}{profile?.university ? ` · ${profile.university}` : ''}
                </p>
                <button onClick={regenerateToken} disabled={regenerating}
                  className="flex items-center gap-2 mx-auto text-xs text-muted-foreground hover:text-foreground transition-colors">
                  <RefreshCw className={cn('w-3.5 h-3.5', regenerating && 'animate-spin')} />
                  {regenerating ? 'Refreshing...' : 'Refresh QR code'}
                </button>
              </div>

              <div className="glass-card rounded-2xl p-5">
                <p className="font-heading font-bold text-sm mb-1">Add a Contact</p>
                <p className="text-xs text-muted-foreground mb-3">Scan their QR code or paste their token</p>
                <button onClick={() => setShowContactScanner(true)}
                  className="w-full flex items-center justify-center gap-2 bg-primary/10 text-primary rounded-xl py-3 text-sm font-semibold mb-3 hover:bg-primary/20 transition-colors">
                  <Camera className="w-4 h-4" />Scan Contact QR Code
                </button>
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground">or paste token</span>
                  <div className="flex-1 h-px bg-border" />
                </div>
                <div className="flex gap-2">
                  <input type="text" value={scanInput} onChange={e => setScanInput(e.target.value)}
                    placeholder="Paste rute://add/... or token"
                    className="flex-1 bg-secondary/60 rounded-xl px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40" />
                  <button onClick={() => addContactByToken(scanInput)} disabled={!scanInput.trim() || scanning}
                    className="px-4 bg-primary text-primary-foreground rounded-xl text-sm font-semibold disabled:opacity-50">
                    {scanning ? '...' : 'Add'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}