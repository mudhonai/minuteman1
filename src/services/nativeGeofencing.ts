import { BackgroundGeolocationPlugin } from '@capacitor-community/background-geolocation';
import { registerPlugin } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { supabase } from '@/integrations/supabase/client';

const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>('BackgroundGeolocation');

interface GeofenceLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

let lastTriggerStatus: 'in-range' | 'out-of-range' = 'out-of-range';
let lastActionTime = 0;
const COOLDOWN_MS = 30000; // 30 Sekunden

// Haversine-Formel für Distanzberechnung
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371000; // Erdradius in Metern
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export const startNativeGeofencing = async (
  userId: string,
  locations: GeofenceLocation[],
  radiusMeters: number,
  autoClockIn: boolean,
  autoClockOut: boolean
) => {
  try {
    // Berechtigung anfordern
    await LocalNotifications.requestPermissions();
    
    // Starte Background-Tracking
    await BackgroundGeolocation.addWatcher(
      {
        backgroundMessage: "Minuteman erfasst deinen Standort für automatisches Stempeln",
        backgroundTitle: "Standortverfolgung aktiv",
        requestPermissions: true,
        stale: false,
        distanceFilter: 10 // Update alle 10 Meter
      },
      async (location, error) => {
        if (error) {
          console.error('❌ Background Geolocation Error:', error);
          return;
        }

        if (!location) return;

        const now = Date.now();
        if (now - lastActionTime < COOLDOWN_MS) return;

        console.log('📍 Background Position Update:', location.latitude, location.longitude);

        // Prüfe alle Trigger-Punkte
        let isInRange = false;
        let closestLocation: GeofenceLocation | null = null;
        let closestDistance = Infinity;

        for (const triggerLocation of locations) {
          const distance = calculateDistance(
            location.latitude,
            location.longitude,
            triggerLocation.latitude,
            triggerLocation.longitude
          );

          if (distance <= radiusMeters && distance < closestDistance) {
            isInRange = true;
            closestLocation = triggerLocation;
            closestDistance = distance;
          }
        }

        const currentTriggerStatus = isInRange ? 'in-range' : 'out-of-range';

        // Toggle-Logik: Statuswechsel erkennen
        if (currentTriggerStatus !== lastTriggerStatus) {
          lastTriggerStatus = currentTriggerStatus;

          if (isInRange && closestLocation) {
            // Hole aktuellen Status
            const { data: currentEntry } = await supabase
              .from('current_entry')
              .select('status')
              .eq('user_id', userId)
              .maybeSingle();

            const currentStatus = currentEntry?.status || 'idle';

            // Entscheide: Ein- oder Ausstempeln
            const shouldClockIn = currentStatus === 'idle' && autoClockIn;
            const shouldClockOut = (currentStatus === 'working' || currentStatus === 'break') && autoClockOut;

            if (shouldClockIn) {
              await handleBackgroundClockIn(userId, closestLocation.name);
            } else if (shouldClockOut) {
              await handleBackgroundClockOut(userId, closestLocation.name);
            }

            lastActionTime = now;
          }
        }
      }
    );

    console.log('✅ Native Background Geofencing gestartet');
  } catch (error) {
    console.error('❌ Fehler beim Starten des Background Geofencing:', error);
    throw error;
  }
};

export const stopNativeGeofencing = async () => {
  try {
    await BackgroundGeolocation.removeWatcher({
      id: 'default'
    });
    console.log('🛑 Native Background Geofencing gestoppt');
  } catch (error) {
    console.error('❌ Fehler beim Stoppen des Background Geofencing:', error);
  }
};

const handleBackgroundClockIn = async (userId: string, locationName: string) => {
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

    // Zeige Benachrichtigung
    await LocalNotifications.schedule({
      notifications: [{
        title: '✅ Eingestempelt',
        body: `Automatisch bei "${locationName}" eingestempelt`,
        id: Date.now(),
        schedule: { at: new Date(Date.now() + 100) }
      }]
    });

    console.log('✅ Background Clock-In erfolgreich');
  } catch (error) {
    console.error('❌ Background Clock-In Fehler:', error);
  }
};

const handleBackgroundClockOut = async (userId: string, locationName: string) => {
  try {
    // Hole aktuellen Eintrag
    const { data: currentEntry } = await supabase
      .from('current_entry')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (!currentEntry) {
      console.log('⚠️ Kein aktiver Eintrag zum Ausstempeln');
      return;
    }

    const endTime = new Date().toISOString();
    const breaks = Array.isArray(currentEntry.breaks) ? currentEntry.breaks : [];

    // Auto-end active break
    if (currentEntry.status === 'break') {
      const lastBreak: any = breaks[breaks.length - 1];
      if (lastBreak && !lastBreak.end) {
        lastBreak.end = endTime;
      }
    }

    // Berechne Arbeitszeit
    const grossWorkMs = new Date(endTime).getTime() - new Date(currentEntry.start_time).getTime();
    const grossWorkHours = grossWorkMs / (1000 * 60 * 60);

    let actualBreakMs = 0;
    breaks.forEach((b: any) => {
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

    // Speichere Zeit-Eintrag
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

    // Lösche current_entry
    const { error: deleteError } = await supabase
      .from('current_entry')
      .delete()
      .eq('user_id', userId);

    if (deleteError) throw deleteError;

    // Zeige Benachrichtigung
    await LocalNotifications.schedule({
      notifications: [{
        title: '🏁 Ausgestempelt',
        body: `Automatisch bei "${locationName}" ausgestempelt. Arbeitszeit: ${Math.floor(netMinutes / 60)}h ${netMinutes % 60}min`,
        id: Date.now(),
        schedule: { at: new Date(Date.now() + 100) }
      }]
    });

    console.log('✅ Background Clock-Out erfolgreich');
  } catch (error) {
    console.error('❌ Background Clock-Out Fehler:', error);
  }
};
