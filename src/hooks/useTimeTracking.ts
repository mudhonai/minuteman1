import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { CurrentEntry, TimeEntry, UserSettings, WorkStatus, Break } from '@/lib/types';
import { toast } from 'sonner';

export const useTimeTracking = (userId: string | undefined) => {
  const [currentEntry, setCurrentEntry] = useState<CurrentEntry | null>(null);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<WorkStatus>('idle');

  // Load initial data
  useEffect(() => {
    if (!userId) return;

    const loadData = async () => {
      try {
        // Load current entry
        const { data: current } = await supabase
          .from('current_entry')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();

        if (current) {
          setCurrentEntry({
            ...current,
            breaks: (current.breaks as any) as Break[]
          } as CurrentEntry);
          setStatus(current.status as WorkStatus);
        }

        // Load time entries
        const { data: entries } = await supabase
          .from('time_entries')
          .select('*')
          .eq('user_id', userId)
          .order('date', { ascending: false });

        if (entries) {
          setTimeEntries(entries.map(e => ({
            ...e,
            breaks: (e.breaks as any) as Break[]
          })) as TimeEntry[]);
        }

        // Load settings
        const { data: userSettings } = await supabase
          .from('user_settings')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();

        if (userSettings) {
          setSettings({
            ...userSettings,
            custom_holidays: Array.isArray(userSettings.custom_holidays) ? userSettings.custom_holidays as any : [],
            geofence_locations: Array.isArray(userSettings.geofence_locations) ? userSettings.geofence_locations as any : [],
          } as any as UserSettings);
        } else {
          // Create default settings
          const { data: newSettings } = await supabase
            .from('user_settings')
            .insert({
              user_id: userId,
              break_reminder_enabled: true,
              custom_holidays: []
            })
            .select()
            .single();
          
          if (newSettings) {
            setSettings({
              ...newSettings,
              custom_holidays: Array.isArray(newSettings.custom_holidays) ? newSettings.custom_holidays as any : [],
              geofence_locations: Array.isArray(newSettings.geofence_locations) ? newSettings.geofence_locations as any : [],
            } as any as UserSettings);
          }
        }
      } catch (error: any) {
        console.error('Error loading data:', error);
        toast.error('Fehler beim Laden der Daten');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [userId]);

  // Real-time subscriptions
  useEffect(() => {
    if (!userId) return;

    const currentEntryChannel = supabase
      .channel('current_entry_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'current_entry',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          console.log('Current entry change:', payload.eventType, payload);
          if (payload.eventType === 'DELETE') {
            setCurrentEntry(null);
            setStatus('idle');
          } else if (payload.new) {
            const entry = {
              ...payload.new,
              breaks: (payload.new.breaks as any) as Break[]
            } as CurrentEntry;
            setCurrentEntry(entry);
            setStatus(entry.status);
          }
        }
      )
      .subscribe();

    const timeEntriesChannel = supabase
      .channel('time_entries_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'time_entries',
          filter: `user_id=eq.${userId}`,
        },
        async () => {
          // Reload entries on change
          const { data } = await supabase
            .from('time_entries')
            .select('*')
            .eq('user_id', userId)
            .order('date', { ascending: false });
          
          if (data) {
            setTimeEntries(data.map(e => ({
              ...e,
              breaks: (e.breaks as any) as Break[]
            })) as TimeEntry[]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(currentEntryChannel);
      supabase.removeChannel(timeEntriesChannel);
    };
  }, [userId]);

  return {
    currentEntry,
    timeEntries,
    settings,
    loading,
    status,
    setSettings,
  };
};
