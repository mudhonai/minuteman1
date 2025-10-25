import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TimeEntry, Break } from '@/lib/types';
import { formatMinutesToHHMM, formatGermanDateTime, formatDateForHistory, calculateNetWorkDuration, calculateSurcharge } from '@/lib/timeUtils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Pencil, Trash2, Plus, X } from 'lucide-react';

interface HistoryProps {
  timeEntries: TimeEntry[];
  customHolidays: string[];
}

export const History = ({ timeEntries, customHolidays }: HistoryProps) => {
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [breaks, setBreaks] = useState<Break[]>([]);

  const openEditDialog = (entry: TimeEntry) => {
    setEditingEntry(entry);
    setStartTime(entry.start_time.substring(0, 16));
    setEndTime(entry.end_time.substring(0, 16));
    setBreaks([...entry.breaks]);
  };

  const closeEditDialog = () => {
    setEditingEntry(null);
    setStartTime('');
    setEndTime('');
    setBreaks([]);
  };

  const addBreak = () => {
    setBreaks([...breaks, { start: new Date().toISOString(), end: null }]);
  };

  const removeBreak = (index: number) => {
    setBreaks(breaks.filter((_, i) => i !== index));
  };

  const updateBreak = (index: number, field: 'start' | 'end', value: string) => {
    const newBreaks = [...breaks];
    newBreaks[index] = { ...newBreaks[index], [field]: value ? new Date(value).toISOString() : null };
    setBreaks(newBreaks);
  };

  const saveEntry = async () => {
    if (!editingEntry) return;

    try {
      const startISO = new Date(startTime).toISOString();
      const endISO = new Date(endTime).toISOString();

      const { netMinutes, totalBreakMs } = calculateNetWorkDuration(startISO, endISO, breaks);
      const surcharge = calculateSurcharge(startISO, netMinutes, customHolidays);

      const { error } = await supabase
        .from('time_entries')
        .update({
          start_time: startISO,
          end_time: endISO,
          breaks: breaks as any,
          net_work_duration_minutes: netMinutes,
          total_break_duration_ms: totalBreakMs,
          regular_minutes: surcharge.regularMinutes,
          surcharge_minutes: surcharge.surchargeMinutes,
          surcharge_amount: surcharge.surchargeAmount,
          is_surcharge_day: surcharge.isSurchargeDay,
          surcharge_label: surcharge.surchargeLabel,
        })
        .eq('id', editingEntry.id);

      if (error) throw error;

      toast.success('Eintrag erfolgreich aktualisiert');
      closeEditDialog();
    } catch (error: any) {
      console.error('Error updating entry:', error);
      toast.error('Fehler beim Aktualisieren des Eintrags');
    }
  };

  const deleteEntry = async (id: string) => {
    if (!confirm('Möchtest du diesen Eintrag wirklich löschen?')) return;

    try {
      const { error } = await supabase
        .from('time_entries')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Eintrag erfolgreich gelöscht');
    } catch (error: any) {
      console.error('Error deleting entry:', error);
      toast.error('Fehler beim Löschen des Eintrags');
    }
  };

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
    <>
      <div className="space-y-4">
        {timeEntries.map((entry) => (
          <Card key={entry.id} className="p-4 border-l-4 border-primary">
            <div className="flex justify-between items-start">
              <div className="flex-1">
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
              </div>
              <div className="flex gap-2 ml-4">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => openEditDialog(entry)}
                  className="h-8 w-8"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="destructive"
                  size="icon"
                  onClick={() => deleteEntry(entry.id)}
                  className="h-8 w-8"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={!!editingEntry} onOpenChange={closeEditDialog}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Zeiteintrag bearbeiten</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="start-time">Startzeit</Label>
              <Input
                id="start-time"
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-time">Endzeit</Label>
              <Input
                id="end-time"
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label>Pausen</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addBreak}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Pause hinzufügen
                </Button>
              </div>
              {breaks.map((breakItem, index) => (
                <Card key={index} className="p-3 space-y-2">
                  <div className="flex justify-between items-center">
                    <Label className="text-xs">Pause {index + 1}</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeBreak(index)}
                      className="h-6 w-6"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <Input
                      type="datetime-local"
                      value={breakItem.start ? breakItem.start.substring(0, 16) : ''}
                      onChange={(e) => updateBreak(index, 'start', e.target.value)}
                      placeholder="Start"
                    />
                    <Input
                      type="datetime-local"
                      value={breakItem.end ? breakItem.end.substring(0, 16) : ''}
                      onChange={(e) => updateBreak(index, 'end', e.target.value)}
                      placeholder="Ende"
                    />
                  </div>
                </Card>
              ))}
            </div>
            <div className="flex gap-2 pt-4">
              <Button onClick={saveEntry} className="flex-1">
                Speichern
              </Button>
              <Button onClick={closeEditDialog} variant="outline" className="flex-1">
                Abbrechen
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
