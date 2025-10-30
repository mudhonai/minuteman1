import { useEffect, useRef } from 'react';
import { useGeolocation, isWithinGeofence } from './useGeolocation';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface GeofenceLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

interface UseGeofencingProps {
  userId: string;
  enabled: boolean;
  autoClockInEnabled: boolean;
  autoClockOutEnabled: boolean;
  locations: GeofenceLocation[];
  radiusMeters: number;
  currentStatus: 'idle' | 'working' | 'break';
}

export const useGeofencing = ({
  userId,
  enabled,
  autoClockInEnabled,
  autoClockOutEnabled,
  locations,
  radiusMeters,
  currentStatus,
}: UseGeofencingProps) => {
  const { position, error } = useGeolocation(enabled);
  const lastStatusRef = useRef<'inside' | 'outside'>('outside');
  const processingRef = useRef(false);

  useEffect(() => {
    if (!enabled || !position || !locations.length || processingRef.current) return;

    // Prüfe ob wir in einer Geofence sind
    const isInside = locations.some(loc =>
      isWithinGeofence(
        position.latitude,
        position.longitude,
        loc.latitude,
        loc.longitude,
        radiusMeters
      )
    );

    const currentGeoStatus: 'inside' | 'outside' = isInside ? 'inside' : 'outside';

    // Nur bei Statusänderung reagieren
    if (currentGeoStatus !== lastStatusRef.current) {
      lastStatusRef.current = currentGeoStatus;

      // Auto Clock-In: von outside nach inside gewechselt + idle
      if (currentGeoStatus === 'inside' && autoClockInEnabled && currentStatus === 'idle') {
        processingRef.current = true;
        handleAutoClockIn();
      }

      // Auto Clock-Out: von inside nach outside gewechselt + working/break
      if (currentGeoStatus === 'outside' && autoClockOutEnabled && currentStatus !== 'idle') {
        processingRef.current = true;
        handleAutoClockOut();
      }
    }
  }, [position, enabled, locations, radiusMeters, currentStatus, autoClockInEnabled, autoClockOutEnabled]);

  const handleAutoClockIn = async () => {
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
      toast.success('🎯 Automatisch eingecheckt (Geofencing)');
    } catch (err: any) {
      console.error('Auto clock-in error:', err);
      toast.error('Fehler beim automatischen Einchecken');
    } finally {
      processingRef.current = false;
    }
  };

  const handleAutoClockOut = async () => {
    try {
      // Hole aktuellen Eintrag
      const { data: currentEntry, error: fetchError } = await supabase
        .from('current_entry')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (fetchError || !currentEntry) {
        throw new Error('Kein aktiver Eintrag gefunden');
      }

      const endTime = new Date().toISOString();
      const breaks = Array.isArray(currentEntry.breaks) 
        ? currentEntry.breaks.map((b: any) => ({
            start: b.start,
            end: b.end || null
          }))
        : [];

      // Auto-end active break
      if (currentEntry.status === 'break') {
        const lastBreak = breaks[breaks.length - 1];
        if (lastBreak && !lastBreak.end) {
          lastBreak.end = endTime;
        }
      }

      const grossWorkMs = new Date(endTime).getTime() - new Date(currentEntry.start_time).getTime();
      const grossWorkHours = grossWorkMs / (1000 * 60 * 60);

      let actualBreakMs = 0;
      breaks.forEach(b => {
        if (b.end) {
          actualBreakMs += new Date(b.end).getTime() - new Date(b.start).getTime();
        }
      });
      const actualBreakMinutes = actualBreakMs / (1000 * 60);

      let requiredBreakMinutes = 0;
      if (grossWorkHours > 9) {
        requiredBreakMinutes = 45;
      } else if (grossWorkHours > 6) {
        requiredBreakMinutes = 30;
      }

      if (actualBreakMinutes < requiredBreakMinutes) {
        const missingBreakMinutes = requiredBreakMinutes - actualBreakMinutes;
        actualBreakMs += missingBreakMinutes * 60 * 1000;
      }

      const netMinutes = Math.max(0, Math.round((grossWorkMs - actualBreakMs) / (1000 * 60)));

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
          total_break_duration_ms: actualBreakMs,
          date: new Date(currentEntry.start_time).toISOString().split('T')[0],
          regular_minutes: netMinutes,
          surcharge_minutes: 0,
          surcharge_amount: 0,
          is_surcharge_day: false,
          surcharge_label: 'Regulär',
        });

      if (insertError) throw insertError;

      toast.success('🎯 Automatisch ausgecheckt (Geofencing)');
    } catch (err: any) {
      console.error('Auto clock-out error:', err);
      toast.error('Fehler beim automatischen Auschecken');
    } finally {
      processingRef.current = false;
    }
  };

  return { position, error };
};
