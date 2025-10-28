import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CheckCircle2, Clock, TrendingUp } from 'lucide-react';
import { formatMinutesToHHMM } from '@/lib/timeUtils';

interface OvertimeAllowanceProps {
  userId: string;
}

interface OvertimeAllowanceData {
  id: string;
  year: number;
  total_hours: number;
  consumed_hours: number;
  is_fully_consumed: boolean;
  start_date: string;
  notes: string | null;
}

export const OvertimeAllowance = ({ userId }: OvertimeAllowanceProps) => {
  const [currentYear, setCurrentYear] = useState<OvertimeAllowanceData | null>(null);
  const [previousYears, setPreviousYears] = useState<OvertimeAllowanceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [actualOvertime, setActualOvertime] = useState(0);

  useEffect(() => {
    loadOvertimeData();
  }, [userId]);

  const loadOvertimeData = async () => {
    try {
      setLoading(true);
      const year = new Date().getFullYear();

      // Lade alle ÜSP-Einträge
      const { data: allowances, error: allowanceError } = await supabase
        .from('overtime_allowance')
        .select('*')
        .eq('user_id', userId)
        .order('year', { ascending: false });

      if (allowanceError) throw allowanceError;

      // Aktuelles Jahr
      const current = allowances?.find(a => a.year === year);
      if (current) {
        setCurrentYear(current);
      } else {
        // Erstelle Eintrag für aktuelles Jahr, falls nicht vorhanden
        await createYearEntry(year);
      }

      // Vorherige Jahre
      setPreviousYears(allowances?.filter(a => a.year < year) || []);

      // Berechne tatsächliche Überstunden
      await calculateActualOvertime();
    } catch (error: any) {
      toast.error('Fehler beim Laden der ÜSP-Daten: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const createYearEntry = async (year: number) => {
    try {
      const startDate = `${year}-01-01`;
      const isCurrentYear = year === new Date().getFullYear();
      const isPast = year < 2026;

      const { data, error } = await supabase
        .from('overtime_allowance')
        .insert({
          user_id: userId,
          year,
          total_hours: 150,
          consumed_hours: isPast ? 150 : 0,
          is_fully_consumed: isPast,
          start_date: startDate,
          notes: isPast ? 'Bereits abgegolten' : null,
        })
        .select()
        .single();

      if (error) throw error;
      if (isCurrentYear) setCurrentYear(data);
      else setPreviousYears(prev => [data, ...prev]);
    } catch (error: any) {
      toast.error('Fehler beim Erstellen des ÜSP-Eintrags: ' + error.message);
    }
  };

  const calculateActualOvertime = async () => {
    try {
      // Berechne Soll-Arbeitszeit und Ist-Arbeitszeit
      const { data: entries, error } = await supabase
        .from('time_entries')
        .select('net_work_duration_minutes, date')
        .eq('user_id', userId);

      if (error) throw error;

      let totalWorkedMinutes = 0;
      let totalTargetMinutes = 0;

      entries?.forEach(entry => {
        const date = new Date(entry.date);
        const dayOfWeek = date.getDay();
        
        totalWorkedMinutes += entry.net_work_duration_minutes;

        // Soll-Arbeitszeit je nach Wochentag (aus types.ts)
        if (dayOfWeek === 1 || dayOfWeek === 2 || dayOfWeek === 3 || dayOfWeek === 4) {
          totalTargetMinutes += 510; // 8h 30m
        } else if (dayOfWeek === 5) {
          totalTargetMinutes += 240; // 4h
        }
      });

      const overtimeMinutes = totalWorkedMinutes - totalTargetMinutes;
      setActualOvertime(overtimeMinutes);
    } catch (error: any) {
      console.error('Fehler bei Überstundenberechnung:', error);
    }
  };

  const markAsConsumed = async (id: string) => {
    try {
      const { error } = await supabase
        .from('overtime_allowance')
        .update({ is_fully_consumed: true, consumed_hours: 150 })
        .eq('id', id);

      if (error) throw error;
      toast.success('Als vollständig verbraucht markiert');
      loadOvertimeData();
    } catch (error: any) {
      toast.error('Fehler: ' + error.message);
    }
  };

  if (loading) {
    return <div className="text-center p-8">Lade ÜSP-Daten...</div>;
  }

  const remainingHours = currentYear ? currentYear.total_hours - currentYear.consumed_hours : 150;
  const progressPercent = currentYear ? (currentYear.consumed_hours / currentYear.total_hours) * 100 : 0;
  const overtimeHours = actualOvertime / 60;
  const effectiveOvertime = Math.max(0, overtimeHours - remainingHours);

  return (
    <div className="space-y-6 pb-8">
      <div>
        <h2 className="text-3xl font-bold mb-2">Überstundenpauschale (ÜSP)</h2>
        <p className="text-muted-foreground">
          Verwaltung der jährlichen 150-Stunden-Pauschale
        </p>
      </div>

      {/* Aktuelles Jahr */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="h-6 w-6 text-primary" />
          <h3 className="text-2xl font-semibold">
            Jahr {currentYear?.year || new Date().getFullYear()}
          </h3>
        </div>

        {currentYear?.is_fully_consumed ? (
          <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-4">
            <CheckCircle2 className="h-5 w-5" />
            <span className="font-semibold">Bereits abgegolten</span>
          </div>
        ) : (
          <>
            <div className="space-y-2 mb-6">
              <div className="flex justify-between text-sm">
                <span>Verbrauchte Stunden</span>
                <span className="font-semibold">
                  {currentYear?.consumed_hours.toFixed(1) || 0} / {currentYear?.total_hours || 150} h
                </span>
              </div>
              <Progress value={progressPercent} className="h-3" />
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Verbleibend</p>
                <p className="text-2xl font-bold">{remainingHours.toFixed(1)} h</p>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Gesamt Überstunden</p>
                <p className="text-2xl font-bold">{overtimeHours.toFixed(1)} h</p>
              </div>
            </div>
          </>
        )}

        <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
          <div className="flex items-start gap-2">
            <TrendingUp className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="font-semibold mb-1">Anrechenbare Überstunden</p>
              <p className="text-sm text-muted-foreground mb-2">
                Nach Abzug der ÜSP verbleiben {effectiveOvertime.toFixed(1)} Stunden als echte Überstunden
              </p>
              <p className="text-xs text-muted-foreground">
                Die ersten 150 Stunden werden gegen die ÜSP verrechnet.
                Erst danach zählen Überstunden in die normale Berechnung.
              </p>
            </div>
          </div>
        </div>

        {currentYear?.notes && (
          <p className="text-sm text-muted-foreground mt-4 italic">
            Hinweis: {currentYear.notes}
          </p>
        )}
      </Card>

      {/* Vorherige Jahre */}
      {previousYears.length > 0 && (
        <Card className="p-6">
          <h3 className="text-xl font-semibold mb-4">Vorherige Jahre</h3>
          <div className="space-y-3">
            {previousYears.map((year) => (
              <div
                key={year.id}
                className="flex items-center justify-between p-4 bg-muted rounded-lg"
              >
                <div>
                  <p className="font-semibold">Jahr {year.year}</p>
                  <p className="text-sm text-muted-foreground">
                    {year.consumed_hours.toFixed(1)} / {year.total_hours} h verbraucht
                  </p>
                  {year.notes && (
                    <p className="text-xs text-muted-foreground italic mt-1">
                      {year.notes}
                    </p>
                  )}
                </div>
                {year.is_fully_consumed ? (
                  <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => markAsConsumed(year.id)}
                  >
                    Als verbraucht markieren
                  </Button>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Info-Box */}
      <Card className="p-6 bg-muted/50">
        <h3 className="font-semibold mb-2">ℹ️ Wie funktioniert die ÜSP?</h3>
        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
          <li>Jedes Jahr am 01.01. beginnt eine neue 150-Stunden-Pauschale</li>
          <li>Überstunden werden zunächst gegen diese Pauschale verrechnet</li>
          <li>Erst nach Verbrauch der 150 Stunden werden Überstunden angerechnet</li>
          <li>Für 2025 ist die ÜSP bereits vollständig abgegolten</li>
          <li>Ab 01.01.2026 beginnt die neue Zählung</li>
        </ul>
      </Card>
    </div>
  );
};
