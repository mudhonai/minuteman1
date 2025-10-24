-- Erstelle Tabelle für abgeschlossene Zeiteinträge
CREATE TABLE public.time_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  breaks JSONB DEFAULT '[]'::jsonb,
  net_work_duration_minutes INTEGER NOT NULL,
  total_break_duration_ms BIGINT NOT NULL DEFAULT 0,
  regular_minutes INTEGER NOT NULL DEFAULT 0,
  surcharge_minutes INTEGER NOT NULL DEFAULT 0,
  surcharge_amount INTEGER NOT NULL DEFAULT 0,
  is_surcharge_day BOOLEAN NOT NULL DEFAULT FALSE,
  surcharge_label TEXT DEFAULT 'Regulär',
  date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Erstelle Tabelle für aktuelle Arbeitssitzung
CREATE TABLE public.current_entry (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  start_time TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('working', 'break')),
  breaks JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Erstelle Tabelle für Benutzereinstellungen
CREATE TABLE public.user_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  break_reminder_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  custom_holidays JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.current_entry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies für time_entries
CREATE POLICY "Benutzer können eigene Zeiteinträge ansehen"
  ON public.time_entries
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Benutzer können eigene Zeiteinträge erstellen"
  ON public.time_entries
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Benutzer können eigene Zeiteinträge aktualisieren"
  ON public.time_entries
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Benutzer können eigene Zeiteinträge löschen"
  ON public.time_entries
  FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies für current_entry
CREATE POLICY "Benutzer können eigenen aktuellen Eintrag ansehen"
  ON public.current_entry
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Benutzer können eigenen aktuellen Eintrag erstellen"
  ON public.current_entry
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Benutzer können eigenen aktuellen Eintrag aktualisieren"
  ON public.current_entry
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Benutzer können eigenen aktuellen Eintrag löschen"
  ON public.current_entry
  FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies für user_settings
CREATE POLICY "Benutzer können eigene Einstellungen ansehen"
  ON public.user_settings
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Benutzer können eigene Einstellungen erstellen"
  ON public.user_settings
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Benutzer können eigene Einstellungen aktualisieren"
  ON public.user_settings
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Indizes für bessere Performance
CREATE INDEX idx_time_entries_user_id ON public.time_entries(user_id);
CREATE INDEX idx_time_entries_date ON public.time_entries(date DESC);
CREATE INDEX idx_current_entry_user_id ON public.current_entry(user_id);

-- Trigger für updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_current_entry_updated_at
  BEFORE UPDATE ON public.current_entry
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_settings_updated_at
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable Realtime für Live-Updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.current_entry;
ALTER PUBLICATION supabase_realtime ADD TABLE public.time_entries;