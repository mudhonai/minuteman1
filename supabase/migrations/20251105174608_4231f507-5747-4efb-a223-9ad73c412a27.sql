-- Aktiviere Realtime für alle relevanten Tabellen

-- Current Entry
ALTER TABLE public.current_entry REPLICA IDENTITY FULL;

-- Time Entries
ALTER TABLE public.time_entries REPLICA IDENTITY FULL;

-- Absence Entries
ALTER TABLE public.absence_entries REPLICA IDENTITY FULL;

-- User Settings
ALTER TABLE public.user_settings REPLICA IDENTITY FULL;

-- Vacation Allowance
ALTER TABLE public.vacation_allowance REPLICA IDENTITY FULL;

-- Overtime Allowance
ALTER TABLE public.overtime_allowance REPLICA IDENTITY FULL;

-- Geofencing Logs
ALTER TABLE public.geofencing_logs REPLICA IDENTITY FULL;