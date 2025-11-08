import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TimeEntry, TARGET_HOURS_DAILY } from '@/lib/types';
import { formatMinutesToHHMM } from '@/lib/timeUtils';
import { TrendingUp, Calendar, CalendarDays, ChevronDown, ChevronRight } from 'lucide-react';
import { startOfWeek, startOfMonth, startOfYear, endOfWeek, format, isSameWeek } from 'date-fns';
import { de } from 'date-fns/locale';
import { useState } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface OvertimeSummaryProps {
  timeEntries: TimeEntry[];
}

export const OvertimeSummary = ({ timeEntries }: OvertimeSummaryProps) => {
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set());

  const toggleWeek = (weekKey: string) => {
    setExpandedWeeks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(weekKey)) {
        newSet.delete(weekKey);
      } else {
        newSet.add(weekKey);
      }
      return newSet;
    });
  };

  // Verwende die korrigierten Werte aus der Datenbank
  const calculateOvertime = (entry: TimeEntry) => {
    // surcharge_minutes = rohe Überstunden (ohne Zuschlagsfaktor)
    return entry.surcharge_minutes;
  };

  // Gruppiere nach Woche mit Tagen
  const weeklyData = timeEntries.reduce((acc, entry) => {
    const date = new Date(entry.start_time);
    const weekStart = startOfWeek(date, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(date, { weekStartsOn: 1 });
    const weekKey = format(weekStart, 'yyyy-ww', { locale: de });
    const weekLabel = format(weekStart, "'KW' ww, yyyy", { locale: de });
    const dateRange = `${format(weekStart, 'dd.MM.')} - ${format(weekEnd, 'dd.MM.yyyy')}`;
    
    if (!acc[weekKey]) {
      acc[weekKey] = { 
        label: weekLabel, 
        dateRange, 
        minutes: 0, 
        date: weekStart,
        entries: []
      };
    }
    acc[weekKey].minutes += calculateOvertime(entry);
    acc[weekKey].entries.push(entry);
    return acc;
  }, {} as Record<string, { label: string; dateRange: string; minutes: number; date: Date; entries: TimeEntry[] }>);

  // Gruppiere nach Monat
  const monthlyOvertime = timeEntries.reduce((acc, entry) => {
    const date = new Date(entry.start_time);
    const monthStart = startOfMonth(date);
    const monthKey = format(monthStart, 'yyyy-MM');
    const monthLabel = format(monthStart, 'MMMM yyyy', { locale: de });
    
    if (!acc[monthKey]) {
      acc[monthKey] = { label: monthLabel, minutes: 0, totalWithSurcharge: 0, date: monthStart };
    }
    const overtimeMinutes = calculateOvertime(entry);
    acc[monthKey].minutes += overtimeMinutes;
    // surcharge_amount enthält bereits die Gesamtzeit inkl. Zuschlag
    acc[monthKey].totalWithSurcharge += entry.surcharge_amount;
    return acc;
  }, {} as Record<string, { label: string; minutes: number; totalWithSurcharge: number; date: Date }>);

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
  const sortedWeeks = Object.entries(weeklyData).sort((a, b) => b[1].date.getTime() - a[1].date.getTime());
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
            sortedWeeks.map(([weekKey, week]) => (
              <Collapsible key={weekKey} open={expandedWeeks.has(weekKey)} onOpenChange={() => toggleWeek(weekKey)}>
                <div className="bg-muted/50 rounded-lg">
                  <CollapsibleTrigger className="w-full p-3 flex justify-between items-center hover:bg-muted/70 transition-colors rounded-lg">
                    <div className="flex flex-col gap-1 text-left">
                      <div className="flex items-center gap-2">
                        {expandedWeeks.has(weekKey) ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{week.label}</span>
                      </div>
                      <span className="text-xs text-muted-foreground ml-12">{week.dateRange}</span>
                    </div>
                    <span className={`font-bold ${week.minutes >= 0 ? 'text-primary' : 'text-destructive'}`}>
                      {week.minutes >= 0 ? '+' : ''}{formatMinutesToHHMM(week.minutes)}
                    </span>
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent className="px-3 pb-3">
                    <div className="mt-2 space-y-1 border-t border-border/50 pt-2">
                      {week.entries.map((entry) => {
                        const entryDate = new Date(entry.start_time);
                        const dayOfWeek = entryDate.getDay();
                        const targetMinutes = TARGET_HOURS_DAILY[dayOfWeek] || 0;
                        const overtimeMinutes = calculateOvertime(entry);
                        const totalWithSurcharge = entry.surcharge_amount;
                        
                        return (
                          <div key={entry.id} className="bg-background/50 rounded p-2 text-sm">
                            <div className="flex justify-between items-start mb-2">
                              <div className="font-medium">
                                {format(entryDate, 'EEEE, dd.MM.yyyy', { locale: de })}
                              </div>
                              {entry.surcharge_label !== 'Regulär' && (
                                <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">
                                  {entry.surcharge_label}
                                </span>
                              )}
                            </div>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Soll:</span>
                                <span>{formatMinutesToHHMM(targetMinutes)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Geleistet:</span>
                                <span className="font-medium">{formatMinutesToHHMM(entry.net_work_duration_minutes)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Überstunden:</span>
                                <span className={overtimeMinutes > 0 ? 'text-primary font-medium' : ''}>
                                  {overtimeMinutes > 0 ? '+' : ''}{formatMinutesToHHMM(overtimeMinutes)}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Zuschläge:</span>
                                <span className={entry.surcharge_minutes > 0 ? 'text-accent font-medium' : ''}>
                                  {entry.surcharge_minutes > 0 ? '+' : ''}{formatMinutesToHHMM(entry.surcharge_minutes)}
                                </span>
                              </div>
                              <div className="flex justify-between col-span-2 pt-1 border-t border-border/30 mt-1">
                                <span className="text-muted-foreground font-medium">Gesamt:</span>
                                <span className={`font-bold ${totalWithSurcharge > 0 ? 'text-primary' : ''}`}>
                                  {totalWithSurcharge > 0 ? '+' : ''}{formatMinutesToHHMM(totalWithSurcharge)}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            ))
          )}
        </TabsContent>
        
        <TabsContent value="month" className="space-y-2 mt-4">
          {sortedMonths.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Keine Daten verfügbar</p>
          ) : (
            sortedMonths.map((month) => (
              <div key={month.label} className="p-3 bg-muted/50 rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{month.label}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Überstunden:</span>
                    <span className={`font-bold ${month.minutes >= 0 ? 'text-primary' : 'text-destructive'}`}>
                      {month.minutes >= 0 ? '+' : ''}{formatMinutesToHHMM(month.minutes)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Mit Zuschlägen:</span>
                    <span className={`font-bold ${month.totalWithSurcharge >= 0 ? 'text-primary' : 'text-destructive'}`}>
                      {month.totalWithSurcharge >= 0 ? '+' : ''}{formatMinutesToHHMM(month.totalWithSurcharge)}
                    </span>
                  </div>
                </div>
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
