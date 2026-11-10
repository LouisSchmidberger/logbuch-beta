// --- Datum-Helfer ----------------------------------------------------------
export function formatKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function startOfDay(date) { const d = new Date(date); d.setHours(0, 0, 0, 0); return d; }

// Parst einen 'YYYY-MM-DD'-Key als lokales Datum (nicht new Date(string), das UTC
// interpretiert und je nach Zeitzone einen Tag daneben liegen kann).
export function parseDateKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// Tage nach heute lassen sich nicht öffnen und nichts eintragen (Nutzer-Entscheidung
// 2026-10-30, Grenze Mitternacht ohne Einstellung): Pfeil, Wischen, Kalender und die Zellen
// der Übersicht enden bei heute. Uhrzeiten nach Mitternacht auf der heutigen Seite bleiben.
export function isFutureKey(dateKey) { return dateKey > formatKey(new Date()); }

export function isPastKey(dateKey) { return dateKey < formatKey(new Date()); }

// Wochenbeginn (G2, Nutzer-Entscheidung 2026-11-10): ISO-Wochentag des ersten Tags, 1 Montag
// (Standard), 7 Sonntag, 6 Samstag - aus user_settings.week_start, gesetzt in loadUserSettings.
// Eigene Variable statt state, weil startOfWeek schon beim Anlegen von state gebraucht wird.
// Gespeicherte Wochentage (schedule.days, 0 = Montag) bleiben Montag-basiert; nur Anzeige-
// Reihenfolge und Zeiträume folgen dem Wochenbeginn.
export const WEEK_STARTS = [1, 7, 6];

export function startOfWeekWith(date, iso) { const d = startOfDay(date); const off = (d.getDay() - (iso % 7) + 7) % 7; d.setDate(d.getDate() - off); return d; }

// Zeitraum-Felder (period 'week'/'month'/'year', siehe docs/datenmodell.md): ein Wert pro
// Zeitraum, gespeichert im Eintrag des ersten Tags des Zeitraums. Gegenstück zu
// public.habit_period_start (SQL) - synchron halten.
export const PERIODS = ['week', 'month', 'year'];

export function isPeriodField(h) { return !!h && !!h.period && h.period !== 'day'; }

export function periodStartWith(period, date, iso) {
  const d = startOfDay(date);
  if (period === 'week') return startOfWeekWith(d, iso);
  if (period === 'month') return new Date(d.getFullYear(), d.getMonth(), 1);
  if (period === 'year') return new Date(d.getFullYear(), 0, 1);
  return d;
}

export function addDays(date, n) { const d = new Date(date); d.setDate(d.getDate() + n); return d; }

// --- Erinnerungszeit-Helfer (Minuten seit Mitternacht <-> "HH:MM") ---------
// Erinnerungszeiten werden seit dem Onboarding-Tutorial in 15-Minuten-Schritten
// statt nur zur vollen Stunde gespeichert (siehe docs/erinnerungen.md), als Minuten seit
// Mitternacht (0-1439) statt Stunde (0-23).
export function minutesToTimeStr(min) {
  const h = Math.floor(min / 60), m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// Minuten seit Mitternacht aus reminderTimeInputHtml (id oder das Element), null wenn es
// nicht im DOM steht.
export function readTimeInput(idOrEl) {
  const el = typeof idOrEl === 'string' ? document.getElementById(idOrEl) : idOrEl?.closest('[data-time-input]');
  return el ? Number(el.dataset.value) : null;
}

// --- Feste Tage (habit_definitions.schedule) -------------------------------
// null = täglich, {type:'weekly', days:[0..6]} (0 = Montag) oder "Alle N Tage"
// {type:'interval', every:2..365, unit:'day', start:'YYYY-MM-DD'} - dran ab dem Starttag in
// festem Abstand, davor nicht (monatlich/jährlich decken Zeitraum-Felder ab). Gegenstück zur
// SQL-Funktion public.habit_scheduled_on (Erinnerungen) - beide müssen dieselbe Regel
// umsetzen; unbekannte Pläne gelten als "dran".
export function isScheduledOn(schedule, date) {
  if (schedule?.type === 'interval' && Number.isInteger(schedule.every) && schedule.every >= 2 && /^\d{4}-\d{2}-\d{2}$/.test(schedule.start || '')) {
    const diff = Math.round((startOfDay(date) - parseDateKey(schedule.start)) / 86400000);
    return diff >= 0 && diff % schedule.every === 0;
  }
  if (schedule?.type !== 'weekly' || !Array.isArray(schedule.days)) return true;
  return schedule.days.includes((date.getDay() + 6) % 7);
}
