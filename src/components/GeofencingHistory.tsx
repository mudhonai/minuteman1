import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { MapPin, Clock, Navigation, CheckCircle, XCircle, TestTube } from 'lucide-react';
import { formatGermanDateTime } from '@/lib/timeUtils';

interface GeofencingLog {
  id: string;
  timestamp: string;
  action: 'clock_in' | 'clock_out';
  trigger_type: 'auto' | 'manual' | 'test';
  location_name: string;
  latitude: number;
  longitude: number;
  gps_accuracy: number;
  distance_to_trigger: number | null;
  status_before: string | null;
  status_after: string | null;
  success: boolean;
  error_message: string | null;
}

interface GeofencingHistoryProps {
  userId: string;
}

export const GeofencingHistory = ({ userId }: GeofencingHistoryProps) => {
  const [logs, setLogs] = useState<GeofencingLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLogs();

    // Realtime Subscription
    const channel = supabase
      .channel('geofencing_logs_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'geofencing_logs',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          console.log('⚡ Geofencing logs changed - reloading');
          loadLogs();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('geofencing_logs')
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false })
        .limit(50);

      if (error) throw error;
      setLogs((data || []) as GeofencingLog[]);
    } catch (error: any) {
      console.error('Fehler beim Laden der Geofencing-Historie:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActionIcon = (action: string, success: boolean) => {
    if (!success) return <XCircle className="h-5 w-5 text-destructive" />;
    return action === 'clock_in' 
      ? <CheckCircle className="h-5 w-5 text-green-600" />
      : <CheckCircle className="h-5 w-5 text-orange-600" />;
  };

  const getActionText = (action: string) => {
    return action === 'clock_in' ? 'Eingestempelt' : 'Ausgestempelt';
  };

  const getTriggerBadge = (type: string) => {
    const styles = {
      auto: 'bg-primary/20 text-primary',
      manual: 'bg-secondary/20 text-secondary',
      test: 'bg-yellow-500/20 text-yellow-600',
    };
    
    const icons = {
      auto: '🤖',
      manual: '👤',
      test: <TestTube className="h-3 w-3" />,
    };

    return (
      <span className={`text-xs px-2 py-1 rounded-full ${styles[type as keyof typeof styles]}`}>
        {typeof icons[type as keyof typeof icons] === 'string' ? icons[type as keyof typeof icons] : icons[type as keyof typeof icons]} {type.toUpperCase()}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Geofencing-Historie</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Die letzten 50 Geofencing-Aktionen
        </p>
      </div>

      {logs.length === 0 ? (
        <Card className="p-8 text-center">
          <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <p className="text-muted-foreground">Noch keine Geofencing-Aktionen aufgezeichnet</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {logs.map((log) => (
            <Card key={log.id} className={`p-4 ${!log.success ? 'border-destructive/50' : ''}`}>
              <div className="flex items-start gap-3">
                {getActionIcon(log.action, log.success)}
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold">{getActionText(log.action)}</h3>
                    {getTriggerBadge(log.trigger_type)}
                  </div>
                  
                  <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3 w-3" />
                      <span className="font-medium">{log.location_name}</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Clock className="h-3 w-3" />
                      <span>{formatGermanDateTime(log.timestamp)}</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Navigation className="h-3 w-3" />
                      <span>
                        GPS: {log.latitude.toFixed(6)}, {log.longitude.toFixed(6)}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                      <div>
                        <span className="opacity-70">Genauigkeit:</span>{' '}
                        <span className={`font-medium ${log.gps_accuracy > 50 ? 'text-yellow-600' : 'text-green-600'}`}>
                          ±{Math.round(log.gps_accuracy)}m
                        </span>
                      </div>
                      {log.distance_to_trigger !== null && (
                        <div>
                          <span className="opacity-70">Distanz:</span>{' '}
                          <span className="font-medium">{Math.round(log.distance_to_trigger)}m</span>
                        </div>
                      )}
                      {log.status_before && (
                        <div>
                          <span className="opacity-70">Status vorher:</span>{' '}
                          <span className="font-medium">{log.status_before}</span>
                        </div>
                      )}
                      {log.status_after && (
                        <div>
                          <span className="opacity-70">Status nachher:</span>{' '}
                          <span className="font-medium">{log.status_after}</span>
                        </div>
                      )}
                    </div>
                    
                    {log.error_message && (
                      <div className="mt-2 bg-destructive/10 border border-destructive/20 rounded p-2 text-xs text-destructive">
                        <strong>Fehler:</strong> {log.error_message}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
