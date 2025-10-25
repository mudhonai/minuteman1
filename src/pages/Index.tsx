import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AuthForm } from '@/components/AuthForm';
import { Dashboard } from '@/components/Dashboard';
import { History } from '@/components/History';
import { Settings } from '@/components/Settings';
import { Absences } from '@/components/Absences';
import { CalendarView } from '@/components/CalendarView';
import { Statistics } from '@/components/Statistics';
import { useTimeTracking } from '@/hooks/useTimeTracking';
import { useAbsences } from '@/hooks/useAbsences';
import { Button } from '@/components/ui/button';

const Index = () => {
  const [user, setUser] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState<'dashboard' | 'history' | 'absences' | 'calendar' | 'statistics' | 'settings'>('dashboard');
  
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const { currentEntry, timeEntries, settings, loading, status } = useTimeTracking(user?.id);
  const { absences, loading: absencesLoading } = useAbsences(user?.id);

  if (!user) {
    return <AuthForm />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Lade Daten...</p>
        </div>
      </div>
    );
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-lg mx-auto p-4 md:p-6">
        <header className="mb-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="bg-primary/20 p-2 rounded-xl">
                <img 
                  src="/pwa-192x192.png" 
                  alt="Minuteman Logo" 
                  className="h-10 w-10"
                />
              </div>
              <div>
                <h1 className="text-4xl font-extrabold text-accent">Minuteman</h1>
                <p className="text-sm text-muted-foreground">IchWarDa - Dein Zeiterfassungs-Terminal</p>
              </div>
            </div>
            <Button onClick={handleSignOut} variant="ghost" size="sm">
              Abmelden
            </Button>
          </div>
        </header>

        <nav className="bg-card p-2 rounded-xl mb-6 shadow-xl border border-border overflow-x-auto">
          <div className="flex gap-1 min-w-max">
            <button
              onClick={() => setCurrentPage('dashboard')}
              className={`px-3 py-2 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
                currentPage === 'dashboard'
                  ? 'bg-primary text-primary-foreground shadow-lg'
                  : 'bg-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setCurrentPage('history')}
              className={`px-3 py-2 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
                currentPage === 'history'
                  ? 'bg-primary text-primary-foreground shadow-lg'
                  : 'bg-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Historie
            </button>
            <button
              onClick={() => setCurrentPage('absences')}
              className={`px-3 py-2 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
                currentPage === 'absences'
                  ? 'bg-primary text-primary-foreground shadow-lg'
                  : 'bg-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Abwesenheit
            </button>
            <button
              onClick={() => setCurrentPage('calendar')}
              className={`px-3 py-2 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
                currentPage === 'calendar'
                  ? 'bg-primary text-primary-foreground shadow-lg'
                  : 'bg-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Kalender
            </button>
            <button
              onClick={() => setCurrentPage('statistics')}
              className={`px-3 py-2 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
                currentPage === 'statistics'
                  ? 'bg-primary text-primary-foreground shadow-lg'
                  : 'bg-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Statistik
            </button>
            <button
              onClick={() => setCurrentPage('settings')}
              className={`px-3 py-2 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
                currentPage === 'settings'
                  ? 'bg-primary text-primary-foreground shadow-lg'
                  : 'bg-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Settings
            </button>
          </div>
        </nav>

        <main>
          {currentPage === 'dashboard' && (
            <Dashboard
              currentEntry={currentEntry}
              timeEntries={timeEntries}
              absences={absences}
              status={status}
              userId={user.id}
              customHolidays={settings?.custom_holidays || []}
            />
          )}
          {currentPage === 'history' && (
            <History 
              timeEntries={timeEntries} 
              customHolidays={settings?.custom_holidays || []}
            />
          )}
          {currentPage === 'absences' && (
            <Absences absences={absences} />
          )}
          {currentPage === 'calendar' && (
            <CalendarView 
              timeEntries={timeEntries}
              absences={absences}
            />
          )}
          {currentPage === 'statistics' && (
            <Statistics
              timeEntries={timeEntries}
              absences={absences}
            />
          )}
          {currentPage === 'settings' && settings && (
            <Settings settings={settings} userId={user.id} />
          )}
        </main>
      </div>
    </div>
  );
};

export default Index;
