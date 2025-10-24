import { useState, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CurrentEntry, TimeEntry, TARGET_HOURS_DAILY, TARGET_HOURS_WEEKLY, TARGET_HOURS_MONTHLY } from '@/lib/types';
import { formatMinutesToHHMM, formatGermanDateTime, calculateNetWorkDuration } from '@/lib/timeUtils';
import { useWorkActions } from '@/hooks/useWorkActions';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { toast } from 'sonner';

interface DashboardProps {
  currentEntry: CurrentEntry | null;
  timeEntries: TimeEntry[];
  status: 'idle' | 'working' | 'break';
  userId: string;
  customHolidays: string[];
}

export const Dashboard = ({ currentEntry, timeEntries, status, userId, customHolidays }: DashboardProps) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const { startWork, startBreak, endBreak, endWork } = useWorkActions(userId, customHolidays);

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

  const dashboardData = useMemo(() => {
    const now = currentTime;
    const todayDateStr = now.toISOString().substring(0, 10);
    const currentMonthStr = now.toISOString().substring(0, 7);
    
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - (weekStart.getDay() || 7) + 1);
    weekStart.setHours(0, 0, 0, 0);

    let todayMinutes = liveMinutes;
    let todaySurchargeMinutes = 0;
    let weekTotalMinutes = liveMinutes;
    let weekSurchargeAmount = 0;
    let monthTotalMinutes = liveMinutes;
    let monthSurchargeAmount = 0;

    timeEntries.forEach(entry => {
      if (entry.date === todayDateStr) {
        todayMinutes += entry.net_work_duration_minutes;
        todaySurchargeMinutes += entry.surcharge_minutes;
      }

      const entryDate = new Date(entry.start_time);
      if (entryDate >= weekStart) {
        weekTotalMinutes += entry.net_work_duration_minutes;
        weekSurchargeAmount += entry.surcharge_amount;
      }
      if (entry.date.startsWith(currentMonthStr)) {
        monthTotalMinutes += entry.net_work_duration_minutes;
        monthSurchargeAmount += entry.surcharge_amount;
      }
    });

    const todayDayOfWeek = now.getDay();
    const todayTargetMinutes = TARGET_HOURS_DAILY[todayDayOfWeek] || 0;

    return {
      todayMinutes,
      todaySurchargeMinutes,
      todayTargetMinutes,
      weekTotal: weekTotalMinutes,
      weekOvertime: weekTotalMinutes - TARGET_HOURS_WEEKLY,
      weekSurchargeAmount,
      monthTotal: monthTotalMinutes,
      monthOvertime: monthTotalMinutes - TARGET_HOURS_MONTHLY,
      monthSurchargeAmount,
    };
  }, [currentTime, timeEntries, liveMinutes]);

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
    const element = document.getElementById('report-container');
    if (!element) return;

    try {
      toast.info('PDF wird erstellt...');
      const canvas = await html2canvas(element, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Arbeitszeitbericht_${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success('PDF erfolgreich exportiert!');
    } catch (error) {
      toast.error('Fehler beim Exportieren des PDFs');
    }
  };

  return (
    <div id="report-container" className="space-y-6">
      {/* Status Card */}
      <Card className={`p-4 ${getStatusCardClass()} border-2 shadow-lg transition-all`}>
        <h2 className="text-xl font-bold">{getStatusText()}</h2>
        <p className="text-sm opacity-80 mt-1">
          {currentEntry && status !== 'idle' ? `Gestartet: ${formatGermanDateTime(currentEntry.start_time)}` : 'Klicke auf "Arbeitsbeginn", um den Tag zu starten.'}
        </p>
      </Card>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-4">
        <Button
          onClick={startWork}
          disabled={status !== 'idle'}
          className="p-6 text-lg font-bold bg-primary hover:bg-primary/90 disabled:opacity-50"
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
          className="col-span-2 p-6 text-lg font-bold bg-destructive hover:bg-destructive/90 disabled:opacity-50"
        >
          Arbeitsende
        </Button>
      </div>

      {/* Stats */}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold border-t border-border pt-4">Heutige Übersicht</h2>
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
            <p className="text-sm opacity-80">Woche Zuschlagswert</p>
            <h3 className="text-xl font-bold text-secondary">{formatMinutesToHHMM(dashboardData.weekSurchargeAmount)}</h3>
          </Card>

          <Card className="p-4 bg-secondary/10">
            <p className="text-sm opacity-80">Monat Zuschlagswert</p>
            <h3 className="text-xl font-bold text-secondary">{formatMinutesToHHMM(dashboardData.monthSurchargeAmount)}</h3>
          </Card>
        </div>
      </div>

      <Button onClick={exportPDF} className="w-full bg-green-600 hover:bg-green-700">
        Arbeitszeitbericht als PDF exportieren
      </Button>
    </div>
  );
};
