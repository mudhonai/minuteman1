import { supabase } from '@/integrations/supabase/client';
import { CurrentEntry, Break } from '@/lib/types';
import { calculateNetWorkDuration, calculateSurcharge } from '@/lib/timeUtils';
import { toast } from 'sonner';

export const useWorkActions = (
  userId: string | undefined, 
  customHolidays: string[],
  onStateChange?: () => void
) => {
  const startWork = async () => {
    if (!userId) return;

    try {
      const { error } = await supabase
        .from('current_entry')
        .insert({
          user_id: userId,
          start_time: new Date().toISOString(),
          status: 'working',
          breaks: []
        });

      if (error) throw error;
      toast.success('Arbeit gestartet!');
      
      // Sofortige Aktualisierung erzwingen
      if (onStateChange) {
        setTimeout(() => onStateChange(), 100);
      }
    } catch (error: any) {
      toast.error(error.message || 'Fehler beim Starten der Arbeit');
    }
  };

  const startBreak = async (currentEntry: CurrentEntry | null) => {
    if (!userId || !currentEntry) return;

    try {
      const newBreak: Break = {
        start: new Date().toISOString(),
        end: null
      };

      const { error } = await supabase
        .from('current_entry')
        .update({
          status: 'break',
          breaks: [...currentEntry.breaks, newBreak] as any
        })
        .eq('user_id', userId);

      if (error) throw error;
      toast.success('Pause gestartet!');
      
      // Sofortige Aktualisierung erzwingen
      if (onStateChange) {
        setTimeout(() => onStateChange(), 100);
      }
    } catch (error: any) {
      toast.error(error.message || 'Fehler beim Starten der Pause');
    }
  };

  const endBreak = async (currentEntry: CurrentEntry | null) => {
    if (!userId || !currentEntry) return;

    try {
      const breaks = [...currentEntry.breaks];
      const lastBreak = breaks[breaks.length - 1];
      
      if (lastBreak && !lastBreak.end) {
        lastBreak.end = new Date().toISOString();
        
        // Check break duration
        const breakDurationMs = new Date(lastBreak.end).getTime() - new Date(lastBreak.start).getTime();
        if (breakDurationMs > 35 * 60 * 1000) {
          toast.warning('Pause länger als 35 Minuten! Bitte prüfe Deine Arbeitszeitgesetze.');
        }
      }

      const { error } = await supabase
        .from('current_entry')
        .update({
          status: 'working',
          breaks: breaks as any
        })
        .eq('user_id', userId);

      if (error) throw error;
      toast.success('Pause beendet!');
      
      // Sofortige Aktualisierung erzwingen
      if (onStateChange) {
        setTimeout(() => onStateChange(), 100);
      }
    } catch (error: any) {
      toast.error(error.message || 'Fehler beim Beenden der Pause');
    }
  };

  const endWork = async (currentEntry: CurrentEntry | null) => {
    if (!userId || !currentEntry) return;

    try {
      const endTime = new Date().toISOString();
      let breaks = [...currentEntry.breaks];

      // Auto-end active break
      if (currentEntry.status === 'break') {
        const lastBreak = breaks[breaks.length - 1];
        if (lastBreak && !lastBreak.end) {
          lastBreak.end = endTime;
        }
      }

      // Calculate gross work time (without breaks)
      const grossWorkMs = new Date(endTime).getTime() - new Date(currentEntry.start_time).getTime();
      const grossWorkHours = grossWorkMs / (1000 * 60 * 60);

      // Calculate actual break time taken
      let actualBreakMs = 0;
      breaks.forEach(b => {
        if (b.end) {
          actualBreakMs += new Date(b.end).getTime() - new Date(b.start).getTime();
        }
      });
      const actualBreakMinutes = actualBreakMs / (1000 * 60);

      // Determine required break time based on work hours
      let requiredBreakMinutes = 0;
      if (grossWorkHours > 9) {
        requiredBreakMinutes = 45;
      } else if (grossWorkHours > 6) {
        requiredBreakMinutes = 30;
      }

      // If actual break is less than required, add the difference automatically
      if (actualBreakMinutes < requiredBreakMinutes) {
        const missingBreakMinutes = requiredBreakMinutes - actualBreakMinutes;
        actualBreakMs += missingBreakMinutes * 60 * 1000;
        
        toast.info(
          `Gesetzliche Mindestpause von ${requiredBreakMinutes} Minuten wurde automatisch verrechnet (${missingBreakMinutes.toFixed(0)} Min. ergänzt).`,
          { duration: 6000 }
        );
      }

      // Calculate final metrics with enforced break time
      const netMinutes = Math.max(0, Math.round((grossWorkMs - actualBreakMs) / (1000 * 60)));
      const totalBreakMs = actualBreakMs;

      const surchargeData = calculateSurcharge(
        currentEntry.start_time,
        netMinutes,
        customHolidays
      );

      // WICHTIG: Erst neuen Eintrag speichern, DANN current_entry löschen
      // So geht keine Daten verloren wenn Insert fehlschlägt
      const { error: insertError } = await supabase
        .from('time_entries')
        .insert({
          user_id: userId,
          start_time: currentEntry.start_time,
          end_time: endTime,
          breaks: breaks as any,
          net_work_duration_minutes: netMinutes,
          total_break_duration_ms: totalBreakMs,
          date: new Date(currentEntry.start_time).toISOString().split('T')[0],
          regular_minutes: surchargeData.regularMinutes,
          surcharge_minutes: surchargeData.surchargeMinutes,
          surcharge_amount: surchargeData.surchargeAmount,
          is_surcharge_day: surchargeData.isSurchargeDay,
          surcharge_label: surchargeData.surchargeLabel,
        });

      if (insertError) throw insertError;

      // Nur wenn Insert erfolgreich war, current_entry löschen
      const { error: deleteError } = await supabase
        .from('current_entry')
        .delete()
        .eq('user_id', userId);

      if (deleteError) throw deleteError;

      toast.success('Arbeitstag erfolgreich abgeschlossen!');
      
      // Sofortige und verzögerte Aktualisierung für bessere Zuverlässigkeit
      if (onStateChange) {
        onStateChange(); // Sofort
        setTimeout(() => onStateChange(), 100); // Nochmal nach 100ms
        setTimeout(() => onStateChange(), 500); // Und nach 500ms zur Sicherheit
      }
    } catch (error: any) {
      console.error('Error ending work:', error);
      toast.error(error.message || 'Fehler beim Beenden der Arbeit');
    }
  };

  return {
    startWork,
    startBreak,
    endBreak,
    endWork
  };
};
