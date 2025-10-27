import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TimeEntry, AbsenceEntry, TARGET_HOURS_DAILY } from '@/lib/types';
import { formatMinutesToHHMM } from '@/lib/timeUtils';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface CalendarViewProps {
  timeEntries: TimeEntry[];
  absences: AbsenceEntry[];
}

interface DayData {
  date: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  timeEntry?: TimeEntry;
  absence?: AbsenceEntry;
  totalMinutes: number;
  targetMinutes: number;
}

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const MONTHS = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
];

export const CalendarView = ({ timeEntries, absences }: CalendarViewProps) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<DayData | null>(null);

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const getDaysInMonth = (): DayData[] => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    // Adjust for Monday as first day (0 = Sunday in JS, we want 1 = Monday)
    let firstDayOfWeek = firstDay.getDay();
    firstDayOfWeek = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
    
    const days: DayData[] = [];
    
    // Previous month days
    const prevMonthLastDay = new Date(year, month, 0);
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const day = prevMonthLastDay.getDate() - i;
      const date = new Date(year, month - 1, day);
      days.push(createDayData(date, false));
    }
    
    // Current month days
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const date = new Date(year, month, day);
      days.push(createDayData(date, true));
    }
    
    // Next month days to fill the grid
    const remainingDays = 42 - days.length; // 6 weeks * 7 days
    for (let day = 1; day <= remainingDays; day++) {
      const date = new Date(year, month + 1, day);
      days.push(createDayData(date, false));
    }
    
    return days;
  };

  const createDayData = (date: Date, isCurrentMonth: boolean): DayData => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    const dayOfWeek = date.getDay();
    
    const timeEntry = timeEntries.find(e => e.date === dateStr);
    const absence = absences.find(a => a.date === dateStr);
    
    const targetMinutes = TARGET_HOURS_DAILY[dayOfWeek] || 0;
    let totalMinutes = 0;
    
    if (timeEntry) {
      totalMinutes = timeEntry.net_work_duration_minutes;
    } else if (absence) {
      totalMinutes = absence.hours * 60;
    }
    
    return {
      date: dateStr,
      dayNumber: date.getDate(),
      isCurrentMonth,
      timeEntry,
      absence,
      totalMinutes,
      targetMinutes,
    };
  };

  const getDayColor = (day: DayData): string => {
    if (!day.isCurrentMonth) return 'bg-muted/30 text-muted-foreground';
    
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const isToday = day.date === todayStr;
    
    if (day.absence) {
      if (day.absence.absence_type === 'urlaub') return isToday ? 'bg-cyan-500 text-white' : 'bg-cyan-500/20 border-cyan-500';
      if (day.absence.absence_type === 'juep') return isToday ? 'bg-green-500 text-white' : 'bg-green-500/20 border-green-500';
      if (day.absence.absence_type === 'krankheit') return isToday ? 'bg-red-500 text-white' : 'bg-red-500/20 border-red-500';
    }
    
    if (day.timeEntry) {
      const isOvertime = day.totalMinutes > day.targetMinutes;
      if (isToday) return isOvertime ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground';
      return isOvertime ? 'bg-primary/20 border-primary' : 'bg-secondary/20 border-secondary';
    }
    
    if (isToday) return 'bg-accent/50 border-accent';
    return 'bg-card hover:bg-accent/20';
  };

  const days = getDaysInMonth();

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">
            {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h2>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={goToPreviousMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={goToToday}>
            Heute
          </Button>
          <Button variant="outline" size="icon" onClick={goToNextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-primary/20 border border-primary rounded" />
          <span>Arbeit (Überstunden)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-secondary/20 border border-secondary rounded" />
          <span>Arbeit (Normal)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-cyan-500/20 border border-cyan-500 rounded" />
          <span>Urlaub</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-green-500/20 border border-green-500 rounded" />
          <span>JÜP</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-red-500/20 border border-red-500 rounded" />
          <span>Krankheit</span>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1">
        {/* Weekday Headers */}
        {WEEKDAYS.map(day => (
          <div key={day} className="text-center text-xs font-semibold text-muted-foreground p-2">
            {day}
          </div>
        ))}
        
        {/* Calendar Days */}
        {days.map((day, index) => (
          <button
            key={index}
            onClick={() => (day.timeEntry || day.absence) && setSelectedDay(day)}
            className={`
              aspect-square p-1 rounded-lg border transition-all text-xs
              ${getDayColor(day)}
              ${(day.timeEntry || day.absence) ? 'cursor-pointer hover:scale-105' : 'cursor-default'}
            `}
          >
            <div className="font-semibold">{day.dayNumber}</div>
            {day.totalMinutes > 0 && (
              <div className="text-[10px] font-bold mt-0.5">
                {formatMinutesToHHMM(day.totalMinutes)}
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Day Details Dialog */}
      <Dialog open={!!selectedDay} onOpenChange={() => setSelectedDay(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedDay && (() => {
                const [year, month, day] = selectedDay.date.split('-');
                const localDate = new Date(Number(year), Number(month) - 1, Number(day));
                return localDate.toLocaleDateString('de-DE', { 
                  weekday: 'long', 
                  day: '2-digit', 
                  month: 'long', 
                  year: 'numeric' 
                });
              })()}
            </DialogTitle>
          </DialogHeader>
          {selectedDay && (
            <div className="space-y-4">
              {selectedDay.timeEntry && (
                <Card className="p-4">
                  <h3 className="font-bold mb-2">Arbeitszeit</h3>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Start:</span>
                      <span>{selectedDay.timeEntry.start_time.split('T')[1]?.substring(0, 5) || '00:00'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Ende:</span>
                      <span>{selectedDay.timeEntry.end_time.split('T')[1]?.substring(0, 5) || '00:00'}</span>
                    </div>
                    <div className="flex justify-between font-bold">
                      <span>Arbeitszeit (Netto):</span>
                      <span>{formatMinutesToHHMM(selectedDay.timeEntry.net_work_duration_minutes)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Pausenzeit:</span>
                      <span>{formatMinutesToHHMM(Math.round(selectedDay.timeEntry.total_break_duration_ms / (1000 * 60)))}</span>
                    </div>
                    {selectedDay.timeEntry.is_surcharge_day && (
                      <div className="mt-2 pt-2 border-t">
                        <div className="flex justify-between text-secondary font-semibold">
                          <span>{selectedDay.timeEntry.surcharge_label}:</span>
                          <span>{formatMinutesToHHMM(selectedDay.timeEntry.surcharge_amount)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              )}
              {selectedDay.absence && (
                <Card className="p-4">
                  <h3 className="font-bold mb-2">Abwesenheit</h3>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Typ:</span>
                      <span className="capitalize">{selectedDay.absence.absence_type === 'juep' ? 'JÜP' : selectedDay.absence.absence_type}</span>
                    </div>
                    <div className="flex justify-between font-bold">
                      <span>Stunden:</span>
                      <span>{selectedDay.absence.hours}h</span>
                    </div>
                    {selectedDay.absence.note && (
                      <div className="mt-2 pt-2 border-t">
                        <p className="italic text-muted-foreground">{selectedDay.absence.note}</p>
                      </div>
                    )}
                  </div>
                </Card>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
