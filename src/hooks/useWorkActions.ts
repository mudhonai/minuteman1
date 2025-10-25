import { supabase } from '@/integrations/supabase/client';
import { CurrentEntry, Break } from '@/lib/types';
import { calculateNetWorkDuration, calculateSurcharge } from '@/lib/timeUtils';
import { toast } from 'sonner';

export const useWorkActions = (userId: string | undefined, customHolidays: string[]) => {
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

      // Calculate metrics
      const { netMinutes, totalBreakMs } = calculateNetWorkDuration(
        currentEntry.start_time,
        endTime,
        breaks
      );

      const surchargeData = calculateSurcharge(
        currentEntry.start_time,
        netMinutes,
        customHolidays
      );

      // Delete current entry first
      const { error: deleteError } = await supabase
        .from('current_entry')
        .delete()
        .eq('user_id', userId);

      if (deleteError) throw deleteError;

      // Save finished entry
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

      toast.success('Arbeitstag erfolgreich abgeschlossen!');
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
