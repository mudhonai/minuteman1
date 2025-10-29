-- Add geofencing settings to user_settings
ALTER TABLE user_settings 
ADD COLUMN IF NOT EXISTS geofencing_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS geofence_locations JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS geofence_radius_meters INTEGER DEFAULT 100,
ADD COLUMN IF NOT EXISTS auto_clock_in_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS auto_clock_out_enabled BOOLEAN DEFAULT false;