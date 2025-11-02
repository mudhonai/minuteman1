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
  locations: GeofenceLocation[];
  radiusMeters: number;
  currentStatus: 'idle' | 'working' | 'break';
  autoClockIn: boolean;
  autoClockOut: boolean;
}

export const useGeofencing = ({
  userId,
  enabled,
  locations,
  radiusMeters,
  currentStatus,
  autoClockIn,
  autoClockOut,
}: UseGeofencingProps) => {
  const { position, error } = useGeolocation(enabled);
  const lastStatusRef = useRef<'inside' | 'outside'>('outside');
  const processingRef = useRef(false);
  const lastActionTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled || !position || !locations.length) {
      console.log('[Geofencing] Disabled or no data:', { enabled, hasPosition: !!position, locationCount: locations.length });
      return;
    }

    // Verhindere zu häufige Aktionen (mindestens 30 Sekunden zwischen Aktionen)
    const now = Date.now();
    const timeSinceLastAction = now - lastActionTimeRef.current;
    if (processingRef.current && timeSinceLastAction < 30000) {
      return;
    }
    
    // Reset processing flag nach 30 Sekunden
    if (timeSinceLastAction >= 30000) {
      processingRef.current = false;
    }

    console.log('🔍 Geofencing Check:', { 
      enabled, 
      hasPosition: !!position, 
      locationCount: locations.length, 
      currentStatus,
      autoClockIn,
      autoClockOut,
      position: `${position.latitude.toFixed(6)}, ${position.longitude.toFixed(6)}`
    });

    // Prüfe ob wir in einer Geofence sind
    let closestDistance = Infinity;
    const isInside = locations.some(loc => {
      const inside = isWithinGeofence(
        position.latitude,
        position.longitude,
        loc.latitude,
        loc.longitude,
        radiusMeters
      );
      const distance = Math.round(
        Math.sqrt(
          Math.pow((position.latitude - loc.latitude) * 111320, 2) +
          Math.pow((position.longitude - loc.longitude) * 111320 * Math.cos(position.latitude * Math.PI / 180), 2)
        )
      );
      closestDistance = Math.min(closestDistance, distance);
      console.log(`📍 Location "${loc.name}": ${inside ? 'INSIDE' : 'OUTSIDE'} (distance: ${distance}m, radius: ${radiusMeters}m)`);
      return inside;
    });

    console.log(`📏 Nächster Standort ist ${closestDistance}m entfernt (Radius: ${radiusMeters}m)`);

    const currentGeoStatus: 'inside' | 'outside' = isInside ? 'inside' : 'outside';

    // BETRETEN: outside → inside
    if (currentGeoStatus === 'inside' && lastStatusRef.current === 'outside') {
      console.log('🚪 Standort BETRETEN');
      lastStatusRef.current = currentGeoStatus;
      
      // Nur einstempeln wenn idle UND autoClockIn aktiviert
      if (currentStatus === 'idle' && autoClockIn) {
        console.log('✅ Auto Clock-In aktiviert → Triggering');
        processingRef.current = true;
        lastActionTimeRef.current = now;
        handleAutoClockIn();
      } else if (currentStatus === 'idle' && !autoClockIn) {
        console.log('ℹ️ Status idle, aber Auto Clock-In ist deaktiviert');
      }
    } 
    // VERLASSEN: inside → outside
    else if (currentGeoStatus === 'outside' && lastStatusRef.current === 'inside') {
      console.log('🚶 Standort VERLASSEN');
      lastStatusRef.current = currentGeoStatus;
      
      // Nur ausstempeln wenn working/break UND autoClockOut aktiviert
      if ((currentStatus === 'working' || currentStatus === 'break') && autoClockOut) {
        console.log('✅ Auto Clock-Out aktiviert → Triggering');
        processingRef.current = true;
        lastActionTimeRef.current = now;
        handleAutoClockOut();
      } else if ((currentStatus === 'working' || currentStatus === 'break') && !autoClockOut) {
        console.log('ℹ️ Status working/break, aber Auto Clock-Out ist deaktiviert');
      }
    }
  }, [position, enabled, locations, radiusMeters, currentStatus, autoClockIn, autoClockOut]);

  const handleAutoClockIn = async () => {
    try {
      console.log('🚀 Starting auto clock-in for user:', userId);
      
      const { error } = await supabase
        .from('current_entry')
        .insert({
          user_id: userId,
          start_time: new Date().toISOString(),
          status: 'working',
          breaks: []
        });

      if (error) {
        console.error('❌ Auto clock-in DB error:', error);
        throw error;
      }
      
      console.log('✅ Auto clock-in successful');
      toast.success('🎯 Automatisch eingecheckt (Geofencing)');
    } catch (err: any) {
      console.error('❌ Auto clock-in error:', err);
      toast.error('Fehler beim automatischen Einchecken: ' + err.message);
    } finally {
      processingRef.current = false;
    }
  };

  const handleAutoClockOut = async () => {
    try {
      console.log('🚀 Starting auto clock-out for user:', userId);
      
      // Hole aktuellen Eintrag
      const { data: currentEntry, error: fetchError } = await supabase
        .from('current_entry')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (fetchError || !currentEntry) {
        console.error('❌ No active entry found:', fetchError);
        throw new Error('Kein aktiver Eintrag gefunden');
      }

      console.log('📋 Current entry found:', currentEntry);

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
          console.log('⏸️ Auto-ended active break');
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
        console.log('⏱️ Added missing break minutes:', missingBreakMinutes);
      }

      const netMinutes = Math.max(0, Math.round((grossWorkMs - actualBreakMs) / (1000 * 60)));
      console.log('📊 Calculated work time:', netMinutes, 'minutes');

      // KRITISCH: Erst speichern, dann löschen!
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

      if (insertError) {
        console.error('❌ Failed to save time entry:', insertError);
        throw insertError;
      }

      console.log('✅ Time entry saved successfully');

      // Jetzt erst löschen
      const { error: deleteError } = await supabase
        .from('current_entry')
        .delete()
        .eq('user_id', userId);

      if (deleteError) {
        console.error('❌ Failed to delete current entry:', deleteError);
        throw deleteError;
      }

      console.log('✅ Current entry deleted');
      toast.success('🎯 Automatisch ausgecheckt (Geofencing)');
    } catch (err: any) {
      console.error('❌ Auto clock-out error:', err);
      toast.error('Fehler beim automatischen Auschecken: ' + err.message);
    } finally {
      processingRef.current = false;
    }
  };

  return { position, error };
};
