import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SURCHARGE_RATES = {
  SATURDAY: 0.30,
  SUNDAY: 0.60,
  HOLIDAY: 1.30,
};

const TARGET_HOURS_DAILY: Record<number, number> = {
  1: 510, // Mo: 8h 30m
  2: 510, // Di: 8h 30m
  3: 510, // Mi: 8h 30m
  4: 510, // Do: 8h 30m
  5: 240, // Fr: 4h 00m
};

const NRW_HOLIDAYS_2025 = [
  '01-01', '04-18', '04-21', '05-01', '05-29', '06-09', '06-19',
  '10-03', '11-01', '12-25', '12-26',
];

const isHoliday = (date: Date, customHolidays: string[]): boolean => {
  const mmdd = `${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
  return NRW_HOLIDAYS_2025.includes(mmdd) || customHolidays.includes(mmdd);
};

const calculateSurcharge = (
  startTime: string,
  netMinutes: number,
  customHolidays: string[],
  uspSettled: boolean,
  previousWeeksTargetMet: boolean
): {
  regularMinutes: number;
  surchargeMinutes: number;
  surchargeAmount: number;
  isSurchargeDay: boolean;
  surchargeLabel: string;
} => {
  const date = new Date(startTime);
  const dayOfWeek = date.getDay();
  const isHol = isHoliday(date, customHolidays);

  let rate = 0;
  let label = 'Regulär';
  let surchargeMinutes = 0;
  let regularMinutes = netMinutes;
  let isSurchargeDay = false; // Nur für echte Sondertage (Sa, So, Feiertag)

  // Feiertage: Ab der ersten Minute 130% Zuschlag
  if (isHol) {
    rate = SURCHARGE_RATES.HOLIDAY;
    label = 'Feiertagszuschlag (130%)';
    surchargeMinutes = netMinutes;
    regularMinutes = 0; // Alles ist Überstunde
    isSurchargeDay = true; // ECHTER Sondertag
  } 
  // Samstag: 60% wenn ÜSP abgegolten UND Vorwochen-Soll erfüllt, sonst 30%
  else if (dayOfWeek === 6) {
    if (uspSettled && previousWeeksTargetMet) {
      rate = SURCHARGE_RATES.SUNDAY; // 60%
      label = 'Samstagszuschlag (60%)';
    } else {
      rate = SURCHARGE_RATES.SATURDAY; // 30%
      label = 'Samstagszuschlag (30%)';
    }
    surchargeMinutes = netMinutes;
    regularMinutes = 0; // Alles ist Überstunde
    isSurchargeDay = true; // ECHTER Sondertag
  }
  // Sonntag: Ab der ersten Minute 60% Zuschlag
  else if (dayOfWeek === 0) {
    rate = SURCHARGE_RATES.SUNDAY;
    label = 'Sonntagszuschlag (60%)';
    surchargeMinutes = netMinutes;
    regularMinutes = 0; // Alles ist Überstunde
    isSurchargeDay = true; // ECHTER Sondertag
  } 
  // Montag bis Freitag: Nur Überstunden über Soll erhalten 30% Zuschlag
  else if (dayOfWeek >= 1 && dayOfWeek <= 5) {
    const targetMinutes = TARGET_HOURS_DAILY[dayOfWeek] || 0;
    const overtimeMinutes = Math.max(0, netMinutes - targetMinutes);
    
    if (overtimeMinutes > 0) {
      rate = SURCHARGE_RATES.SATURDAY; // 30%
      label = 'Überstundenzuschlag (30%)';
      surchargeMinutes = overtimeMinutes;
      regularMinutes = targetMinutes; // Nur das Soll ist regulär
      // isSurchargeDay bleibt false, da es kein Sondertag ist
    }
  }

  // Zuschlagswert = Gearbeitete Zeit + Zuschlag darauf
  // Beispiel Sonntag: 552 Min + (552 * 0.60) = 552 + 331 = 883 Min
  const surchargeAmount = Math.round(surchargeMinutes + (surchargeMinutes * rate));

  return {
    regularMinutes,
    surchargeMinutes,
    surchargeAmount,
    isSurchargeDay, // Nur true für Sa, So, Feiertage
    surchargeLabel: label,
  };
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting recalculation...');
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Fetching time entries...');
    // Get all time entries
    const { data: entries, error: fetchError } = await supabase
      .from('time_entries')
      .select('*');

    if (fetchError) {
      console.error('Error fetching entries:', fetchError);
      throw fetchError;
    }

    console.log(`Found ${entries?.length || 0} entries`);

    if (!entries || entries.length === 0) {
      return new Response(
        JSON.stringify({ message: 'Keine Einträge gefunden' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Fetching user settings...');
    // Get all user settings for custom holidays
    const { data: settings, error: settingsError } = await supabase
      .from('user_settings')
      .select('user_id, custom_holidays');

    if (settingsError) {
      console.error('Error fetching settings:', settingsError);
      throw settingsError;
    }

    const userHolidays: Record<string, string[]> = {};
    settings?.forEach(s => {
      userHolidays[s.user_id] = (s.custom_holidays as string[]) || [];
    });

    console.log('Fetching ÜSP data...');
    // Get current year ÜSP status for all users
    const currentYear = new Date().getFullYear();
    const { data: uspData, error: uspError } = await supabase
      .from('overtime_allowance')
      .select('user_id, is_fully_consumed, year')
      .eq('year', currentYear);

    if (uspError) {
      console.error('Error fetching USP:', uspError);
      throw uspError;
    }

    const userUspSettled: Record<string, boolean> = {};
    uspData?.forEach(u => {
      userUspSettled[u.user_id] = u.is_fully_consumed || false;
    });

    console.log('Calculating previous weeks target...');
    // Calculate if previous weeks target was met for each user
    const userPreviousWeeksTargetMet: Record<string, boolean> = {};
    
    // Group entries by user and calculate
    for (const userId of [...new Set(entries.map(e => e.user_id))]) {
      const userEntries = entries.filter(e => e.user_id === userId);
      
      // Calculate total worked vs target for all weeks before current
      let totalWorked = 0;
      let totalTarget = 0;
      
      for (const entry of userEntries) {
        const entryDate = new Date(entry.start_time);
        const dayOfWeek = entryDate.getDay();
        
        // Skip Saturdays and Sundays for target calculation
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
          totalWorked += entry.net_work_duration_minutes;
          totalTarget += TARGET_HOURS_DAILY[dayOfWeek] || 0;
        }
      }
      
      userPreviousWeeksTargetMet[userId] = totalWorked >= totalTarget;
    }

    console.log('Recalculating entries...');
    // Recalculate each entry
    const updates = [];
    for (const entry of entries) {
      const customHolidays = userHolidays[entry.user_id] || [];
      const uspSettled = userUspSettled[entry.user_id] || false;
      const previousWeeksTargetMet = userPreviousWeeksTargetMet[entry.user_id] || false;
      
      const surchargeData = calculateSurcharge(
        entry.start_time,
        entry.net_work_duration_minutes,
        customHolidays,
        uspSettled,
        previousWeeksTargetMet
      );

      updates.push({
        id: entry.id,
        regular_minutes: surchargeData.regularMinutes,
        surcharge_minutes: surchargeData.surchargeMinutes,
        surcharge_amount: surchargeData.surchargeAmount,
        is_surcharge_day: surchargeData.isSurchargeDay,
        surcharge_label: surchargeData.surchargeLabel,
      });
    }

    console.log(`Updating ${updates.length} entries...`);
    // Update all entries
    for (const update of updates) {
      const { error: updateError } = await supabase
        .from('time_entries')
        .update({
          regular_minutes: update.regular_minutes,
          surcharge_minutes: update.surcharge_minutes,
          surcharge_amount: update.surcharge_amount,
          is_surcharge_day: update.is_surcharge_day,
          surcharge_label: update.surcharge_label,
        })
        .eq('id', update.id);

      if (updateError) {
        console.error(`Fehler beim Update von Entry ${update.id}:`, updateError);
      }
    }

    console.log('Recalculation completed successfully');
    return new Response(
      JSON.stringify({ 
        message: `${updates.length} Einträge erfolgreich neu berechnet`,
        updated: updates.length 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
