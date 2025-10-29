import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TimeEntry, Break, TARGET_HOURS_DAILY, AbsenceEntry, AbsenceType } from '@/lib/types';
import { formatMinutesToHHMM, formatGermanDateTime, formatDateForHistory, calculateNetWorkDuration, calculateSurcharge } from '@/lib/timeUtils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Pencil, Trash2, Plus, X, TrendingUp, Calendar } from 'lucide-react';

interface HistoryProps {
  timeEntries: TimeEntry[];
  customHolidays: string[];
  absences: AbsenceEntry[];
}

const ABSENCE_LABELS: Record<AbsenceType, string> = {
  urlaub: 'Urlaub',
  juep: 'JÜP',
  krankheit: 'Krankheit',
};

const ABSENCE_COLORS: Record<AbsenceType, string> = {
  urlaub: 'bg-blue-500/10 border-blue-500',
  juep: 'bg-green-500/10 border-green-500',
  krankheit: 'bg-red-500/10 border-red-500',
};

export const History = ({ timeEntries, customHolidays, absences }: HistoryProps) => {
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [breaks, setBreaks] = useState<Break[]>([]);

  const openEditDialog = (entry: TimeEntry) => {
    setEditingEntry(entry);
    setIsAddingNew(false);
    // Konvertiere UTC zu lokaler Zeit für datetime-local Input
    const startLocal = new Date(entry.start_time);
    const endLocal = new Date(entry.end_time);
    setStartTime(formatDateTimeLocal(startLocal));
    setEndTime(formatDateTimeLocal(endLocal));
    setBreaks([...entry.breaks]);
  };

  const formatDateTimeLocal = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const openAddDialog = () => {
    setIsAddingNew(true);
    setEditingEntry(null);
    const now = new Date();
    const start = new Date(now);
    start.setHours(8, 0, 0, 0);
    const end = new Date(now);
    end.setHours(17, 0, 0, 0);
    setStartTime(start.toISOString().substring(0, 16));
    setEndTime(end.toISOString().substring(0, 16));
    setBreaks([]);
  };

  const closeEditDialog = () => {
    setEditingEntry(null);
    setIsAddingNew(false);
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
    // Konvertiere lokale Zeit zu ISO String
    newBreaks[index] = { ...newBreaks[index], [field]: value ? new Date(value).toISOString() : null };
    setBreaks(newBreaks);
  };

  const saveEntry = async () => {
    try {
      console.log('saveEntry started, isAddingNew:', isAddingNew);
      console.log('startTime:', startTime, 'endTime:', endTime, 'breaks:', breaks);
      
      // Konvertiere lokale Zeit zu ISO String
      const startISO = new Date(startTime).toISOString();
      const endISO = new Date(endTime).toISOString();

      const { netMinutes, totalBreakMs } = calculateNetWorkDuration(startISO, endISO, breaks);
      const surcharge = calculateSurcharge(startISO, netMinutes, customHolidays);

      const { data: { user } } = await supabase.auth.getUser();
      console.log('User:', user);
      if (!user) throw new Error('Nicht angemeldet');

      const entryData = {
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
        date: new Date(startISO).toISOString().split('T')[0],
      };

      console.log('entryData:', entryData);

      if (isAddingNew) {
        console.log('Inserting new entry...');
        const { error, data } = await supabase
          .from('time_entries')
          .insert({
            ...entryData,
            user_id: user.id,
          })
          .select();

        console.log('Insert result:', { error, data });
        if (error) throw error;
        toast.success('Neuer Eintrag erfolgreich erstellt');
      } else if (editingEntry) {
        console.log('Updating existing entry...');
        const { error } = await supabase
          .from('time_entries')
          .update(entryData)
          .eq('id', editingEntry.id);

        if (error) throw error;
        toast.success('Eintrag erfolgreich aktualisiert');
      }

      closeEditDialog();
    } catch (error: any) {
      console.error('Error saving entry:', error);
      toast.error('Fehler beim Speichern des Eintrags: ' + error.message);
    }
  };

  const deleteEntry = async (id: string) => {
    const confirmed = window.confirm('Möchtest du diesen Eintrag wirklich löschen?');
    
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('time_entries')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Supabase delete error:', error);
        throw error;
      }

      toast.success('Eintrag erfolgreich gelöscht');
    } catch (error: any) {
      console.error('Error deleting entry:', error);
      toast.error('Fehler beim Löschen des Eintrags: ' + error.message);
    }
  };

  if (timeEntries.length === 0) {
    return (
      <>
        <div className="p-6 text-center">
          <p className="text-muted-foreground mb-4">Du hast noch keine abgeschlossenen Zeiteinträge.</p>
          <Button 
            onClick={openAddDialog} 
            className="w-full gap-2"
          >
            <Plus className="h-4 w-4" />
            Neuen Tag hinzufügen
          </Button>
          <p className="text-muted-foreground/70 mt-4 text-sm">
            Schließe einen Arbeitstag über das Dashboard ab oder füge manuell einen Tag hinzu.
          </p>
        </div>

        <Dialog open={!!editingEntry || isAddingNew} onOpenChange={closeEditDialog}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{isAddingNew ? 'Neuen Tag hinzufügen' : 'Zeiteintrag bearbeiten'}</DialogTitle>
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
  }

  // Kombiniere und sortiere Zeiteinträge und Abwesenheiten nach Datum
  const combinedEntries = [
    ...timeEntries.map(entry => ({
      type: 'time' as const,
      date: entry.start_time,
      data: entry
    })),
    ...absences.map(absence => ({
      type: 'absence' as const,
      date: absence.date + 'T12:00:00',
      data: absence
    }))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <>
      <div className="space-y-4">
        <Button onClick={openAddDialog} className="w-full gap-2 mb-4">
          <Plus className="h-4 w-4" />
          Neuen Tag hinzufügen
        </Button>
        {combinedEntries.map((item, index) => {
          if (item.type === 'absence') {
            const absence = item.data as AbsenceEntry;
            return (
              <Card key={`absence-${absence.id}`} className={`p-4 border-l-4 ${ABSENCE_COLORS[absence.absence_type]}`}>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-bold flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        {absence.date.split('-').reverse().join('.')}
                      </h3>
                      <span className="text-xl font-extrabold">{absence.hours}h</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {ABSENCE_LABELS[absence.absence_type]}
                    </p>
                    {absence.note && (
                      <p className="text-sm mt-2 text-muted-foreground italic">
                        {absence.note}
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            );
          }

          const entry = item.data as TimeEntry;
          const entryDate = new Date(entry.start_time);
          const dayOfWeek = entryDate.getDay();
          const targetMinutes = TARGET_HOURS_DAILY[dayOfWeek] || 0;
          const isWeekendOrHoliday = dayOfWeek === 0 || dayOfWeek === 6 || entry.is_surcharge_day;
          
          // Überstunden berechnen
          let overtimeMinutes = 0;
          if (isWeekendOrHoliday) {
            // Am Wochenende/Feiertag ist alles Überstunde
            overtimeMinutes = entry.net_work_duration_minutes;
          } else {
            // Unter der Woche nur die Zeit über dem Soll
            overtimeMinutes = Math.max(0, entry.net_work_duration_minutes - targetMinutes);
          }

          return (
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
                
                {overtimeMinutes > 0 && (
                  <div className="mt-2 flex items-center gap-2 text-sm">
                    <div className="flex items-center gap-1 px-2 py-1 bg-primary/10 rounded font-semibold text-primary">
                      <TrendingUp className="h-3 w-3" />
                      Überstunden: {formatMinutesToHHMM(overtimeMinutes)}
                    </div>
                  </div>
                )}
                
                {entry.surcharge_minutes > 0 && (
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
        );
        })}
      </div>

      <Dialog open={!!editingEntry || isAddingNew} onOpenChange={closeEditDialog}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isAddingNew ? 'Neuen Tag hinzufügen' : 'Zeiteintrag bearbeiten'}</DialogTitle>
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
