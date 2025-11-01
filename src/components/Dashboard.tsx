import { useState, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CurrentEntry, TimeEntry, AbsenceEntry, TARGET_HOURS_DAILY, TARGET_HOURS_WEEKLY, TARGET_HOURS_MONTHLY } from '@/lib/types';
import { formatMinutesToHHMM, formatGermanDateTime, calculateNetWorkDuration } from '@/lib/timeUtils';
import { generatePDFReport } from '@/lib/pdfExport';
import { useWorkActions } from '@/hooks/useWorkActions';
import { toast } from 'sonner';
import { Download, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';

interface DashboardProps {
  currentEntry: CurrentEntry | null;
  timeEntries: TimeEntry[];
  absences: AbsenceEntry[];
  status: 'idle' | 'working' | 'break';
  userId: string;
  customHolidays: string[];
  onStateChange?: () => void;
}

export const Dashboard = ({ currentEntry, timeEntries, absences, status, userId, customHolidays, onStateChange }: DashboardProps) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [pdfPeriod, setPdfPeriod] = useState<'week' | 'month' | 'year'>('month');
  const { startWork, startBreak, endBreak, endWork } = useWorkActions(userId, customHolidays, onStateChange);

  const goToPreviousDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() - 1);
    setSelectedDate(newDate);
  };

  const goToNextDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + 1);
    // Nicht in die Zukunft navigieren
    if (newDate <= new Date()) {
      setSelectedDate(newDate);
    }
  };

  const goToToday = () => {
    setSelectedDate(new Date());
  };

  const isToday = selectedDate.toISOString().substring(0, 10) === new Date().toISOString().substring(0, 10);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const liveMinutes = useMemo(() => {
    if (!currentEntry) return 0;
    const { netMinutes } = calculateNetWorkDuration(
      currentEntry.start_time,
      currentTime.toISOString(),
      currentEntry.breaks
    );
    return netMinutes;
  }, [currentEntry, currentTime]);

  // === SIMPLE WOCHENBERECHNUNG ===
  const getMonday = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return d;
  };

  const monday = getMonday();
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  
  const formatDate = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const mondayStr = formatDate(monday);
  const sundayStr = formatDate(sunday);
  const todayStr = selectedDate.toISOString().substring(0, 10);
  const monthStr = currentTime.toISOString().substring(0, 7);

  // Deduplizierung
  const seen = new Set();
  const unique = timeEntries.filter(e => {
    if (seen.has(e.id)) return false;
    seen.add(e.id);
    return true;
  });

  // Berechnung
  let todayMin = 0, todaySurch = 0;
  let weekMin = 0, weekSurch = 0, weekOT = 0;
  let monthMin = 0, monthSurch = 0, monthOT = 0;

  unique.forEach(e => {
    if (e.date === todayStr) {
      todayMin += e.net_work_duration_minutes;
      todaySurch += e.surcharge_minutes;
    }
    
    if (e.date >= mondayStr && e.date <= sundayStr) {
      weekMin += e.net_work_duration_minutes;
      weekSurch += e.surcharge_amount;
      
      const dow = new Date(e.start_time).getDay();
      const isWE = dow === 0 || dow === 6 || e.is_surcharge_day;
      weekOT += isWE ? e.net_work_duration_minutes : Math.max(0, e.net_work_duration_minutes - (TARGET_HOURS_DAILY[dow] || 0));
    }
    
    if (e.date.startsWith(monthStr)) {
      monthMin += e.net_work_duration_minutes;
      monthSurch += e.surcharge_amount;
      
      const dow = new Date(e.start_time).getDay();
      const isWE = dow === 0 || dow === 6 || e.is_surcharge_day;
      monthOT += isWE ? e.net_work_duration_minutes : Math.max(0, e.net_work_duration_minutes - (TARGET_HOURS_DAILY[dow] || 0));
    }
  });

  absences.forEach(a => {
    const aMin = a.hours * 60;
    
    if (a.date === todayStr && (a.absence_type === 'urlaub' || a.absence_type === 'juep')) {
      todayMin += aMin;
    }
    
    if (a.date >= mondayStr && a.date <= sundayStr) {
      if (a.absence_type === 'urlaub') weekMin += aMin;
      else if (a.absence_type === 'juep') { weekMin += aMin; weekOT -= aMin; }
    }
    
    if (a.date.startsWith(monthStr)) {
      if (a.absence_type === 'urlaub') monthMin += aMin;
      else if (a.absence_type === 'juep') { monthMin += aMin; monthOT -= aMin; }
    }
  });

  console.log('📊 FINALE WERTE:', { 
    weekMin, 
    weekMinFormatted: formatMinutesToHHMM(weekMin),
    uniqueEntriesCount: unique.length,
    thisWeekEntries: unique.filter(e => e.date >= mondayStr && e.date <= sundayStr).map(e => ({ date: e.date, min: e.net_work_duration_minutes }))
  });

  const dashboardData = {
    todayMinutes: todayMin,
    todaySurchargeMinutes: todaySurch,
    todayTargetMinutes: TARGET_HOURS_DAILY[selectedDate.getDay()] || 0,
    weekTotal: weekMin,
    weekOvertime: weekOT,
    weekSurchargeAmount: weekSurch,
    monthTotal: monthMin,
    monthOvertime: monthOT,
    monthSurchargeAmount: monthSurch,
  };

  const getStatusCardClass = () => {
    if (status === 'working') return 'bg-primary/20 border-primary';
    if (status === 'break') return 'bg-secondary/20 border-secondary';
    return 'bg-card border-border';
  };

  const getStatusText = () => {
    if (status === 'working') return `Aktiv: Arbeit läuft (${formatMinutesToHHMM(liveMinutes)})`;
    if (status === 'break') return `Aktiv: Pause läuft (Arbeitszeit: ${formatMinutesToHHMM(liveMinutes)})`;
    return 'Startklar';
  };

  const exportPDF = async () => {
    try {
      toast.info('PDF wird erstellt...');
      const pdf = await generatePDFReport({
        timeEntries,
        absences,
        currentEntry: currentEntry || undefined,
        period: pdfPeriod,
      });
      
      const periodLabel = pdfPeriod === 'week' ? 'Woche' : pdfPeriod === 'month' ? 'Monat' : 'Jahr';
      pdf.save(`Arbeitszeitbericht_${periodLabel}_${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success('PDF erfolgreich exportiert!');
    } catch (error) {
      console.error('PDF Export Error:', error);
      toast.error('Fehler beim Exportieren des PDFs');
    }
  };

  return (
    <div className="space-y-6">{/* removed id="report-container" */}
      {/* Status Card */}
      <Card className={`p-4 ${getStatusCardClass()} border-2 shadow-lg transition-all`}>
        <h2 className="text-xl font-bold">{getStatusText()}</h2>
        <p className="text-sm opacity-80 mt-1">
          {currentEntry && status !== 'idle' ? `Gestartet: ${formatGermanDateTime(currentEntry.start_time)}` : 'Klicke auf "Arbeitsbeginn", um einen angenehmen Tag auf der Messe zu verbringen.'}
        </p>
      </Card>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-4">
        <Button
          onClick={startWork}
          disabled={status !== 'idle'}
          className="p-6 text-lg font-bold bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
        >
          Arbeitsbeginn
        </Button>

        <Button
          onClick={() => status === 'working' ? startBreak(currentEntry) : endBreak(currentEntry)}
          disabled={status === 'idle'}
          className={`p-6 text-lg font-bold ${status === 'break' ? 'bg-secondary border-4 border-primary' : 'bg-secondary hover:bg-secondary/90'} disabled:opacity-50`}
        >
          {status === 'break' ? 'Pause beenden' : 'Pause starten'}
        </Button>

        <Button
          onClick={() => endWork(currentEntry)}
          disabled={status === 'idle'}
          className="col-span-2 p-6 text-lg font-bold !bg-[hsl(142,76%,36%)] text-white hover:!bg-[hsl(142,76%,30%)] disabled:opacity-50"
        >
          Arbeitsende
        </Button>
      </div>

      {/* Date Navigation */}
      <div className="flex items-center justify-between gap-2 border-t border-border pt-4">
        <Button
          variant="outline"
          size="icon"
          onClick={goToPreviousDay}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        
        <div className="flex items-center gap-2 flex-1 justify-center">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-xl font-semibold">
            {selectedDate.toLocaleDateString('de-DE', { 
              weekday: 'long', 
              day: '2-digit', 
              month: 'long', 
              year: 'numeric' 
            })}
          </h2>
        </div>

        <div className="flex gap-2">
          {!isToday && (
            <Button
              variant="outline"
              size="sm"
              onClick={goToToday}
            >
              Heute
            </Button>
          )}
          <Button
            variant="outline"
            size="icon"
            onClick={goToNextDay}
            disabled={isToday}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Tagesübersicht</h3>
        <div className="grid grid-cols-2 gap-4">
          <Card className="p-4 bg-primary/10 border-primary">
            <p className="text-sm opacity-80">Tagesstunden (Netto)</p>
            <h3 className="text-2xl font-extrabold mt-1">{formatMinutesToHHMM(dashboardData.todayMinutes)}</h3>
            {dashboardData.todayTargetMinutes > 0 && (
              <p className="text-xs mt-1 opacity-70">Soll: {formatMinutesToHHMM(dashboardData.todayTargetMinutes)}</p>
            )}
          </Card>

          <Card className="p-4 bg-secondary/10 border-secondary">
            <p className="text-sm opacity-80">Zuschlagsminuten</p>
            <h3 className="text-2xl font-extrabold mt-1">{formatMinutesToHHMM(dashboardData.todaySurchargeMinutes)}</h3>
            <p className="text-xs mt-1 opacity-70">
              Wert: {formatMinutesToHHMM(Math.round(dashboardData.todaySurchargeMinutes * 1.3))}
            </p>
          </Card>
        </div>

        <h2 className="text-2xl font-semibold border-t border-border pt-4">Wochen- & Monatsübersicht</h2>
        
        <div className="space-y-4">
          <Card className="p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm">Wochenstunden</span>
              <span className="font-semibold">{formatMinutesToHHMM(dashboardData.weekTotal)}</span>
            </div>
            <div className="w-full bg-muted rounded-full h-3">
              <div
                className="bg-primary h-3 rounded-full transition-all"
                style={{ width: `${Math.min(100, (dashboardData.weekTotal / TARGET_HOURS_WEEKLY) * 100)}%` }}
              />
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm">Monatsstunden</span>
              <span className="font-semibold">{formatMinutesToHHMM(dashboardData.monthTotal)}</span>
            </div>
            <div className="w-full bg-muted rounded-full h-3">
              <div
                className="bg-primary h-3 rounded-full transition-all"
                style={{ width: `${Math.min(100, (dashboardData.monthTotal / TARGET_HOURS_MONTHLY) * 100)}%` }}
              />
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Card className="p-4">
            <p className="text-sm opacity-80">Woche Überstunden</p>
            <h3 className={`text-xl font-bold ${dashboardData.weekOvertime > 0 ? 'text-primary' : 'text-muted-foreground'}`}>
              {formatMinutesToHHMM(dashboardData.weekOvertime)}
            </h3>
          </Card>

          <Card className="p-4">
            <p className="text-sm opacity-80">Monat Überstunden</p>
            <h3 className={`text-xl font-bold ${dashboardData.monthOvertime > 0 ? 'text-primary' : 'text-muted-foreground'}`}>
              {formatMinutesToHHMM(dashboardData.monthOvertime)}
            </h3>
          </Card>

          <Card className="p-4 bg-secondary/10">
            <p className="text-sm opacity-80">Woche Zuschlagsminuten</p>
            <h3 className="text-xl font-bold text-secondary">{formatMinutesToHHMM(dashboardData.weekSurchargeAmount)}</h3>
            <p className="text-xs mt-1 opacity-70">
              Wert: {formatMinutesToHHMM(Math.round(dashboardData.weekSurchargeAmount * 1.3))}
            </p>
          </Card>

          <Card className="p-4 bg-secondary/10">
            <p className="text-sm opacity-80">Monat Zuschlagsminuten</p>
            <h3 className="text-xl font-bold text-secondary">{formatMinutesToHHMM(dashboardData.monthSurchargeAmount)}</h3>
            <p className="text-xs mt-1 opacity-70">
              Wert: {formatMinutesToHHMM(Math.round(dashboardData.monthSurchargeAmount * 1.3))}
            </p>
          </Card>
        </div>
      </div>
      {/* Export Section */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">PDF Export</h2>
        <div className="flex gap-2">
          <Select value={pdfPeriod} onValueChange={(v: any) => setPdfPeriod(v)}>
            <SelectTrigger className="flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Diese Woche</SelectItem>
              <SelectItem value="month">Dieser Monat</SelectItem>
              <SelectItem value="year">Dieses Jahr</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={exportPDF} className="gap-2">
            <Download className="h-4 w-4" />
            PDF Export
          </Button>
        </div>
      </div>
    </div>
  );
};
