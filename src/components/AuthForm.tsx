import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import marbleBackground from '@/assets/marble-background.jpg';

export const AuthForm = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    console.log('🔐 Auth-Versuch:', { isLogin, email });

    try {
      if (isLogin) {
        console.log('🔐 Login-Versuch...');
        const { error, data } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        console.log('🔐 Login erfolgreich:', { userId: data.user?.id, email: data.user?.email });
        toast.success('Erfolgreich angemeldet!');
      } else {
        console.log('🔐 Registrierungs-Versuch...');
        const { error, data } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        console.log('🔐 Registrierung erfolgreich:', { userId: data.user?.id, email: data.user?.email });
        toast.success('Konto erstellt! Du kannst dich jetzt anmelden.');
      }
    } catch (error: any) {
      console.error('🔐 Auth-Fehler:', error);
      toast.error(error.message || 'Ein Fehler ist aufgetreten');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        backgroundImage: `url(${marbleBackground})`,
        backgroundSize: 'cover',
        backgroundAttachment: 'fixed',
        backgroundPosition: 'center'
      }}
    >
      <Card className="w-full max-w-md border-border shadow-2xl">
        <CardHeader className="space-y-1">
          <CardTitle className="text-3xl font-extrabold text-accent text-center">
            Minuteman
          </CardTitle>
          <CardDescription className="text-center text-muted-foreground">
            Dein mobiles Zeiterfassungs-Terminal
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAuth} className="space-y-4">
            <div className="space-y-2">
              <Input
                type="email"
                placeholder="E-Mail"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-card border-border"
              />
            </div>
            <div className="space-y-2">
              <Input
                type="password"
                placeholder="Passwort"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="bg-card border-border"
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-primary/90"
            >
              {loading ? 'Laden...' : isLogin ? 'Anmelden' : 'Registrieren'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsLogin(!isLogin)}
              className="w-full"
            >
              {isLogin ? 'Noch kein Konto? Registrieren' : 'Bereits ein Konto? Anmelden'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
