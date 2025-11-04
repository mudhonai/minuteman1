-- Geofencing-Logs Tabelle für Historie und Debugging
CREATE TABLE public.geofencing_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  action TEXT NOT NULL, -- 'clock_in' oder 'clock_out'
  trigger_type TEXT NOT NULL, -- 'auto' oder 'manual' oder 'test'
  location_name TEXT NOT NULL,
  latitude NUMERIC(10, 6) NOT NULL,
  longitude NUMERIC(10, 6) NOT NULL,
  gps_accuracy NUMERIC NOT NULL,
  distance_to_trigger NUMERIC,
  status_before TEXT,
  status_after TEXT,
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS aktivieren
ALTER TABLE public.geofencing_logs ENABLE ROW LEVEL SECURITY;

-- Policies erstellen
CREATE POLICY "Benutzer können eigene Geofencing-Logs ansehen"
ON public.geofencing_logs
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Benutzer können eigene Geofencing-Logs erstellen"
ON public.geofencing_logs
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Index für schnellere Abfragen
CREATE INDEX idx_geofencing_logs_user_timestamp ON public.geofencing_logs(user_id, timestamp DESC);