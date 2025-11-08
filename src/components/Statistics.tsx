import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TimeEntry, AbsenceEntry, TARGET_HOURS_DAILY } from '@/lib/types';
import { formatMinutesToHHMM } from '@/lib/timeUtils';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrendingUp, TrendingDown, Minus, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

interface StatisticsProps {
  timeEntries: TimeEntry[];
  absences: AbsenceEntry[];
}

const COLORS = {
  primary: 'hsl(var(--primary))',
  secondary: 'hsl(var(--secondary))',
  accent: 'hsl(var(--accent))',
  blue: '#3b82f6',
  green: '#10b981',
  red: '#ef4444',
  yellow: '#f59e0b',
};

export const Statistics = ({ timeEntries, absences }: StatisticsProps) => {
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'year'>('month');
  const [comparisonMode, setComparisonMode] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());

  const goToPrevious = () => {
    const newDate = new Date(selectedDate);
    if (timeRange === 'week') {
      newDate.setDate(newDate.getDate() - 7);
    } else if (timeRange === 'month') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setFullYear(newDate.getFullYear() - 1);
    }
    setSelectedDate(newDate);
  };

  const goToNext = () => {
    const newDate = new Date(selectedDate);
    if (timeRange === 'week') {
      newDate.setDate(newDate.getDate() + 7);
    } else if (timeRange === 'month') {
      newDate.setMonth(newDate.getMonth() + 1);
    } else {
      newDate.setFullYear(newDate.getFullYear() + 1);
    }
    // Nicht in die Zukunft navigieren
    if (newDate <= new Date()) {
      setSelectedDate(newDate);
    }
  };

  const goToCurrent = () => {
    setSelectedDate(new Date());
  };

  const getPeriodLabel = () => {
    if (timeRange === 'week') {
      const weekStart = new Date(selectedDate);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      return `${weekStart.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })} - ${weekEnd.toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' })}`;
    } else if (timeRange === 'month') {
      return selectedDate.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
    } else {
      return selectedDate.getFullYear().toString();
    }
  };

  const isCurrentPeriod = () => {
    const now = new Date();
    if (timeRange === 'week') {
      const weekStart = new Date(selectedDate);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
      const nowWeekStart = new Date(now);
      nowWeekStart.setDate(nowWeekStart.getDate() - nowWeekStart.getDay() + 1);
      return weekStart.toISOString().split('T')[0] === nowWeekStart.toISOString().split('T')[0];
    } else if (timeRange === 'month') {
      return selectedDate.getMonth() === now.getMonth() && selectedDate.getFullYear() === now.getFullYear();
    } else {
      return selectedDate.getFullYear() === now.getFullYear();
    }
  };

  // Get comparison data for previous period
  const getComparisonStats = (entries: TimeEntry[], currentStart: Date) => {
    let prevStart: Date;
    let prevEnd: Date = new Date(currentStart);
    prevEnd.setMilliseconds(prevEnd.getMilliseconds() - 1);

    if (timeRange === 'week') {
      prevStart = new Date(currentStart);
      prevStart.setDate(prevStart.getDate() - 7);
    } else if (timeRange === 'month') {
      prevStart = new Date(currentStart);
      prevStart.setMonth(prevStart.getMonth() - 1);
    } else {
      prevStart = new Date(currentStart);
      prevStart.setFullYear(prevStart.getFullYear() - 1);
    }

    const prevEntries = entries.filter(e => {
      const date = new Date(e.start_time);
      return date >= prevStart && date <= prevEnd;
    });

    const prevHours = prevEntries.reduce((sum, e) => sum + e.net_work_duration_minutes, 0) / 60;
    const prevOvertime = prevEntries.reduce((sum, e) => {
      const dayOfWeek = new Date(e.start_time).getDay();
      const targetForDay = TARGET_HOURS_DAILY[dayOfWeek] || 0;
      const isWeekendOrHoliday = dayOfWeek === 0 || dayOfWeek === 6 || e.is_surcharge_day;
      
      if (isWeekendOrHoliday) {
        return sum + e.net_work_duration_minutes;
      }
      return sum + Math.max(0, e.net_work_duration_minutes - targetForDay);
    }, 0) / 60;

    return { prevHours, prevOvertime, prevWorkDays: prevEntries.length };
  };

  // Get monthly trend data for the last 6 months
  const getMonthlyTrends = () => {
    const now = new Date();
    const trends = [];
    
    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      
      const monthEntries = timeEntries.filter(e => {
        const date = new Date(e.start_time);
        return date >= monthStart && date <= monthEnd;
      });

      const monthAbsences = absences.filter(a => {
        const [year, month, day] = a.date.split('-');
        const absenceDate = new Date(Number(year), Number(month) - 1, Number(day));
        return absenceDate >= monthStart && absenceDate <= monthEnd;
      });

      const hours = monthEntries.reduce((sum, e) => sum + e.net_work_duration_minutes, 0) / 60;
      const overtime = monthEntries.reduce((sum, e) => {
        const dayOfWeek = new Date(e.start_time).getDay();
        const targetForDay = TARGET_HOURS_DAILY[dayOfWeek] || 0;
        const isWeekendOrHoliday = dayOfWeek === 0 || dayOfWeek === 6 || e.is_surcharge_day;
        
        if (isWeekendOrHoliday) {
          return sum + e.net_work_duration_minutes;
        }
        return sum + Math.max(0, e.net_work_duration_minutes - targetForDay);
      }, 0) / 60;

      const absenceHours = monthAbsences.reduce((sum, a) => sum + a.hours, 0);

      trends.push({
        month: monthStart.toLocaleDateString('de-DE', { month: 'short', year: '2-digit' }),
        hours: parseFloat(hours.toFixed(1)),
        overtime: parseFloat(overtime.toFixed(1)),
        absences: parseFloat(absenceHours.toFixed(1)),
        workDays: monthEntries.length,
      });
    }
    
    return trends;
  };

  const stats = useMemo(() => {
    let startDate: Date;
    let endDate: Date;

    if (timeRange === 'week') {
      // Wochenstart: Montag 00:01 Uhr
      startDate = new Date(selectedDate);
      startDate.setDate(startDate.getDate() - startDate.getDay() + 1);
      startDate.setHours(0, 1, 0, 0);
      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 6);
      endDate.setHours(23, 59, 59, 999);
    } else if (timeRange === 'month') {
      // Monatsstart: 1. des Monats 00:01 Uhr
      startDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1, 0, 1, 0, 0);
      endDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0, 23, 59, 59, 999);
    } else {
      // Jahresstart: 1. Januar 00:01 Uhr
      startDate = new Date(selectedDate.getFullYear(), 0, 1, 0, 1, 0, 0);
      endDate = new Date(selectedDate.getFullYear(), 11, 31, 23, 59, 59, 999);
    }

    const filteredEntries = timeEntries.filter(e => {
      const entryDate = new Date(e.start_time);
      return entryDate >= startDate && entryDate <= endDate;
    });
    const filteredAbsences = absences.filter(a => {
      const [year, month, day] = a.date.split('-');
      const absenceDate = new Date(Number(year), Number(month) - 1, Number(day));
      return absenceDate >= startDate && absenceDate <= endDate;
    });

    // Weekly hours data
    const weeklyData: Record<string, { week: string; hours: number; overtime: number; target: number }> = {};
    
    filteredEntries.forEach(entry => {
      const date = new Date(entry.start_time);
      // Wochenstart: Montag 00:01 Uhr
      const weekStart = new Date(date);
      weekStart.setDate(weekStart.getDate() - (weekStart.getDay() || 7) + 1);
      weekStart.setHours(0, 1, 0, 0);
      const weekKey = weekStart.toISOString().split('T')[0];
      
      if (!weeklyData[weekKey]) {
        weeklyData[weekKey] = { 
          week: `KW ${Math.ceil((date.getDate() + new Date(date.getFullYear(), date.getMonth(), 1).getDay()) / 7)}`,
          hours: 0, 
          overtime: 0,
          target: 0
        };
      }
      
      const dayOfWeek = date.getDay();
      const targetForDay = TARGET_HOURS_DAILY[dayOfWeek] || 0;
      const isWeekendOrHoliday = dayOfWeek === 0 || dayOfWeek === 6 || entry.is_surcharge_day;
      
      weeklyData[weekKey].hours += entry.net_work_duration_minutes / 60;
      weeklyData[weekKey].target += targetForDay / 60;
      
      if (isWeekendOrHoliday) {
        weeklyData[weekKey].overtime += entry.net_work_duration_minutes / 60;
      } else {
        weeklyData[weekKey].overtime += Math.max(0, (entry.net_work_duration_minutes - targetForDay) / 60);
      }
    });

    // Overtime trend
    const overtimeData = Object.entries(weeklyData).map(([_, data]) => ({
      week: data.week,
      overtime: parseFloat(data.overtime.toFixed(1)),
    }));

    // Surcharge distribution
    const surchargeData = [
      { name: 'Samstag', value: 0, color: COLORS.blue },
      { name: 'Sonntag', value: 0, color: COLORS.accent },
      { name: 'Feiertag', value: 0, color: COLORS.yellow },
      { name: 'Überstunden', value: 0, color: COLORS.green },
    ];

    filteredEntries.forEach(entry => {
      const dayOfWeek = new Date(entry.start_time).getDay();
      if (entry.surcharge_label.includes('Samstag')) {
        surchargeData[0].value += entry.surcharge_amount;
      } else if (entry.surcharge_label.includes('Sonntag')) {
        surchargeData[1].value += entry.surcharge_amount;
      } else if (entry.surcharge_label.includes('Feiertag')) {
        surchargeData[2].value += entry.surcharge_amount;
      } else if (entry.surcharge_label.includes('Überstunden')) {
        surchargeData[3].value += entry.surcharge_amount;
      }
    });

    // Absence distribution
    const absenceData = [
      { name: 'Urlaub', value: 0, color: COLORS.blue },
      { name: 'JÜP', value: 0, color: COLORS.green },
      { name: 'Krankheit', value: 0, color: COLORS.red },
    ];

    filteredAbsences.forEach(absence => {
      if (absence.absence_type === 'urlaub') absenceData[0].value += absence.hours;
      if (absence.absence_type === 'juep') absenceData[1].value += absence.hours;
      if (absence.absence_type === 'krankheit') absenceData[2].value += absence.hours;
    });

    // Totals
    const totalHours = filteredEntries.reduce((sum, e) => sum + e.net_work_duration_minutes, 0) / 60;
    const totalOvertime = filteredEntries.reduce((sum, e) => {
      const dayOfWeek = new Date(e.start_time).getDay();
      const targetForDay = TARGET_HOURS_DAILY[dayOfWeek] || 0;
      const isWeekendOrHoliday = dayOfWeek === 0 || dayOfWeek === 6 || e.is_surcharge_day;
      
      if (isWeekendOrHoliday) {
        return sum + e.net_work_duration_minutes;
      }
      return sum + Math.max(0, e.net_work_duration_minutes - targetForDay);
    }, 0) / 60;
    
    const totalSurcharge = filteredEntries.reduce((sum, e) => sum + e.surcharge_amount, 0) / 60;
    const totalAbsences = filteredAbsences.reduce((sum, a) => sum + a.hours, 0);
    const avgDailyHours = totalHours / Math.max(1, filteredEntries.length);

    // Comparison data
    const comparison = getComparisonStats(timeEntries, startDate);
    const monthlyTrends = getMonthlyTrends();

    // Calculate trend indicators
    const hoursTrend = comparison.prevHours > 0 ? ((totalHours - comparison.prevHours) / comparison.prevHours) * 100 : 0;
    const overtimeTrend = comparison.prevOvertime > 0 ? ((totalOvertime - comparison.prevOvertime) / comparison.prevOvertime) * 100 : 0;

    return {
      weeklyData: Object.values(weeklyData),
      overtimeData,
      surchargeData: surchargeData.filter(d => d.value > 0),
      absenceData: absenceData.filter(d => d.value > 0),
      totalHours,
      totalOvertime,
      totalSurcharge,
      totalAbsences,
      avgDailyHours,
      workDays: filteredEntries.length,
      comparison,
      monthlyTrends,
      hoursTrend,
      overtimeTrend,
    };
  }, [timeEntries, absences, timeRange, selectedDate]);

  const getTrendIcon = (trend: number) => {
    if (trend > 5) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (trend < -5) return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <div className="space-y-6">
      {/* Header with Navigation */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Statistiken</h2>
          <Select value={timeRange} onValueChange={(v: any) => { setTimeRange(v); setSelectedDate(new Date()); }}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Woche</SelectItem>
              <SelectItem value="month">Monat</SelectItem>
              <SelectItem value="year">Jahr</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {/* Period Navigation */}
        <div className="flex items-center justify-between bg-card p-3 rounded-lg border">
          <Button variant="outline" size="icon" onClick={goToPrevious}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold">{getPeriodLabel()}</span>
          </div>
          <div className="flex gap-2">
            {!isCurrentPeriod() && (
              <Button variant="outline" size="sm" onClick={goToCurrent}>
                Aktuell
              </Button>
            )}
            <Button 
              variant="outline" 
              size="icon" 
              onClick={goToNext}
              disabled={isCurrentPeriod()}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Summary Cards with Trends */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Gesamt Stunden</p>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-bold text-primary">{stats.totalHours.toFixed(1)}h</p>
            {getTrendIcon(stats.hoursTrend)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Ø {stats.avgDailyHours.toFixed(1)}h/Tag
          </p>
          {comparisonMode && (
            <p className="text-xs text-muted-foreground mt-1">
              Vorher: {stats.comparison.prevHours.toFixed(1)}h ({stats.hoursTrend > 0 ? '+' : ''}{stats.hoursTrend.toFixed(1)}%)
            </p>
          )}
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Überstunden</p>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-bold text-secondary">{stats.totalOvertime.toFixed(1)}h</p>
            {getTrendIcon(stats.overtimeTrend)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {stats.workDays} Arbeitstage
          </p>
          {comparisonMode && (
            <p className="text-xs text-muted-foreground mt-1">
              Vorher: {stats.comparison.prevOvertime.toFixed(1)}h ({stats.overtimeTrend > 0 ? '+' : ''}{stats.overtimeTrend.toFixed(1)}%)
            </p>
          )}
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Zuschläge</p>
          <p className="text-2xl font-bold text-accent">{stats.totalSurcharge.toFixed(1)}h</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Abwesenheiten</p>
          <p className="text-2xl font-bold text-blue-500">{stats.totalAbsences.toFixed(1)}h</p>
        </Card>
      </div>

      {/* Monthly Trends Chart */}
      {stats.monthlyTrends.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold">6-Monats-Trend</h3>
            <Calendar className="h-5 w-5 text-muted-foreground" />
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={stats.monthlyTrends}>
              <defs>
                <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorOvertime" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.accent} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={COLORS.accent} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
              <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
              <YAxis stroke="hsl(var(--muted-foreground))" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))', 
                  border: '1px solid hsl(var(--border))' 
                }}
              />
              <Legend />
              <Area 
                type="monotone" 
                dataKey="hours" 
                name="Stunden" 
                stroke={COLORS.primary} 
                fillOpacity={1}
                fill="url(#colorHours)"
                strokeWidth={2}
              />
              <Area 
                type="monotone" 
                dataKey="overtime" 
                name="Überstunden" 
                stroke={COLORS.accent} 
                fillOpacity={1}
                fill="url(#colorOvertime)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Weekly Hours Chart */}
      {stats.weeklyData.length > 0 && (
        <Card className="p-4">
          <h3 className="text-lg font-bold mb-4">Wochenstunden</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={stats.weeklyData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
              <XAxis dataKey="week" stroke="hsl(var(--muted-foreground))" />
              <YAxis stroke="hsl(var(--muted-foreground))" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))', 
                  border: '1px solid hsl(var(--border))' 
                }}
              />
              <Legend />
              <Bar dataKey="target" name="Soll" fill={COLORS.secondary} opacity={0.3} />
              <Bar dataKey="hours" name="Ist" fill={COLORS.primary} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Overtime Trend */}
      {stats.overtimeData.length > 0 && (
        <Card className="p-4">
          <h3 className="text-lg font-bold mb-4">Überstunden Verlauf</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={stats.overtimeData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
              <XAxis dataKey="week" stroke="hsl(var(--muted-foreground))" />
              <YAxis stroke="hsl(var(--muted-foreground))" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))', 
                  border: '1px solid hsl(var(--border))' 
                }}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="overtime" 
                name="Überstunden" 
                stroke={COLORS.accent} 
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Pie Charts */}
      <div className="grid md:grid-cols-2 gap-4">
        {stats.surchargeData.length > 0 && (
          <Card className="p-4">
            <h3 className="text-lg font-bold mb-4">Zuschlagsverteilung</h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={stats.surchargeData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: ${entry.value.toFixed(0)}min`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {stats.surchargeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        )}

        {stats.absenceData.length > 0 && (
          <Card className="p-4">
            <h3 className="text-lg font-bold mb-4">Abwesenheitsverteilung</h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={stats.absenceData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: ${entry.value.toFixed(1)}h`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {stats.absenceData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        )}
      </div>
    </div>
  );
};
