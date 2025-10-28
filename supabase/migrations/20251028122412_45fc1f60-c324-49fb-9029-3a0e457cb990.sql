-- Benachrichtigungseinstellungen zur user_settings Tabelle hinzufügen
ALTER TABLE public.user_settings
ADD COLUMN notification_preferences JSONB DEFAULT '{
  "break_reminders": true,
  "break_reminder_hours": 6,
  "clock_out_reminders": true,
  "clock_out_reminder_hour": 18
}'::jsonb;