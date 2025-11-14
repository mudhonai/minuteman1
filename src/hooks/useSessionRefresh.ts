import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UseSessionRefreshProps {
  enabled: boolean;
  inactivityThreshold?: number; // Minuten bis Session-Refresh
}

export const useSessionRefresh = ({ 
  enabled, 
  inactivityThreshold = 10 
}: UseSessionRefreshProps) => {
  const lastActivityRef = useRef<number>(Date.now());
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const handleActivity = () => {
      lastActivityRef.current = Date.now();
    };

    const checkAndRefreshSession = async () => {
      const timeSinceLastActivity = Date.now() - lastActivityRef.current;
      const thresholdMs = inactivityThreshold * 60 * 1000;

      // Nur refreshen wenn es kürzlich Aktivität gab
      if (timeSinceLastActivity < thresholdMs) {
        console.log('🔄 Session-Refresh: Benutzeraktivität erkannt, verlängere Session...');
        
        const { data: { session }, error } = await supabase.auth.refreshSession();
        
        if (error) {
          console.error('🔄 Session-Refresh Fehler:', error);
        } else if (session) {
          console.log('🔄 Session erfolgreich verlängert:', {
            expiresAt: session.expires_at ? new Date(session.expires_at * 1000).toLocaleString('de-DE') : null
          });
        }
      } else {
        console.log('🔄 Session-Refresh: Keine Aktivität, überspringe Refresh');
      }
    };

    // Event Listener für Benutzeraktivität
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    // Prüfe alle 5 Minuten ob Session verlängert werden sollte
    const intervalId = setInterval(() => {
      checkAndRefreshSession();
    }, 5 * 60 * 1000);

    console.log('🔄 Session-Refresh aktiviert: Prüfe alle 5 Minuten bei Aktivität');

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
      clearInterval(intervalId);
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
      console.log('🔄 Session-Refresh deaktiviert');
    };
  }, [enabled, inactivityThreshold]);
};
