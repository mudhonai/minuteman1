import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { TimeEntry, AbsenceEntry, TARGET_HOURS_DAILY } from '@/lib/types';
import { formatMinutesToHHMM } from '@/lib/timeUtils';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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

  const stats = useMemo(() => {
    const now = new Date();
    let startDate: Date;

    if (timeRange === 'week') {
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - startDate.getDay() + 1);
      startDate.setHours(0, 0, 0, 0);
    } else if (timeRange === 'month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else {
      startDate = new Date(now.getFullYear(), 0, 1);
    }

    const filteredEntries = timeEntries.filter(e => new Date(e.start_time) >= startDate);
    const filteredAbsences = absences.filter(a => {
      const [year, month, day] = a.date.split('-');
      const absenceDate = new Date(Number(year), Number(month) - 1, Number(day));
      return absenceDate >= startDate;
    });

    // Weekly hours data
    const weeklyData: Record<string, { week: string; hours: number; overtime: number; target: number }> = {};
    
    filteredEntries.forEach(entry => {
      const date = new Date(entry.start_time);
      const weekStart = new Date(date);
      weekStart.setDate(weekStart.getDate() - (weekStart.getDay() || 7) + 1);
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
    };
  }, [timeEntries, absences, timeRange]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Statistiken</h2>
        <Select value={timeRange} onValueChange={(v: any) => setTimeRange(v)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="week">Diese Woche</SelectItem>
            <SelectItem value="month">Dieser Monat</SelectItem>
            <SelectItem value="year">Dieses Jahr</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Gesamt Stunden</p>
          <p className="text-2xl font-bold text-primary">{stats.totalHours.toFixed(1)}h</p>
          <p className="text-xs text-muted-foreground mt-1">
            Ø {stats.avgDailyHours.toFixed(1)}h/Tag
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Überstunden</p>
          <p className="text-2xl font-bold text-secondary">{stats.totalOvertime.toFixed(1)}h</p>
          <p className="text-xs text-muted-foreground mt-1">
            {stats.workDays} Arbeitstage
          </p>
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
