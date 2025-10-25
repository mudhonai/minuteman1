import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Smartphone, Download, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Install() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    
    setDeferredPrompt(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 flex items-center justify-center p-4">
      <Card className="max-w-md w-full p-8 space-y-6">
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
              <Smartphone className="h-10 w-10 text-primary" />
            </div>
          </div>
          
          <h1 className="text-3xl font-bold">Minuteman installieren</h1>
          
          {isInstalled ? (
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-2 text-green-600">
                <Check className="h-5 w-5" />
                <p className="font-semibold">App bereits installiert!</p>
              </div>
              <Button onClick={() => navigate('/')} className="w-full">
                Zur App
              </Button>
            </div>
          ) : (
            <>
              <p className="text-muted-foreground">
                Installiere Minuteman auf deinem Handy für schnellen Zugriff und Offline-Nutzung.
              </p>

              <div className="space-y-4 text-left">
                <h3 className="font-semibold">So funktioniert's:</h3>
                
                {deferredPrompt ? (
                  <Button onClick={handleInstall} className="w-full gap-2">
                    <Download className="h-5 w-5" />
                    Jetzt installieren
                  </Button>
                ) : (
                  <div className="space-y-3 text-sm text-muted-foreground">
                    <div>
                      <p className="font-semibold text-foreground mb-1">iPhone (Safari):</p>
                      <p>1. Tippe auf das Teilen-Symbol (Quadrat mit Pfeil)</p>
                      <p>2. Wähle "Zum Home-Bildschirm"</p>
                      <p>3. Tippe auf "Hinzufügen"</p>
                    </div>
                    
                    <div>
                      <p className="font-semibold text-foreground mb-1">Android (Chrome):</p>
                      <p>1. Tippe auf das Menü (drei Punkte)</p>
                      <p>2. Wähle "App installieren" oder "Zum Startbildschirm hinzufügen"</p>
                      <p>3. Tippe auf "Installieren"</p>
                    </div>
                  </div>
                )}
              </div>

              <Button onClick={() => navigate('/')} variant="outline" className="w-full">
                Zurück zur App
              </Button>
            </>
          )}
        </div>

        <div className="pt-4 border-t text-center text-sm text-muted-foreground">
          <p>Die App funktioniert offline und lädt schneller nach der Installation.</p>
        </div>
      </Card>
    </div>
  );
}
