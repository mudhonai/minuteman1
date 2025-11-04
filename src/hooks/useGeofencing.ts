import { useEffect, useRef } from 'react';
import { useGeolocation } from './useGeolocation';
import { useWorkActions } from './useWorkActions';
import { WorkStatus } from '@/lib/types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface GeofencingOptions {
  userId: string;
  enabled: boolean;
  locations: Array<{
    id: string;
    name: string;
    latitude: number;
    longitude: number;
  }>;
  radiusMeters: number;
  currentStatus: WorkStatus;
  autoClockIn: boolean;
  autoClockOut: boolean;
  testMode?: boolean;
  minAccuracyMeters?: number;
}

export const useGeofencing = ({
  userId,
  enabled,
  locations,
  radiusMeters,
  currentStatus,
  autoClockIn,
  autoClockOut,
  testMode = false,
  minAccuracyMeters = 50,
}: GeofencingOptions) => {
  const { position } = useGeolocation(enabled);
  const { startWork, endWork } = useWorkActions(userId, []);
  const lastTriggerStatusRef = useRef<'in-range' | 'out-of-range'>('out-of-range');
  const lastActionTimeRef = useRef<number>(0);
  const undoTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const COOLDOWN_MS = 30000; // 30 Sekunden Cooldown
  const UNDO_TIMEOUT_MS = 10000; // 10 Sekunden Undo-Zeit

  // Cleanup Undo-Timeout bei Unmount
  useEffect(() => {
    return () => {
      if (undoTimeoutRef.current) {
        clearTimeout(undoTimeoutRef.current);
      }
    };
  }, []);

  const logGeofencingAction = async (
    action: 'clock_in' | 'clock_out',
    triggerType: 'auto' | 'manual' | 'test',
    locationName: string,
    distance: number,
    statusBefore: string,
    statusAfter: string,
    success: boolean = true,
    errorMessage?: string
  ) => {
    if (!position) return;

    try {
      await supabase.from('geofencing_logs').insert({
        user_id: userId,
        action,
        trigger_type: triggerType,
        location_name: locationName,
        latitude: position.latitude,
        longitude: position.longitude,
        gps_accuracy: position.accuracy,
        distance_to_trigger: distance,
        status_before: statusBefore,
        status_after: statusAfter,
        success,
        error_message: errorMessage,
      });
    } catch (error) {
      console.error('Fehler beim Loggen der Geofencing-Aktion:', error);
    }
  };

  useEffect(() => {
    if (!enabled || !position || locations.length === 0 || !userId) return;

    // GPS-Genauigkeitsfilter
    if (position.accuracy > minAccuracyMeters) {
      console.log(`⚠️ GPS-Genauigkeit zu schlecht: ${Math.round(position.accuracy)}m (min: ${minAccuracyMeters}m)`);
      return;
    }

    const now = Date.now();
    if (now - lastActionTimeRef.current < COOLDOWN_MS) {
      return;
    }

    // Haversine-Formel für Distanzberechnung
    const haversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
      const R = 6371000; // Erdradius in Metern
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    };

    let isInRange = false;
    let closestLocation = null;
    let closestDistance = Infinity;

    for (const location of locations) {
      const distance = haversineDistance(
        position.latitude,
        position.longitude,
        location.latitude,
        location.longitude
      );

      if (distance <= radiusMeters && distance < closestDistance) {
        isInRange = true;
        closestLocation = location;
        closestDistance = distance;
      }
    }

    const currentTriggerStatus = isInRange ? 'in-range' : 'out-of-range';

    // Toggle-Logik: Statuswechsel erkennen
    if (currentTriggerStatus !== lastTriggerStatusRef.current) {
      lastTriggerStatusRef.current = currentTriggerStatus;

      if (isInRange && closestLocation) {
        const action = currentStatus === 'idle' ? 'clock_in' : 'clock_out';
        const shouldClockIn = currentStatus === 'idle' && autoClockIn;
        const shouldClockOut = (currentStatus === 'working' || currentStatus === 'break') && autoClockOut;

        if (shouldClockIn || shouldClockOut) {
          const actionText = shouldClockIn ? 'Eingestempelt' : 'Ausgestempelt';
          const triggerType = testMode ? 'test' : 'auto';

          if (!testMode) {
            // Echte Aktion durchführen
            let undoAction: (() => void) | null = null;

            if (shouldClockIn) {
              console.log(`🔔 Geofencing: Einstempeln bei ${closestLocation.name}`);
              startWork();
              undoAction = () => endWork(null); // Undo: Wieder ausstempeln
            } else {
              console.log(`🔔 Geofencing: Ausstempeln bei ${closestLocation.name}`);
              endWork(null);
              undoAction = () => startWork(); // Undo: Wieder einstempeln
            }

            // Visuelles Feedback mit Undo-Button
            const toastId = toast.success(
              `${actionText} bei "${closestLocation.name}"`,
              {
                description: `GPS-Genauigkeit: ±${Math.round(position.accuracy)}m | Distanz: ${Math.round(closestDistance)}m`,
                duration: UNDO_TIMEOUT_MS,
                action: undoAction ? {
                  label: 'Rückgängig',
                  onClick: () => {
                    undoAction?.();
                    toast.info('Aktion rückgängig gemacht');
                    if (undoTimeoutRef.current) {
                      clearTimeout(undoTimeoutRef.current);
                    }
                  },
                } : undefined,
              }
            );

            // Log in DB
            logGeofencingAction(
              action,
              'auto',
              closestLocation.name,
              closestDistance,
              currentStatus,
              shouldClockIn ? 'working' : 'idle',
              true
            );

            lastActionTimeRef.current = now;
          } else {
            // Test-Modus: Nur Benachrichtigung
            toast.info(
              `TEST: Würde ${actionText.toLowerCase()} bei "${closestLocation.name}"`,
              {
                description: `GPS-Genauigkeit: ±${Math.round(position.accuracy)}m | Distanz: ${Math.round(closestDistance)}m`,
                duration: 5000,
              }
            );

            // Log auch im Test-Modus
            logGeofencingAction(
              action,
              'test',
              closestLocation.name,
              closestDistance,
              currentStatus,
              shouldClockIn ? 'working' : 'idle',
              true
            );
          }
        }
      }
    }
  }, [enabled, position, locations, radiusMeters, currentStatus, autoClockIn, autoClockOut, userId, startWork, endWork, testMode, minAccuracyMeters]);
};
