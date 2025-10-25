import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { RefreshCw } from 'lucide-react';

export const PWAUpdatePrompt = () => {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      // Check for updates every 60 seconds
      const interval = setInterval(() => {
        navigator.serviceWorker.getRegistration().then((reg) => {
          if (reg) {
            reg.update();
          }
        });
      }, 60000);

      // Listen for service worker updates
      navigator.serviceWorker.ready.then((reg) => {
        setRegistration(reg);
        
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                setNeedRefresh(true);
              }
            });
          }
        });

        // Check if already offline ready
        if (!navigator.onLine || (reg.active && !navigator.serviceWorker.controller)) {
          setOfflineReady(true);
        }
      });

      return () => clearInterval(interval);
    }
  }, []);

  const handleUpdate = () => {
    if (registration && registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      setNeedRefresh(false);
      window.location.reload();
    }
  };

  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  if (!needRefresh && !offlineReady) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-slide-in-right">
      <Card className="p-4 shadow-2xl border-2 border-primary bg-card max-w-sm">
        {needRefresh && (
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <RefreshCw className="h-5 w-5 text-primary mt-0.5" />
              <div className="flex-1">
                <h3 className="font-bold text-sm">Update verfügbar!</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Eine neue Version ist verfügbar. Jetzt aktualisieren?
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={handleUpdate} 
                size="sm"
                className="flex-1"
              >
                Aktualisieren
              </Button>
              <Button 
                onClick={close} 
                variant="outline" 
                size="sm"
                className="flex-1"
              >
                Später
              </Button>
            </div>
          </div>
        )}
        
        {offlineReady && !needRefresh && (
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="h-5 w-5 rounded-full bg-green-500 flex items-center justify-center">
                <span className="text-white text-xs">✓</span>
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-sm">App bereit!</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Die App ist jetzt offline verfügbar.
                </p>
              </div>
            </div>
            <Button 
              onClick={close} 
              variant="outline" 
              size="sm"
              className="w-full"
            >
              OK
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
};
