import { TimeEntry, AbsenceEntry, TARGET_HOURS_DAILY, TARGET_HOURS_WEEKLY, TARGET_HOURS_MONTHLY } from '@/lib/types';
import { formatMinutesToHHMM, formatGermanDateTime } from '@/lib/timeUtils';
import jsPDF from 'jspdf';

interface PDFExportOptions {
  timeEntries: TimeEntry[];
  absences: AbsenceEntry[];
  currentEntry?: any;
  period: 'week' | 'month' | 'year';
}

export const generatePDFReport = async ({ timeEntries, absences, currentEntry, period }: PDFExportOptions) => {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  let yPos = 20;

  // Filter entries based on period
  const now = new Date();
  let startDate: Date;
  let periodLabel: string;

  if (period === 'week') {
    startDate = new Date(now);
    startDate.setDate(startDate.getDate() - startDate.getDay() + 1);
    startDate.setHours(0, 0, 0, 0);
    periodLabel = `KW ${Math.ceil((now.getDate() + new Date(now.getFullYear(), now.getMonth(), 1).getDay()) / 7)} - ${now.getFullYear()}`;
  } else if (period === 'month') {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    periodLabel = now.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
  } else {
    startDate = new Date(now.getFullYear(), 0, 1);
    periodLabel = `Jahr ${now.getFullYear()}`;
  }

  const filteredEntries = timeEntries.filter(e => new Date(e.start_time) >= startDate);
  const filteredAbsences = absences.filter(a => new Date(a.date) >= startDate);

  // Header
  pdf.setFontSize(24);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Minuteman', pageWidth / 2, yPos, { align: 'center' });
  
  yPos += 8;
  pdf.setFontSize(16);
  pdf.text('Arbeitszeitbericht', pageWidth / 2, yPos, { align: 'center' });
  
  yPos += 6;
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'normal');
  pdf.text(periodLabel, pageWidth / 2, yPos, { align: 'center' });
  
  yPos += 10;
  pdf.setLineWidth(0.5);
  pdf.line(15, yPos, pageWidth - 15, yPos);
  yPos += 10;

  // Summary Section
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Zusammenfassung', 15, yPos);
  yPos += 8;

  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');

  // Calculate totals
  const totalMinutes = filteredEntries.reduce((sum, e) => sum + e.net_work_duration_minutes, 0);
  const totalOvertime = filteredEntries.reduce((sum, e) => {
    const dayOfWeek = new Date(e.start_time).getDay();
    const targetForDay = TARGET_HOURS_DAILY[dayOfWeek] || 0;
    const isWeekendOrHoliday = dayOfWeek === 0 || dayOfWeek === 6 || e.is_surcharge_day;
    
    if (isWeekendOrHoliday) {
      return sum + e.net_work_duration_minutes;
    }
    return sum + Math.max(0, e.net_work_duration_minutes - targetForDay);
  }, 0);
  const totalSurcharge = filteredEntries.reduce((sum, e) => sum + e.surcharge_amount, 0);
  const totalBreaks = filteredEntries.reduce((sum, e) => sum + e.total_break_duration_ms / (1000 * 60), 0);

  const summaryData = [
    ['Arbeitstage:', `${filteredEntries.length}`],
    ['Gesamtstunden:', formatMinutesToHHMM(totalMinutes)],
    ['Überstunden:', formatMinutesToHHMM(totalOvertime)],
    ['Zuschlagswert:', formatMinutesToHHMM(totalSurcharge)],
    ['Pausenzeit gesamt:', formatMinutesToHHMM(totalBreaks)],
  ];

  summaryData.forEach(([label, value]) => {
    pdf.text(label, 15, yPos);
    pdf.setFont('helvetica', 'bold');
    pdf.text(value, pageWidth - 15, yPos, { align: 'right' });
    pdf.setFont('helvetica', 'normal');
    yPos += 6;
  });

  yPos += 5;

  // Absences Summary
  if (filteredAbsences.length > 0) {
    const urlaubHours = filteredAbsences.filter(a => a.absence_type === 'urlaub').reduce((sum, a) => sum + a.hours, 0);
    const juepHours = filteredAbsences.filter(a => a.absence_type === 'juep').reduce((sum, a) => sum + a.hours, 0);
    const krankheitHours = filteredAbsences.filter(a => a.absence_type === 'krankheit').reduce((sum, a) => sum + a.hours, 0);

    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Abwesenheiten', 15, yPos);
    yPos += 8;

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    
    if (urlaubHours > 0) {
      pdf.text('Urlaub:', 15, yPos);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`${urlaubHours.toFixed(1)}h`, pageWidth - 15, yPos, { align: 'right' });
      pdf.setFont('helvetica', 'normal');
      yPos += 6;
    }
    
    if (juepHours > 0) {
      pdf.text('JÜP:', 15, yPos);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`${juepHours.toFixed(1)}h`, pageWidth - 15, yPos, { align: 'right' });
      pdf.setFont('helvetica', 'normal');
      yPos += 6;
    }
    
    if (krankheitHours > 0) {
      pdf.text('Krankheit:', 15, yPos);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`${krankheitHours.toFixed(1)}h`, pageWidth - 15, yPos, { align: 'right' });
      pdf.setFont('helvetica', 'normal');
      yPos += 6;
    }

    yPos += 5;
  }

  // Time Entries Detail
  if (filteredEntries.length > 0) {
    yPos += 5;
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Detaillierte Arbeitstage', 15, yPos);
    yPos += 8;

    pdf.setFontSize(9);

    filteredEntries.slice(0, 20).forEach(entry => {
      // Check if we need a new page
      if (yPos > 270) {
        pdf.addPage();
        yPos = 20;
      }

      const date = new Date(entry.start_time);
      const dateStr = date.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
      
      pdf.setFont('helvetica', 'bold');
      pdf.text(dateStr, 15, yPos);
      pdf.text(formatMinutesToHHMM(entry.net_work_duration_minutes), pageWidth - 15, yPos, { align: 'right' });
      
      yPos += 5;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.text(`${formatGermanDateTime(entry.start_time)} - ${formatGermanDateTime(entry.end_time)}`, 20, yPos);
      
      if (entry.is_surcharge_day) {
        yPos += 4;
        pdf.setTextColor(100, 100, 100);
        pdf.text(`${entry.surcharge_label}: ${formatMinutesToHHMM(entry.surcharge_amount)}`, 20, yPos);
        pdf.setTextColor(0, 0, 0);
      }
      
      yPos += 6;
      pdf.setFontSize(9);
    });

    if (filteredEntries.length > 20) {
      pdf.setFontSize(8);
      pdf.setTextColor(100, 100, 100);
      pdf.text(`... und ${filteredEntries.length - 20} weitere Einträge`, 15, yPos);
      pdf.setTextColor(0, 0, 0);
    }
  }

  // Footer
  const pageCount = pdf.internal.pages.length - 1;
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setTextColor(150, 150, 150);
    pdf.text(
      `Erstellt am ${new Date().toLocaleDateString('de-DE')} | Seite ${i} von ${pageCount}`,
      pageWidth / 2,
      pdf.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }

  return pdf;
};
