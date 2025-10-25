-- Create absence type enum
CREATE TYPE public.absence_type AS ENUM ('urlaub', 'juep', 'krankheit');

-- Create absence_entries table
CREATE TABLE public.absence_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  date DATE NOT NULL,
  absence_type absence_type NOT NULL,
  hours DECIMAL(5,2) NOT NULL DEFAULT 8.5,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.absence_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Benutzer können eigene Abwesenheiten ansehen"
  ON public.absence_entries
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Benutzer können eigene Abwesenheiten erstellen"
  ON public.absence_entries
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Benutzer können eigene Abwesenheiten aktualisieren"
  ON public.absence_entries
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Benutzer können eigene Abwesenheiten löschen"
  ON public.absence_entries
  FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_absence_entries_updated_at
  BEFORE UPDATE ON public.absence_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();