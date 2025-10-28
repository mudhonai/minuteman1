-- Tabelle für Überstundenpauschale (ÜSP) pro Jahr
CREATE TABLE public.overtime_allowance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  year INTEGER NOT NULL,
  total_hours NUMERIC NOT NULL DEFAULT 150,
  consumed_hours NUMERIC NOT NULL DEFAULT 0,
  is_fully_consumed BOOLEAN NOT NULL DEFAULT false,
  start_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, year)
);

-- RLS Policies
ALTER TABLE public.overtime_allowance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Benutzer können eigene ÜSP ansehen" 
ON public.overtime_allowance 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Benutzer können eigene ÜSP erstellen" 
ON public.overtime_allowance 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Benutzer können eigene ÜSP aktualisieren" 
ON public.overtime_allowance 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Trigger für updated_at
CREATE TRIGGER update_overtime_allowance_updated_at
BEFORE UPDATE ON public.overtime_allowance
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index für bessere Performance
CREATE INDEX idx_overtime_allowance_user_year ON public.overtime_allowance(user_id, year);