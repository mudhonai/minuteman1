-- Urlaubskontingent-Tabelle erstellen
CREATE TABLE public.vacation_allowance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  year INTEGER NOT NULL,
  total_days NUMERIC NOT NULL DEFAULT 30,
  used_days NUMERIC NOT NULL DEFAULT 0,
  remaining_days NUMERIC GENERATED ALWAYS AS (total_days - used_days) STORED,
  carried_over_days NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, year)
);

-- Enable Row Level Security
ALTER TABLE public.vacation_allowance ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Benutzer können eigenes Urlaubskontingent ansehen"
ON public.vacation_allowance
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Benutzer können eigenes Urlaubskontingent erstellen"
ON public.vacation_allowance
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Benutzer können eigenes Urlaubskontingent aktualisieren"
ON public.vacation_allowance
FOR UPDATE
USING (auth.uid() = user_id);

-- Trigger für updated_at
CREATE TRIGGER update_vacation_allowance_updated_at
BEFORE UPDATE ON public.vacation_allowance
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Funktion zum automatischen Aktualisieren der verbrauchten Urlaubstage
CREATE OR REPLACE FUNCTION public.update_vacation_used_days()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Wenn ein Urlaubseintrag hinzugefügt wird
  IF (TG_OP = 'INSERT' AND NEW.absence_type = 'urlaub') THEN
    INSERT INTO vacation_allowance (user_id, year, used_days)
    VALUES (
      NEW.user_id,
      EXTRACT(YEAR FROM NEW.date)::INTEGER,
      NEW.hours / 8.5  -- Umrechnung Stunden in Tage (8.5h = 1 Tag)
    )
    ON CONFLICT (user_id, year)
    DO UPDATE SET used_days = vacation_allowance.used_days + (NEW.hours / 8.5);
  END IF;
  
  -- Wenn ein Urlaubseintrag gelöscht wird
  IF (TG_OP = 'DELETE' AND OLD.absence_type = 'urlaub') THEN
    UPDATE vacation_allowance
    SET used_days = GREATEST(0, used_days - (OLD.hours / 8.5))
    WHERE user_id = OLD.user_id 
    AND year = EXTRACT(YEAR FROM OLD.date)::INTEGER;
  END IF;
  
  -- Wenn ein Urlaubseintrag geändert wird
  IF (TG_OP = 'UPDATE') THEN
    -- Alte Tage abziehen
    IF (OLD.absence_type = 'urlaub') THEN
      UPDATE vacation_allowance
      SET used_days = GREATEST(0, used_days - (OLD.hours / 8.5))
      WHERE user_id = OLD.user_id 
      AND year = EXTRACT(YEAR FROM OLD.date)::INTEGER;
    END IF;
    
    -- Neue Tage hinzufügen
    IF (NEW.absence_type = 'urlaub') THEN
      INSERT INTO vacation_allowance (user_id, year, used_days)
      VALUES (
        NEW.user_id,
        EXTRACT(YEAR FROM NEW.date)::INTEGER,
        NEW.hours / 8.5
      )
      ON CONFLICT (user_id, year)
      DO UPDATE SET used_days = vacation_allowance.used_days + (NEW.hours / 8.5);
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Trigger für automatische Urlaubstage-Aktualisierung
CREATE TRIGGER sync_vacation_days
AFTER INSERT OR UPDATE OR DELETE ON public.absence_entries
FOR EACH ROW
EXECUTE FUNCTION public.update_vacation_used_days();