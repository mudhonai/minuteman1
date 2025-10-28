import { useState, useEffect } from 'react';
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
import { Plus, Trash2, Edit, CalendarIcon, TrendingDown } from 'lucide-react';
import { format, eachDayOfInterval } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { DateRange } from 'react-day-picker';

interface VacationAllowance {
  id: string;
  year: number;
  total_days: number;
  used_days: number;
  remaining_days: number;
  carried_over_days: number;
  notes: string | null;
}

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
  const [vacationAllowance, setVacationAllowance] = useState<VacationAllowance | null>(null);
  const [isEditingAllowance, setIsEditingAllowance] = useState(false);
  const [allowanceYear, setAllowanceYear] = useState(new Date().getFullYear());
  const [totalDays, setTotalDays] = useState('30');
  const [usedDays, setUsedDays] = useState('0');
  const [carriedOverDays, setCarriedOverDays] = useState('0');
  const [allowanceNotes, setAllowanceNotes] = useState('');

  useEffect(() => {
    fetchVacationAllowance();
  }, []);

  const fetchVacationAllowance = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const currentYear = new Date().getFullYear();
      const { data, error } = await supabase
        .from('vacation_allowance')
        .select('*')
        .eq('user_id', user.id)
        .eq('year', currentYear)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      setVacationAllowance(data);
    } catch (error: any) {
      console.error('Fehler beim Laden des Urlaubskontingents:', error);
    }
  };

  const openAllowanceDialog = () => {
    if (vacationAllowance) {
      setAllowanceYear(vacationAllowance.year);
      setTotalDays(vacationAllowance.total_days.toString());
      setUsedDays(vacationAllowance.used_days.toString());
      setCarriedOverDays(vacationAllowance.carried_over_days.toString());
      setAllowanceNotes(vacationAllowance.notes || '');
    } else {
      setAllowanceYear(new Date().getFullYear());
      setTotalDays('30');
      setUsedDays('0');
      setCarriedOverDays('0');
      setAllowanceNotes('');
    }
    setIsEditingAllowance(true);
  };

  const saveAllowance = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Nicht angemeldet');

      const allowanceData = {
        user_id: user.id,
        year: allowanceYear,
        total_days: parseFloat(totalDays),
        used_days: parseFloat(usedDays),
        carried_over_days: parseFloat(carriedOverDays),
        notes: allowanceNotes.trim() || null,
      };

      if (vacationAllowance) {
        const { error } = await supabase
          .from('vacation_allowance')
          .update(allowanceData)
          .eq('id', vacationAllowance.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('vacation_allowance')
          .insert(allowanceData);

        if (error) throw error;
      }

      toast.success('Urlaubskontingent gespeichert!');
      setIsEditingAllowance(false);
      fetchVacationAllowance();
    } catch (error: any) {
      toast.error(error.message || 'Fehler beim Speichern');
    }
  };

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
    const [year, month, day] = entry.date.split('-');
    setSingleDate(new Date(Number(year), Number(month) - 1, Number(day)));
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
    b.date.localeCompare(a.date)
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

      {/* Vacation Allowance Card */}
      <Card className="p-6 bg-gradient-to-r from-blue-500/10 to-blue-600/10 border-blue-500">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-4">
              <TrendingDown className="h-5 w-5 text-blue-500" />
              <h3 className="text-lg font-bold">Urlaubskontingent {new Date().getFullYear()}</h3>
            </div>
            {vacationAllowance ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm opacity-70">Gesamt</p>
                  <p className="text-2xl font-bold">{vacationAllowance.total_days} Tage</p>
                </div>
                <div>
                  <p className="text-sm opacity-70">Verbraucht</p>
                  <p className="text-2xl font-bold">{vacationAllowance.used_days.toFixed(1)} Tage</p>
                </div>
                <div>
                  <p className="text-sm opacity-70">Resturlaub</p>
                  <p className="text-2xl font-bold text-green-500">{vacationAllowance.remaining_days.toFixed(1)} Tage</p>
                </div>
                <div>
                  <p className="text-sm opacity-70">Übertrag</p>
                  <p className="text-2xl font-bold">{vacationAllowance.carried_over_days} Tage</p>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground">Noch kein Urlaubskontingent angelegt.</p>
            )}
          </div>
          <Button onClick={openAllowanceDialog} variant="outline" size="sm">
            {vacationAllowance ? 'Bearbeiten' : 'Anlegen'}
          </Button>
        </div>
      </Card>

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
                      {entry.date.split('-').reverse().join('.')}, {new Date(entry.date + 'T12:00:00').toLocaleDateString('de-DE', { weekday: 'short' })}
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

      {/* Vacation Allowance Dialog */}
      <Dialog open={isEditingAllowance} onOpenChange={setIsEditingAllowance}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {vacationAllowance ? 'Urlaubskontingent bearbeiten' : 'Urlaubskontingent anlegen'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Jahr</Label>
              <Input
                type="number"
                value={allowanceYear}
                onChange={(e) => setAllowanceYear(parseInt(e.target.value))}
                disabled={!!vacationAllowance}
              />
            </div>
            <div>
              <Label>Urlaubstage gesamt</Label>
              <Input
                type="number"
                step="0.5"
                value={totalDays}
                onChange={(e) => setTotalDays(e.target.value)}
              />
            </div>
            <div>
              <Label>Bereits verbrauchte Tage</Label>
              <Input
                type="number"
                step="0.5"
                value={usedDays}
                onChange={(e) => setUsedDays(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Wird automatisch aktualisiert, wenn Urlaubseinträge hinzugefügt werden
              </p>
            </div>
            <div>
              <Label>Übertragene Tage aus Vorjahr</Label>
              <Input
                type="number"
                step="0.5"
                value={carriedOverDays}
                onChange={(e) => setCarriedOverDays(e.target.value)}
              />
            </div>
            <div>
              <Label>Notizen (optional)</Label>
              <Textarea
                value={allowanceNotes}
                onChange={(e) => setAllowanceNotes(e.target.value)}
                placeholder="z.B. Sondervereinbarungen..."
              />
            </div>
            <div className="flex gap-2 pt-4">
              <Button onClick={saveAllowance} className="flex-1">
                Speichern
              </Button>
              <Button onClick={() => setIsEditingAllowance(false)} variant="outline" className="flex-1">
                Abbrechen
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
