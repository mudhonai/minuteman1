import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { UserSettings, NRW_HOLIDAYS_2025 } from '@/lib/types';
import { toast } from 'sonner';

interface SettingsProps {
  settings: UserSettings | null;
  userId: string;
}

export const Settings = ({ settings, userId }: SettingsProps) => {
  const [holidayInput, setHolidayInput] = useState('');

  const updateSettings = async (updates: Partial<UserSettings>) => {
    try {
      const { error } = await supabase
        .from('user_settings')
        .update(updates)
        .eq('user_id', userId);

      if (error) throw error;
      toast.success('Einstellungen gespeichert!');
    } catch (error: any) {
      toast.error(error.message || 'Fehler beim Speichern');
    }
  };

  const toggleBreakReminder = (checked: boolean) => {
    updateSettings({ break_reminder_enabled: checked });
  };

  const addCustomHoliday = (e: React.FormEvent) => {
    e.preventDefault();
    const holiday = holidayInput.trim();
    
    if (!holiday.match(/^\d{2}-\d{2}$/)) {
      toast.error('Ungültiges Format! Bitte MM-DD verwenden (z.B. 09-07)');
      return;
    }

    const customHolidays = settings?.custom_holidays || [];
    if (customHolidays.includes(holiday)) {
      toast.error('Feiertag bereits vorhanden!');
      return;
    }

    updateSettings({ custom_holidays: [...customHolidays, holiday] });
    setHolidayInput('');
  };

  const removeCustomHoliday = (holiday: string) => {
    const customHolidays = settings?.custom_holidays || [];
    updateSettings({ custom_holidays: customHolidays.filter(h => h !== holiday) });
  };

  return (
    <div className="space-y-6">
      <Card className="p-4">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-xl font-semibold">Akustische Pause-Erinnerung</h3>
            <p className="text-sm text-muted-foreground">
              Erinnert Dich täglich um 13:00 Uhr an die Mittagspause.
            </p>
          </div>
          <Checkbox
            checked={settings?.break_reminder_enabled || false}
            onCheckedChange={toggleBreakReminder}
          />
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="text-xl font-semibold mb-3">Eigene Feiertage (MM-DD)</h3>
        <p className="text-sm text-muted-foreground mb-4">
          NRW 2025 Feiertage sind automatisch enthalten ({NRW_HOLIDAYS_2025.length} Feiertage). 
          Füge hier Deine eigenen Feiertage im Format MM-DD hinzu (z.B. 09-07).
        </p>
        
        <div className="space-y-2 mb-4">
          {settings?.custom_holidays.map((holiday) => (
            <div key={holiday} className="flex justify-between items-center p-2 bg-card/50 rounded">
              <span>{holiday}</span>
              <Button
                onClick={() => removeCustomHoliday(holiday)}
                variant="destructive"
                size="sm"
              >
                Entfernen
              </Button>
            </div>
          ))}
        </div>

        <form onSubmit={addCustomHoliday} className="flex gap-2">
          <Input
            type="text"
            placeholder="MM-DD (z.B. 09-07)"
            value={holidayInput}
            onChange={(e) => setHolidayInput(e.target.value)}
            pattern="\d{2}-\d{2}"
            required
            className="flex-grow"
          />
          <Button type="submit">Hinzufügen</Button>
        </form>
      </Card>
    </div>
  );
};
