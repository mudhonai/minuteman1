import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TimeEntry, TARGET_HOURS_DAILY } from '@/lib/types';
import { formatMinutesToHHMM } from '@/lib/timeUtils';
import { TrendingUp, Calendar, CalendarDays } from 'lucide-react';
import { startOfWeek, startOfMonth, startOfYear, format } from 'date-fns';
import { de } from 'date-fns/locale';

interface OvertimeSummaryProps {
  timeEntries: TimeEntry[];
}

export const OvertimeSummary = ({ timeEntries }: OvertimeSummaryProps) => {
  // Berechne Überstunden pro Eintrag
  const calculateOvertime = (entry: TimeEntry) => {
    const entryDate = new Date(entry.start_time);
    const dayOfWeek = entryDate.getDay();
    const targetMinutes = TARGET_HOURS_DAILY[dayOfWeek] || 0;
    const isWeekendOrHoliday = dayOfWeek === 0 || dayOfWeek === 6 || entry.is_surcharge_day;
    
    if (isWeekendOrHoliday) {
      return entry.net_work_duration_minutes;
    } else {
      return Math.max(0, entry.net_work_duration_minutes - targetMinutes);
    }
  };

  // Gruppiere nach Woche
  const weeklyOvertime = timeEntries.reduce((acc, entry) => {
    const date = new Date(entry.start_time);
    const weekStart = startOfWeek(date, { weekStartsOn: 1 });
    const weekKey = format(weekStart, 'yyyy-ww', { locale: de });
    const weekLabel = format(weekStart, "'KW' ww, yyyy", { locale: de });
    
    if (!acc[weekKey]) {
      acc[weekKey] = { label: weekLabel, minutes: 0, date: weekStart };
    }
    acc[weekKey].minutes += calculateOvertime(entry);
    return acc;
  }, {} as Record<string, { label: string; minutes: number; date: Date }>);

  // Gruppiere nach Monat
  const monthlyOvertime = timeEntries.reduce((acc, entry) => {
    const date = new Date(entry.start_time);
    const monthStart = startOfMonth(date);
    const monthKey = format(monthStart, 'yyyy-MM');
    const monthLabel = format(monthStart, 'MMMM yyyy', { locale: de });
    
    if (!acc[monthKey]) {
      acc[monthKey] = { label: monthLabel, minutes: 0, date: monthStart };
    }
    acc[monthKey].minutes += calculateOvertime(entry);
    return acc;
  }, {} as Record<string, { label: string; minutes: number; date: Date }>);

  // Gruppiere nach Jahr
  const yearlyOvertime = timeEntries.reduce((acc, entry) => {
    const date = new Date(entry.start_time);
    const yearStart = startOfYear(date);
    const yearKey = format(yearStart, 'yyyy');
    
    if (!acc[yearKey]) {
      acc[yearKey] = { label: yearKey, minutes: 0, date: yearStart };
    }
    acc[yearKey].minutes += calculateOvertime(entry);
    return acc;
  }, {} as Record<string, { label: string; minutes: number; date: Date }>);

  // Sortiere nach Datum (neueste zuerst)
  const sortedWeeks = Object.values(weeklyOvertime).sort((a, b) => b.date.getTime() - a.date.getTime());
  const sortedMonths = Object.values(monthlyOvertime).sort((a, b) => b.date.getTime() - a.date.getTime());
  const sortedYears = Object.values(yearlyOvertime).sort((a, b) => b.date.getTime() - a.date.getTime());

  return (
    <Card className="p-4 mb-4">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-bold">Überstunden-Übersicht</h2>
      </div>
      
      <Tabs defaultValue="month" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="week">Woche</TabsTrigger>
          <TabsTrigger value="month">Monat</TabsTrigger>
          <TabsTrigger value="year">Jahr</TabsTrigger>
        </TabsList>
        
        <TabsContent value="week" className="space-y-2 mt-4">
          {sortedWeeks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Keine Daten verfügbar</p>
          ) : (
            sortedWeeks.map((week) => (
              <div key={week.label} className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{week.label}</span>
                </div>
                <span className={`font-bold ${week.minutes >= 0 ? 'text-primary' : 'text-destructive'}`}>
                  {week.minutes >= 0 ? '+' : ''}{formatMinutesToHHMM(week.minutes)}
                </span>
              </div>
            ))
          )}
        </TabsContent>
        
        <TabsContent value="month" className="space-y-2 mt-4">
          {sortedMonths.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Keine Daten verfügbar</p>
          ) : (
            sortedMonths.map((month) => (
              <div key={month.label} className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{month.label}</span>
                </div>
                <span className={`font-bold ${month.minutes >= 0 ? 'text-primary' : 'text-destructive'}`}>
                  {month.minutes >= 0 ? '+' : ''}{formatMinutesToHHMM(month.minutes)}
                </span>
              </div>
            ))
          )}
        </TabsContent>
        
        <TabsContent value="year" className="space-y-2 mt-4">
          {sortedYears.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Keine Daten verfügbar</p>
          ) : (
            sortedYears.map((year) => (
              <div key={year.label} className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{year.label}</span>
                </div>
                <span className={`font-bold text-lg ${year.minutes >= 0 ? 'text-primary' : 'text-destructive'}`}>
                  {year.minutes >= 0 ? '+' : ''}{formatMinutesToHHMM(year.minutes)}
                </span>
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>
    </Card>
  );
};
