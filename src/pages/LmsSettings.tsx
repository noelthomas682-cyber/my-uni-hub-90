import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import LmsConnect from '@/components/LmsConnect';
import ICSImport from '@/components/ICSImport';
import CalendarUrlImport from '@/components/CalendarUrlImport';
import { Wifi, Upload, Link2, CheckCircle2, Clock, RefreshCw, WifiOff, ExternalLink } from 'lucide-react';

interface LmsConnection {
  id: string;
  lms_type: string | null;
  lms_name: string | null;
  base_url: string | null;
  instance_url: string;
  university_name: string;
  is_connected: boolean | null;
  is_active: boolean | null;
  last_synced_at: string | null;
  sync_error: string | null;
  courses_count: number | null;
  tasks_count: number | null;
  events_count: number | null;
}

export default function LmsSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [connection, setConnection] = useState<LmsConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from('lms_connections').select('*').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => { if (data) setConnection(data as LmsConnection); setLoading(false); });

    // Realtime sync status updates
    const channel = supabase.channel('lms-status')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'lms_connections', filter: `user_id=eq.${user.id}` },
        (payload) => { setConnection(payload.new as LmsConnection); })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const handleResync = async () => {
    if (!connection?.lms_type) return;
    setSyncing(true);
    try {
      const fnName = `${connection.lms_type}-import`;
      const { data, error } = await supabase.functions.invoke(fnName);
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      toast({ title: 'Sync complete!', description: `Updated ${data.tasks || 0} assignments and ${data.events || 0} events.` });
    } catch (err: any) {
      toast({ title: 'Sync failed', description: err.message, variant: 'destructive' });
    }
    setSyncing(false);
  };

  const handleDisconnect = async () => {
    if (!connection) return;
    await supabase.from('lms_connections').delete().eq('id', connection.id);
    setConnection(null);
    toast({ title: 'Disconnected', description: 'LMS connection removed.' });
  };

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Import Your Schedule</h1>
        <p className="text-muted-foreground text-sm">
          Get your classes, assignments, quizzes and exam dates into Rute
        </p>
      </div>

      {/* Active connection status */}
      {!loading && connection && (connection.is_connected || connection.is_active) && (
        <Card className="border-success/30">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-success" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground">{connection.lms_name || connection.university_name}</p>
                    <Badge className="bg-success/10 text-success text-xs">Connected</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <ExternalLink className="w-3 h-3" /> {connection.base_url || connection.instance_url}
                  </p>
                  {connection.last_synced_at && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                      <Clock className="w-3 h-3" /> Last synced: {new Date(connection.last_synced_at).toLocaleString()}
                    </p>
                  )}
                  <div className="flex gap-2 mt-1">
                    {connection.courses_count ? <Badge variant="secondary" className="text-xs">{connection.courses_count} courses</Badge> : null}
                    {connection.events_count ? <Badge variant="secondary" className="text-xs">{connection.events_count} events</Badge> : null}
                    {connection.tasks_count ? <Badge variant="secondary" className="text-xs">{connection.tasks_count} assignments</Badge> : null}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleResync} disabled={syncing}>
                  <RefreshCw className={`w-4 h-4 mr-1 ${syncing ? 'animate-spin' : ''}`} />
                  Sync
                </Button>
                <Button variant="ghost" size="sm" onClick={handleDisconnect}>
                  <WifiOff className="w-4 h-4" />
                </Button>
              </div>
            </div>
            {connection.sync_error && (
              <p className="text-xs text-destructive mt-2">⚠️ {connection.sync_error}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Import methods */}
      <Tabs defaultValue="lms">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="lms" className="flex items-center gap-2">
            <Wifi className="w-4 h-4" /> LMS Connect
          </TabsTrigger>
          <TabsTrigger value="ics" className="flex items-center gap-2">
            <Upload className="w-4 h-4" /> ICS File Import
          </TabsTrigger>
        </TabsList>

        <TabsContent value="lms" className="mt-4">
          <LmsConnect />
        </TabsContent>

        <TabsContent value="ics" className="mt-4">
          <ICSImport />
        </TabsContent>
      </Tabs>

      {/* Supported platforms info */}
      <Card className="glass-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Supported Platforms</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { icon: '🟠', name: 'Canvas', desc: 'OAuth / ICS' },
              { icon: '🟡', name: 'Moodle', desc: 'Direct login / ICS' },
              { icon: '⬛', name: 'Blackboard', desc: 'OAuth / ICS' },
              { icon: '🔴', name: 'D2L Brightspace', desc: 'OAuth / ICS' },
            ].map((p) => (
              <div key={p.name} className="text-center p-3 rounded-lg bg-muted/50">
                <span className="text-2xl">{p.icon}</span>
                <p className="text-xs font-medium text-foreground mt-1">{p.name}</p>
                <p className="text-xs text-muted-foreground">{p.desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
