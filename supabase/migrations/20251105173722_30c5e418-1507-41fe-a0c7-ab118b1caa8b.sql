-- Erweitere user_settings um Geofencing Test-Modus und Min-Genauigkeit
ALTER TABLE public.user_settings 
ADD COLUMN IF NOT EXISTS geofence_min_accuracy INTEGER DEFAULT 50,
ADD COLUMN IF NOT EXISTS geofence_test_mode BOOLEAN DEFAULT false;