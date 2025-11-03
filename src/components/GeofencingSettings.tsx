import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useGeolocation } from '@/hooks/useGeolocation';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { MapPin, Plus, Trash2, Navigation } from 'lucide-react';

interface GeofenceLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

interface GeofencingSettingsProps {
  userId: string;
}

export const GeofencingSettings = ({ userId }: GeofencingSettingsProps) => {
  const [geofencingEnabled, setGeofencingEnabled] = useState(false);
  const [autoClockIn, setAutoClockIn] = useState(false);
  const [autoClockOut, setAutoClockOut] = useState(false);
  const [radius, setRadius] = useState('100');
  const [locations, setLocations] = useState<GeofenceLocation[]>([]);
  const [newLocationName, setNewLocationName] = useState('');
  const [isAddingLocation, setIsAddingLocation] = useState(false);

  const { position, error, permission, requestPermission } = useGeolocation(geofencingEnabled);

  useEffect(() => {
    loadSettings();
  }, [userId]);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('geofencing_enabled, geofence_locations, geofence_radius_meters, auto_clock_in_enabled, auto_clock_out_enabled')
        .eq('user_id', userId)
        .single();

      if (error) throw error;

      if (data) {
        setGeofencingEnabled(data.geofencing_enabled || false);
        setAutoClockIn(data.auto_clock_in_enabled || false);
        setAutoClockOut(data.auto_clock_out_enabled || false);
        setRadius(String(data.geofence_radius_meters || 100));
        const parsedLocations = Array.isArray(data.geofence_locations) 
          ? data.geofence_locations as unknown as GeofenceLocation[]
          : [];
        setLocations(parsedLocations);
      }
    } catch (error: any) {
      console.error('Fehler beim Laden der Geofencing-Einstellungen:', error);
    }
  };

  const saveSettings = async () => {
    try {
      const { error } = await supabase
        .from('user_settings')
        .update({
          geofencing_enabled: geofencingEnabled,
          geofence_locations: locations as any,
          geofence_radius_meters: parseInt(radius),
          auto_clock_in_enabled: autoClockIn,
          auto_clock_out_enabled: autoClockOut,
        })
        .eq('user_id', userId);

      if (error) throw error;
      toast.success('Geofencing-Einstellungen gespeichert!');
    } catch (error: any) {
      toast.error('Fehler beim Speichern: ' + error.message);
    }
  };

  const addCurrentLocation = async () => {
    if (!position) {
      toast.error('Aktuelle Position nicht verfügbar');
      return;
    }

    if (!newLocationName.trim()) {
      toast.error('Bitte gib einen Namen für den Standort ein');
      return;
    }

    const newLocation: GeofenceLocation = {
      id: crypto.randomUUID(),
      name: newLocationName.trim(),
      latitude: position.latitude,
      longitude: position.longitude,
    };

    setLocations([...locations, newLocation]);
    setNewLocationName('');
    setIsAddingLocation(false);
    toast.success('Standort hinzugefügt!');
  };

  const removeLocation = (id: string) => {
    setLocations(locations.filter((loc) => loc.id !== id));
  };

  const handleEnableGeofencing = async () => {
    const granted = await requestPermission();
    if (granted) {
      setGeofencingEnabled(true);
      toast.success('Standortzugriff gewährt!');
    } else {
      toast.error('Standortzugriff wurde verweigert');
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Geofencing</h2>

      {!geofencingEnabled ? (
        <Card className="p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-primary/10 rounded-lg">
              <MapPin className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-lg mb-2">Automatische Durchgangs-Erkennung</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Aktiviere Geofencing, um beim Durchqueren eines definierten Punktes automatisch ein- und auszustempeln (Toggle-Funktion).
              </p>
              {permission === 'denied' ? (
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 mb-4">
                  <p className="text-sm font-medium text-destructive mb-2">
                    Standortzugriff wurde blockiert
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Bitte erlaube den Standortzugriff in deinen Browser-Einstellungen und lade die Seite neu.
                  </p>
                </div>
              ) : (
                <Button onClick={handleEnableGeofencing} className="w-full">
                  <MapPin className="h-4 w-4 mr-2" />
                  Geofencing aktivieren
                </Button>
              )}
            </div>
          </div>
        </Card>
      ) : (
        <>
          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold">Geofencing aktiv</h3>
                <p className="text-sm text-muted-foreground">
                  Standorterkennung ist aktiviert
                </p>
              </div>
              <Switch
                checked={geofencingEnabled}
                onCheckedChange={(checked) => {
                  setGeofencingEnabled(checked);
                  if (!checked) {
                    setAutoClockIn(false);
                    setAutoClockOut(false);
                  }
                }}
              />
            </div>

            {position && (
              <div className="bg-muted/50 rounded-lg p-3 text-xs">
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-1">
                  <Navigation className="h-3 w-3" />
                  <span className="font-medium">Aktuelle Position</span>
                </div>
                <div className="text-muted-foreground">
                  {position.latitude.toFixed(6)}, {position.longitude.toFixed(6)}
                  <br />
                  Genauigkeit: ±{Math.round(position.accuracy)}m
                </div>
              </div>
            )}

            {error && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}
          </Card>

          <Card className="p-6 space-y-4">
            <div>
              <Label htmlFor="radius">Trigger-Radius in Metern</Label>
              <Input
                id="radius"
                type="number"
                value={radius}
                onChange={(e) => setRadius(e.target.value)}
                placeholder="100"
                min="10"
                max="1000"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Du löst den Trigger aus, wenn du dich innerhalb von {radius}m eines Trigger-Punkts befindest
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Automatisch einstempeln</Label>
                <p className="text-xs text-muted-foreground">
                  Beim Durchqueren (wenn Status = idle)
                </p>
              </div>
              <Switch
                checked={autoClockIn}
                onCheckedChange={setAutoClockIn}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Automatisch ausstempeln</Label>
                <p className="text-xs text-muted-foreground">
                  Beim Durchqueren (wenn Status = working/break)
                </p>
              </div>
              <Switch
                checked={autoClockOut}
                onCheckedChange={setAutoClockOut}
              />
            </div>
          </Card>

          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold">Trigger-Punkte</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAddingLocation(!isAddingLocation)}
                disabled={!position}
              >
                <Plus className="h-4 w-4 mr-1" />
                Hinzufügen
              </Button>
            </div>

            {isAddingLocation && (
              <div className="space-y-2 p-4 bg-muted/50 rounded-lg">
                <Label htmlFor="location-name">Name des Trigger-Punkts</Label>
                <Input
                  id="location-name"
                  value={newLocationName}
                  onChange={(e) => setNewLocationName(e.target.value)}
                  placeholder="z.B. Einfahrt Werksgelände, Haupttor"
                />
                <div className="flex gap-2">
                  <Button onClick={addCurrentLocation} size="sm" className="flex-1">
                    Aktuellen Standort speichern
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsAddingLocation(false);
                      setNewLocationName('');
                    }}
                  >
                    Abbrechen
                  </Button>
                </div>
              </div>
            )}

            {locations.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Noch keine Trigger-Punkte gespeichert
              </p>
            ) : (
              <div className="space-y-2">
                {locations.map((location) => (
                  <div
                    key={location.id}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <MapPin className="h-4 w-4 text-primary" />
                      <div>
                        <p className="font-medium">{location.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeLocation(location.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Button onClick={saveSettings} className="w-full">
            Einstellungen speichern
          </Button>
        </>
      )}
    </div>
  );
};