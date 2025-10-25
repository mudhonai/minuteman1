import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AbsenceEntry } from '@/lib/types';

export const useAbsences = (userId: string | undefined) => {
  const [absences, setAbsences] = useState<AbsenceEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const fetchAbsences = async () => {
      try {
        const { data, error } = await supabase
          .from('absence_entries')
          .select('*')
          .eq('user_id', userId)
          .order('date', { ascending: false });

        if (error) throw error;
        setAbsences(data || []);
      } catch (error) {
        console.error('Error fetching absences:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAbsences();

    // Subscribe to changes
    const channel = supabase
      .channel('absence_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'absence_entries',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          fetchAbsences();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [userId]);

  return { absences, loading };
};
