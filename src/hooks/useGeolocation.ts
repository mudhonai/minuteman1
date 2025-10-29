import { useState, useEffect } from 'react';

export interface GeolocationPosition {
  latitude: number;
  longitude: number;
  accuracy: number;
}

export const useGeolocation = (enabled: boolean = false) => {
  const [position, setPosition] = useState<GeolocationPosition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [permission, setPermission] = useState<'granted' | 'denied' | 'prompt'>('prompt');

  useEffect(() => {
    if (!enabled || !('geolocation' in navigator)) {
      setError('Geolocation wird nicht unterstützt');
      return;
    }

    // Check permission status
    if ('permissions' in navigator) {
      navigator.permissions.query({ name: 'geolocation' }).then((result) => {
        setPermission(result.state as 'granted' | 'denied' | 'prompt');
      });
    }

    setLoading(true);

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setPosition({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
        setError(null);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [enabled]);

  const requestPermission = async () => {
    if (!('geolocation' in navigator)) {
      setError('Geolocation wird nicht unterstützt');
      return false;
    }

    try {
      const result = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            resolve({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
            });
          },
          (err) => reject(err),
          { enableHighAccuracy: true }
        );
      });

      setPosition(result);
      setPermission('granted');
      return true;
    } catch (err: any) {
      setError(err.message);
      setPermission('denied');
      return false;
    }
  };

  return { position, error, loading, permission, requestPermission };
};

// Berechne Distanz zwischen zwei Koordinaten (Haversine-Formel)
export const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371e3; // Erdradius in Metern
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distanz in Metern
};

export const isWithinGeofence = (
  currentLat: number,
  currentLon: number,
  targetLat: number,
  targetLon: number,
  radius: number
): boolean => {
  const distance = calculateDistance(currentLat, currentLon, targetLat, targetLon);
  return distance <= radius;
};