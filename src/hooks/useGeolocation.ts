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
    if (!enabled) return;
    
    if (!('geolocation' in navigator)) {
      setError('Dein Gerät unterstützt keine Standortbestimmung');
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
        let errorMessage = 'Standort konnte nicht ermittelt werden';
        
        switch(err.code) {
          case err.PERMISSION_DENIED:
            errorMessage = 'Standortberechtigung wurde verweigert. Bitte in den Browser-Einstellungen erlauben.';
            setPermission('denied');
            break;
          case err.POSITION_UNAVAILABLE:
            errorMessage = 'Standort nicht verfügbar. GPS-Signal prüfen.';
            break;
          case err.TIMEOUT:
            errorMessage = 'Zeitüberschreitung beim Ermitteln des Standorts. Bitte erneut versuchen.';
            break;
        }
        
        setError(errorMessage);
        setLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 30000, // 30 Sekunden statt 10
        maximumAge: 5000, // 5 Sekunden Cache
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [enabled]);

  const requestPermission = async () => {
    if (!('geolocation' in navigator)) {
      setError('Dein Gerät unterstützt keine Standortbestimmung');
      return false;
    }

    try {
      setLoading(true);
      const result = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            resolve({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
            });
          },
          (err) => {
            let errorMessage = 'Standort konnte nicht ermittelt werden';
            
            switch(err.code) {
              case err.PERMISSION_DENIED:
                errorMessage = 'Standortberechtigung wurde verweigert';
                break;
              case err.POSITION_UNAVAILABLE:
                errorMessage = 'Standort nicht verfügbar';
                break;
              case err.TIMEOUT:
                errorMessage = 'Zeitüberschreitung beim Ermitteln des Standorts';
                break;
            }
            
            reject(new Error(errorMessage));
          },
          { enableHighAccuracy: true, timeout: 30000, maximumAge: 5000 }
        );
      });

      setPosition(result);
      setPermission('granted');
      setError(null);
      setLoading(false);
      return true;
    } catch (err: any) {
      setError(err.message);
      setPermission('denied');
      setLoading(false);
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