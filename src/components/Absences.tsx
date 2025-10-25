import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AbsenceEntry, AbsenceType } from '@/lib/types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Trash2, Edit, CalendarIcon } from 'lucide-react';
import { format, eachDayOfInterval } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { DateRange } from 'react-day-picker';

interface AbsencesProps {
  absences: AbsenceEntry[];
}

const ABSENCE_LABELS: Record<AbsenceType, string> = {
  urlaub: 'Urlaub',
  juep: 'JÜP (Überstundenabbau)',
  krankheit: 'Krankheit',
};

const ABSENCE_COLORS: Record<AbsenceType, string> = {
  urlaub: 'bg-blue-500/10 border-blue-500',
  juep: 'bg-green-500/10 border-green-500',
  krankheit: 'bg-red-500/10 border-red-500',
};

export const Absences = ({ absences }: AbsencesProps) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<AbsenceEntry | null>(null);
  const [isMultiDay, setIsMultiDay] = useState(false);
  const [singleDate, setSingleDate] = useState<Date | undefined>(new Date());
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [absenceType, setAbsenceType] = useState<AbsenceType>('urlaub');
  const [hours, setHours] = useState('8.5');
  const [note, setNote] = useState('');

  const openAddDialog = () => {
    setEditingEntry(null);
    setIsMultiDay(false);
    setSingleDate(new Date());
    setDateRange(undefined);
    setAbsenceType('urlaub');
    setHours('8.5');
    setNote('');
    setIsDialogOpen(true);
  };

  const openEditDialog = (entry: AbsenceEntry) => {
    setEditingEntry(entry);
    setIsMultiDay(false);
    setSingleDate(new Date(entry.date));
    setDateRange(undefined);
    setAbsenceType(entry.absence_type);
    setHours(entry.hours.toString());
    setNote(entry.note || '');
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingEntry(null);
  };

  const saveEntry = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Nicht angemeldet');

      if (editingEntry) {
        // Editing single entry
        const entryData = {
          user_id: user.id,
          date: singleDate ? format(singleDate, 'yyyy-MM-dd') : new Date().toISOString().split('T')[0],
          absence_type: absenceType,
          hours: parseFloat(hours),
          note: note.trim() || null,
        };

        const { error } = await supabase
          .from('absence_entries')
          .update(entryData)
          .eq('id', editingEntry.id);

        if (error) throw error;
        toast.success('Abwesenheit aktualisiert!');
      } else {
        // Adding new entry(s)
        const datesToInsert: Date[] = [];
        
        if (isMultiDay && dateRange?.from && dateRange?.to) {
          // Multi-day range
          datesToInsert.push(...eachDayOfInterval({ start: dateRange.from, end: dateRange.to }));
        } else if (singleDate) {
          // Single day
          datesToInsert.push(singleDate);
        }

        const entries = datesToInsert.map(date => ({
          user_id: user.id,
          date: format(date, 'yyyy-MM-dd'),
          absence_type: absenceType,
          hours: parseFloat(hours),
          note: note.trim() || null,
        }));

        const { error } = await supabase
          .from('absence_entries')
          .insert(entries);

        if (error) throw error;
        toast.success(`${entries.length} Abwesenheit${entries.length > 1 ? 'en' : ''} hinzugefügt!`);
      }

      closeDialog();
    } catch (error: any) {
      toast.error(error.message || 'Fehler beim Speichern');
    }
  };

  const deleteEntry = async (id: string) => {
    if (!confirm('Abwesenheit wirklich löschen?')) return;

    try {
      const { error } = await supabase
        .from('absence_entries')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Abwesenheit gelöscht!');
    } catch (error: any) {
      toast.error(error.message || 'Fehler beim Löschen');
    }
  };

  const sortedAbsences = [...absences].sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const monthlyStats = absences.reduce((acc, entry) => {
    const month = entry.date.substring(0, 7);
    if (!acc[month]) {
      acc[month] = { urlaub: 0, juep: 0, krankheit: 0 };
    }
    acc[month][entry.absence_type] += entry.hours;
    return acc;
  }, {} as Record<string, Record<AbsenceType, number>>);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Abwesenheiten</h2>
        <Button onClick={openAddDialog} className="gap-2">
          <Plus className="h-4 w-4" />
          Abwesenheit hinzufügen
        </Button>
      </div>

      {/* Monthly Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 bg-blue-500/10 border-blue-500">
          <p className="text-sm opacity-80">Urlaub (Monat)</p>
          <h3 className="text-2xl font-bold">
            {Object.values(monthlyStats)[0]?.urlaub.toFixed(1) || '0.0'}h
          </h3>
        </Card>
        <Card className="p-4 bg-green-500/10 border-green-500">
          <p className="text-sm opacity-80">JÜP (Monat)</p>
          <h3 className="text-2xl font-bold">
            {Object.values(monthlyStats)[0]?.juep.toFixed(1) || '0.0'}h
          </h3>
        </Card>
        <Card className="p-4 bg-red-500/10 border-red-500">
          <p className="text-sm opacity-80">Krankheit (Monat)</p>
          <h3 className="text-2xl font-bold">
            {Object.values(monthlyStats)[0]?.krankheit.toFixed(1) || '0.0'}h
          </h3>
        </Card>
      </div>

      {/* Absence List */}
      <div className="space-y-3">
        {sortedAbsences.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">Noch keine Abwesenheiten eingetragen.</p>
          </Card>
        ) : (
          sortedAbsences.map((entry) => (
            <Card key={entry.id} className={`p-4 border-l-4 ${ABSENCE_COLORS[entry.absence_type]}`}>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex justify-between items-center">
                    <h3 className="font-bold">
                      {new Date(entry.date).toLocaleDateString('de-DE', { 
                        weekday: 'short', 
                        day: '2-digit', 
                        month: '2-digit', 
                        year: 'numeric' 
                      })}
                    </h3>
                    <span className="text-xl font-bold">{entry.hours}h</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {ABSENCE_LABELS[entry.absence_type]}
                  </p>
                  {entry.note && (
                    <p className="text-sm mt-2 text-muted-foreground italic">
                      {entry.note}
                    </p>
                  )}
                </div>
                <div className="flex gap-2 ml-4">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openEditDialog(entry)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteEntry(entry.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingEntry ? 'Abwesenheit bearbeiten' : 'Abwesenheit hinzufügen'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {!editingEntry && (
              <div className="flex gap-2 p-2 bg-muted rounded-lg">
                <Button
                  type="button"
                  variant={!isMultiDay ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setIsMultiDay(false)}
                  className="flex-1"
                >
                  Einzelner Tag
                </Button>
                <Button
                  type="button"
                  variant={isMultiDay ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setIsMultiDay(true)}
                  className="flex-1"
                >
                  Zeitraum
                </Button>
              </div>
            )}
            
            <div>
              <Label>Datum</Label>
              {!isMultiDay || editingEntry ? (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !singleDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {singleDate ? format(singleDate, 'PPP', { locale: de }) : 'Datum wählen'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={singleDate}
                      onSelect={setSingleDate}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              ) : (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !dateRange && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateRange?.from ? (
                        dateRange.to ? (
                          <>
                            {format(dateRange.from, 'dd.MM.yy', { locale: de })} -{' '}
                            {format(dateRange.to, 'dd.MM.yy', { locale: de })}
                          </>
                        ) : (
                          format(dateRange.from, 'PPP', { locale: de })
                        )
                      ) : (
                        'Zeitraum wählen'
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="range"
                      selected={dateRange}
                      onSelect={setDateRange}
                      initialFocus
                      numberOfMonths={2}
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              )}
            </div>
            <div>
              <Label>Typ</Label>
              <Select value={absenceType} onValueChange={(v) => setAbsenceType(v as AbsenceType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="urlaub">{ABSENCE_LABELS.urlaub}</SelectItem>
                  <SelectItem value="juep">{ABSENCE_LABELS.juep}</SelectItem>
                  <SelectItem value="krankheit">{ABSENCE_LABELS.krankheit}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Stunden</Label>
              <Input
                type="number"
                step="0.5"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
              />
            </div>
            <div>
              <Label>Notiz (optional)</Label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="z.B. Arzttermin, Familienurlaub..."
              />
            </div>
            <div className="flex gap-2 pt-4">
              <Button onClick={saveEntry} className="flex-1">
                Speichern
              </Button>
              <Button onClick={closeDialog} variant="outline" className="flex-1">
                Abbrechen
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
