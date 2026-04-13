import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { LMS_CONFIG, type LMSProvider } from '@/lib/types';
import { Link2, Unlink, RefreshCw, Plus, ExternalLink, CheckCircle2, Clock } from 'lucide-react';

interface Connection {
  id: string;
  provider: LMSProvider;
  instance_url: string;
  university_name: string;
  is_active: boolean;
  last_synced_at: string | null;
  created_at: string;
}

export default function LmsSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // New connection form
  const [newProvider, setNewProvider] = useState<LMSProvider>('canvas');
  const [newUrl, setNewUrl] = useState('');
  const [newUni, setNewUni] = useState('');
  const [newClientId, setNewClientId] = useState('');
  const [newClientSecret, setNewClientSecret] = useState('');
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('lms_connections')
      .select('id, provider, instance_url, university_name, is_active, last_synced_at, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) setConnections(data as Connection[]);
        setLoading(false);
      });
  }, [user]);

  const handleConnect = async () => {
    if (!user || !newUrl || !newUni) return;
    setConnecting(true);

    // Store the connection — the OAuth flow will be handled by edge functions
    const { data, error } = await supabase
      .from('lms_connections')
      .insert({
        user_id: user.id,
        provider: newProvider,
        instance_url: newUrl.replace(/\/$/, ''),
        university_name: newUni,
        client_id: newClientId,
        client_secret: newClientSecret,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Connected!', description: `${LMS_CONFIG[newProvider].name} connection added.` });
      setConnections((prev) => [data as Connection, ...prev]);
      setDialogOpen(false);
      setNewUrl('');
      setNewUni('');
      setNewClientId('');
      setNewClientSecret('');
      // Trigger initial sync
      handleSync(data.id, newProvider);
    }
    setConnecting(false);
  };

  const handleSync = async (connectionId: string, provider: LMSProvider) => {
    setSyncing(connectionId);
    try {
      const { error } = await supabase.functions.invoke('sync-lms', {
        body: { connectionId, provider },
      });
      if (error) throw error;
      toast({ title: 'Sync complete', description: 'Your schedule and assignments have been updated.' });
      // Refresh last_synced_at
      const { data } = await supabase
        .from('lms_connections')
        .select('last_synced_at')
        .eq('id', connectionId)
        .single();
      if (data) {
        setConnections((prev) =>
          prev.map((c) => (c.id === connectionId ? { ...c, last_synced_at: data.last_synced_at } : c))
        );
      }
    } catch (err: any) {
      toast({ title: 'Sync failed', description: err.message || 'Please try again.', variant: 'destructive' });
    }
    setSyncing(null);
  };

  const handleDisconnect = async (id: string) => {
    await supabase.from('lms_connections').update({ is_active: false }).eq('id', id);
    setConnections((prev) => prev.map((c) => (c.id === id ? { ...c, is_active: false } : c)));
    toast({ title: 'Disconnected', description: 'LMS connection deactivated.' });
  };

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">LMS Connections</h1>
          <p className="text-muted-foreground text-sm">
            Connect your university's LMS to automatically import your schedule, assignments, and exams.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" /> Connect LMS
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Connect Your LMS</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label>LMS Platform</Label>
                <Select value={newProvider} onValueChange={(v) => setNewProvider(v as LMSProvider)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(LMS_CONFIG).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        {config.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{LMS_CONFIG[newProvider].description}</p>
              </div>

              <div className="space-y-2">
                <Label>University Name</Label>
                <Input
                  placeholder="e.g. University of Toronto"
                  value={newUni}
                  onChange={(e) => setNewUni(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>LMS Instance URL</Label>
                <Input
                  placeholder={`e.g. https://youruni.instructure.com`}
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  The URL of your university's {LMS_CONFIG[newProvider].name} instance
                </p>
              </div>

              <div className="space-y-2">
                <Label>OAuth Client ID</Label>
                <Input
                  placeholder="Provided by your university IT"
                  value={newClientId}
                  onChange={(e) => setNewClientId(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>OAuth Client Secret</Label>
                <Input
                  type="password"
                  placeholder="Provided by your university IT"
                  value={newClientSecret}
                  onChange={(e) => setNewClientSecret(e.target.value)}
                />
              </div>

              <div className="rounded-lg bg-muted p-3">
                <p className="text-xs text-muted-foreground">
                  <strong>Note:</strong> Your university's IT department needs to register Rute as an OAuth application 
                  in {LMS_CONFIG[newProvider].name}. Contact them with your redirect URL: <br />
                  <code className="text-xs bg-background px-1 py-0.5 rounded mt-1 inline-block">
                    {window.location.origin}/api/lms/callback
                  </code>
                </p>
              </div>

              <Button onClick={handleConnect} disabled={connecting || !newUrl || !newUni} className="w-full">
                {connecting ? 'Connecting...' : 'Connect'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Active connections */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />)}
        </div>
      ) : connections.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <Link2 className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-lg font-medium text-foreground">No LMS connections yet</p>
            <p className="text-muted-foreground text-sm mt-1">
              Connect your university's LMS to get started
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {connections.map((conn) => {
            const config = LMS_CONFIG[conn.provider];
            return (
              <Card key={conn.id} className={!conn.is_active ? 'opacity-60' : ''}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg ${config.color} flex items-center justify-center`}>
                        <span className="text-sm font-bold text-primary-foreground">
                          {config.name[0]}
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-foreground">{config.name}</p>
                          {conn.is_active ? (
                            <Badge className="bg-success/10 text-success text-xs">
                              <CheckCircle2 className="w-3 h-3 mr-1" /> Active
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">Inactive</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{conn.university_name}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <ExternalLink className="w-3 h-3" /> {conn.instance_url}
                        </p>
                        {conn.last_synced_at && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                            <Clock className="w-3 h-3" /> Last synced: {new Date(conn.last_synced_at).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {conn.is_active && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSync(conn.id, conn.provider)}
                          disabled={syncing === conn.id}
                        >
                          <RefreshCw className={`w-4 h-4 mr-1 ${syncing === conn.id ? 'animate-spin' : ''}`} />
                          Sync
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => conn.is_active ? handleDisconnect(conn.id) : null}
                      >
                        <Unlink className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Info cards about each LMS */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-foreground mb-4">Supported Platforms</h2>
        <div className="grid md:grid-cols-2 gap-3">
          {Object.entries(LMS_CONFIG).map(([key, config]) => (
            <Card key={key} className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <div className={`w-6 h-6 rounded ${config.color} flex items-center justify-center`}>
                    <span className="text-xs font-bold text-primary-foreground">{config.name[0]}</span>
                  </div>
                  {config.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">{config.description}</p>
                <div className="mt-2 text-xs text-muted-foreground space-y-1">
                  <p>✓ Class schedule & timetable</p>
                  <p>✓ Assignment due dates</p>
                  <p>✓ Quiz & exam dates</p>
                  <p>✓ Course information</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
