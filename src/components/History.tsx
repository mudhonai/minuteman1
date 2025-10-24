import { Card } from '@/components/ui/card';
import { TimeEntry } from '@/lib/types';
import { formatMinutesToHHMM, formatGermanDateTime, formatDateForHistory } from '@/lib/timeUtils';

interface HistoryProps {
  timeEntries: TimeEntry[];
}

export const History = ({ timeEntries }: HistoryProps) => {
  if (timeEntries.length === 0) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Du hast noch keine abgeschlossenen Zeiteinträge.</p>
        <p className="text-muted-foreground/70 mt-2 text-sm">
          Schließe einen Arbeitstag über das Dashboard ab, um ihn hier zu sehen.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {timeEntries.map((entry) => (
        <Card key={entry.id} className="p-4 border-l-4 border-primary">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold">{formatDateForHistory(entry.start_time)}</h3>
            <span className="text-xl font-extrabold text-primary">
              {formatMinutesToHHMM(entry.net_work_duration_minutes)}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {formatGermanDateTime(entry.start_time)} bis {formatGermanDateTime(entry.end_time)}
          </p>
          <p className="text-sm text-muted-foreground">
            Pausendauer: {formatMinutesToHHMM(Math.round(entry.total_break_duration_ms / (1000 * 60)))}
          </p>
          {entry.is_surcharge_day && (
            <div className="mt-2 text-xs font-semibold px-2 py-1 bg-secondary/20 rounded inline-block text-secondary">
              {entry.surcharge_label} (Wert: {formatMinutesToHHMM(entry.surcharge_amount)} Min)
            </div>
          )}
        </Card>
      ))}
    </div>
  );
};
