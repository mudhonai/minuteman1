import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Bell, BellOff, Clock } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface NotificationSettingsProps {
  userId: string;
}

interface NotificationPreferences {
  break_reminders: boolean;
  break_reminder_hours: number;
  clock_out_reminders: boolean;
  clock_out_reminder_hour: number;
}

export const NotificationSettings = ({ userId }: NotificationSettingsProps) => {
  const { isSupported, permission, requestPermission } = useNotifications();
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    break_reminders: true,
    break_reminder_hours: 6,
    clock_out_reminders: true,
    clock_out_reminder_hour: 18,
  });

  useEffect(() => {
    loadPreferences();
  }, [userId]);

  const loadPreferences = async () => {
    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('notification_preferences')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;
      
      if (data?.notification_preferences) {
        const prefs = data.notification_preferences as any;
        setPreferences({
          break_reminders: prefs.break_reminders ?? true,
          break_reminder_hours: prefs.break_reminder_hours ?? 6,
          clock_out_reminders: prefs.clock_out_reminders ?? true,
          clock_out_reminder_hour: prefs.clock_out_reminder_hour ?? 18,
        });
      }
    } catch (error) {
      console.error('Error loading notification preferences:', error);
    }
  };

  const savePreferences = async (newPreferences: NotificationPreferences) => {
    try {
      const { error } = await supabase
        .from('user_settings')
        .update({ notification_preferences: newPreferences as any })
        .eq('user_id', userId);

      if (error) throw error;
      
      setPreferences(newPreferences);
      toast.success('Einstellungen gespeichert!');
    } catch (error: any) {
      console.error('Error saving preferences:', error);
      toast.error('Fehler beim Speichern');
    }
  };

  const handleEnableNotifications = async () => {
    const granted = await requestPermission();
    if (!granted) return;

    // Save initial preferences
    await savePreferences(preferences);
  };

  if (!isSupported) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3 text-muted-foreground">
          <BellOff className="h-5 w-5" />
          <p>Benachrichtigungen werden von diesem Browser nicht unterstützt.</p>
        </div>
      </Card>
    );
  }

  if (permission !== 'granted') {
    return (
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Bell className="h-5 w-5 text-primary" />
            <div className="flex-1">
              <h3 className="font-bold">Push-Benachrichtigungen</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Erhalte Erinnerungen für Pausen und zum Ausstempeln
              </p>
            </div>
          </div>

          {permission === 'denied' ? (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 space-y-3">
              <p className="text-sm font-medium text-destructive">
                Benachrichtigungen wurden blockiert
              </p>
              <p className="text-xs text-muted-foreground">
                Um Benachrichtigungen zu aktivieren, musst du die Berechtigung in deinen Browser-Einstellungen zurücksetzen:
              </p>
              <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside ml-2">
                <li><strong>Chrome/Edge:</strong> Klicke auf das Schloss-Symbol in der Adressleiste → Berechtigungen → Benachrichtigungen → "Erlauben"</li>
                <li><strong>Firefox:</strong> Klicke auf das Schloss-Symbol → Berechtigungen → Benachrichtigungen → Blockierung aufheben</li>
                <li><strong>Safari:</strong> Safari → Einstellungen → Websites → Benachrichtigungen</li>
              </ul>
              <p className="text-xs text-muted-foreground">
                Nach dem Zurücksetzen lade die Seite neu und klicke erneut auf "Aktivieren".
              </p>
            </div>
          ) : (
            <Button onClick={handleEnableNotifications} className="w-full">
              Benachrichtigungen aktivieren
            </Button>
          )}
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Bell className="h-5 w-5 text-green-500" />
          <div>
            <h3 className="font-bold">Benachrichtigungen aktiviert</h3>
            <p className="text-sm text-muted-foreground">
              Verwalte deine Benachrichtigungseinstellungen
            </p>
          </div>
        </div>

        {/* Break Reminders */}
        <div className="space-y-4 pt-4 border-t">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div>
                <Label>Pausenerinnerung</Label>
                <p className="text-xs text-muted-foreground">
                  Erinnerung nach X Stunden Arbeit
                </p>
              </div>
            </div>
            <Switch
              checked={preferences.break_reminders}
              onCheckedChange={(checked) => 
                savePreferences({ ...preferences, break_reminders: checked })
              }
            />
          </div>
          
          {preferences.break_reminders && (
            <div className="ml-7">
              <Label className="text-xs">Erinnerung nach (Stunden)</Label>
              <Input
                type="number"
                min="1"
                max="12"
                step="0.5"
                value={preferences.break_reminder_hours}
                onChange={(e) => {
                  const value = parseFloat(e.target.value);
                  if (value >= 1 && value <= 12) {
                    savePreferences({ ...preferences, break_reminder_hours: value });
                  }
                }}
                className="w-32 mt-1"
              />
            </div>
          )}
        </div>

        {/* Clock Out Reminders */}
        <div className="space-y-4 pt-4 border-t">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div>
                <Label>Ausstempel-Erinnerung</Label>
                <p className="text-xs text-muted-foreground">
                  Tägliche Erinnerung zum Ausstempeln
                </p>
              </div>
            </div>
            <Switch
              checked={preferences.clock_out_reminders}
              onCheckedChange={(checked) => 
                savePreferences({ ...preferences, clock_out_reminders: checked })
              }
            />
          </div>

          {preferences.clock_out_reminders && (
            <div className="ml-7">
              <Label className="text-xs">Uhrzeit (24h Format)</Label>
              <Input
                type="number"
                min="0"
                max="23"
                value={preferences.clock_out_reminder_hour}
                onChange={(e) => {
                  const value = parseInt(e.target.value);
                  if (value >= 0 && value <= 23) {
                    savePreferences({ ...preferences, clock_out_reminder_hour: value });
                  }
                }}
                className="w-32 mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Standard: 18:00 Uhr
              </p>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};
