// Normalisierter Score (0-1) eines Feldes an einem bestimmten Tag. Bei normalen
// Skala-Feldern der direkt eingetragene Wert; bei berechneten Feldern (kind='computed')
// der Durchschnitt der normalisierten Werte seiner Mitglieder an dem Tag (null, wenn
// an dem Tag kein Mitglied befüllt ist — ein berechnetes Feld hält nie einen eigenen Eintrag,
// ihr Slug taucht nie als Key in state.entries auf). Ändert man die Mitgliederliste
// eines berechneten Felds, wirkt sich das rückwirkend auf die gesamte Historie aus, da hier bei
// jedem Aufruf live neu gerechnet wird — beabsichtigt, siehe docs/felder.md.
import { applyGoal, isNeutralScale, normalize, scoreColor, scoreTextColor } from './dates.js';
import { MINUTES_PER_DAY, computedMemberHabits, computedUnit, formatClock, formatDuration, habitNumericValue, hasDayGoal, hasWeekGoal, isDurationComputed, isNumberComputed, isSinceComputed, isTimeKind, numberComputedDay, numberGoalScore } from './fields.js';
import { formatNumber, tPlain } from './i18n.js';
import { state } from './state.js';
import { formatKey, isPeriodField } from './calendar.js';
export function habitScore(h, dateKey) {
  if (hasDayGoal(h)) return numberGoalScore(h, habitNumericValue(h, dateKey));
  if (hasWeekGoal(h)) return null; // bewertet wird nur die Woche, siehe weekGoalWeeks
  if (isTimeKind(h)) return null; // eine Uhrzeit ist weder gut noch schlecht
  const day = state.entries[dateKey];
  if (!day) return null;
  if (isNumberComputed(h)) return null; // keine Bewertung, siehe isNumberComputed
  if (h.kind === 'computed') {
    const memberScores = computedMemberHabits(h)
      .filter((m) => !isNeutralScale(m)) // unbewertete Mitglieder haben kein Gut/Schlecht zum Mitteln
      .map((m) => normalize(m, day[m.id]))
      .filter((s) => s !== null);
    if (!memberScores.length) return null;
    return memberScores.reduce((a, b) => a + b, 0) / memberScores.length;
  }
  return normalize(h, day[h.id]);
}

// Ob ein Feld irgendwo in den übergebenen Datums-Keys einen (ggf. errechneten) Score
// hat — für archivierte Felder in Auswertungs-Ansichten: normale Felder prüfen direkt
// state.entries, berechnete Felder (die nie selbst einen Entry-Key haben) über habitScore.
export function habitVisibleInRange(h, dateKeys) {
  if (isNumberComputed(h)) return dateKeys.some((k) => numberComputedDay(h, k).value !== null);
  if (h.kind === 'computed') return dateKeys.some((k) => habitScore(h, k) !== null);
  return dateKeys.some((k) => state.entries[k]?.[h.id] !== undefined);
}

// Zahlen/Zähler mit Ziel in "Heute": der Wert gefärbt nach Zielnähe (auch 0 - Nutzer-
// Entscheidung 2026-10-14: neutral bis zum ersten Eintrag hilft nicht, nach einem von acht
// Gläsern wäre es trotzdem rot), dahinter "/ Ziel". Bewusst ohne "max"/Haken: ob mindestens
// oder höchstens, weiß man bei den eigenen Feldern selbst (Nutzer-Entscheidung, störte optisch).
export function goalValueStyle(h, value) {
  if (!hasDayGoal(h)) return '';
  const v = Number(value);
  return Number.isFinite(v) ? ` style="color:${scoreTextColor(scoreColor(numberGoalScore(h, v)))}"` : '';
}

// Gesamt-Score eines Tages über alle bewerteten Skala-Felder gemittelt (für Monats-/
// Jahres-Heatmap). Zahlenwert-Felder (kind='number') UND unbewertete Skala-Felder
// (isNeutralScale) fließen bewusst nicht ein — beide haben kein Gut/Schlecht, würden
// die Tages-Gesamtwertung sonst verfälschen. Berechnete Felder ebenfalls nicht: ihre Mitglieder
// sind schon als eigene Felder drin, sonst zählte jedes Mitglied doppelt (bis
// 2026-09-27 so, unbeabsichtigt). Unabhängig davon, ob ein Feld in der Auswertung
// ausgeblendet ist - das betrifft nur die Anzeige.
export function dayOverallScore(date) {
  const dateKey = formatKey(date);
  const day = state.entries[dateKey];
  if (!day) return null;
  const scores = state.habits.filter((h) => ((h.kind === 'scale' && !isNeutralScale(h)) || hasDayGoal(h)) && !isPeriodField(h))
    .map((h) => applyGoal(h, habitScore(h, dateKey)))
    .filter((s) => s !== null);
  if (!scores.length) return null;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

// Durchschnitt + Anzahl je Skala-/berechnetem Feld über eine Menge von Datums-Keys
// ('YYYY-MM-DD').
export function computeHabitStats(habits, dateKeys) {
  return habits.map((h) => {
    let sum = 0, count = 0, hits = 0, numSum = 0;
    for (const k of dateKeys) {
      const s = habitScore(h, k);
      if (s !== null) {
        sum += s; count++; if (s >= 0.999) hits++;
        if (hasDayGoal(h)) numSum += habitNumericValue(h, k);
      }
    }
    return { habit: h, avg: count ? sum / count : null, count, hits, numAvg: count ? numSum / count : null };
  });
}

// Uhrzeiten liegen auf einem Kreis: 23:30 und 0:30 sind eine Stunde auseinander, nicht 23.
// Mittelpunkt = Kreis-Mittel, dann jeder Wert auf die Seite davon, auf der er näher liegt -
// danach stimmen Durchschnitt, Minimum/Maximum und Verlauf (Anzeige über formatClock).
function unwrapClockSeries(series) {
  const angle = (v) => ((v % MINUTES_PER_DAY) / MINUTES_PER_DAY) * 2 * Math.PI;
  const sin = series.reduce((a, p) => a + Math.sin(angle(p.value)), 0);
  const cos = series.reduce((a, p) => a + Math.cos(angle(p.value)), 0);
  const center = ((Math.atan2(sin, cos) / (2 * Math.PI)) * MINUTES_PER_DAY + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const half = MINUTES_PER_DAY / 2;
  return series.map((p) => ({ ...p, value: center + ((((p.value - center) % MINUTES_PER_DAY) + MINUTES_PER_DAY + half) % MINUTES_PER_DAY) - half }));
}

// Werte-Reihe + Kennzahlen eines Zahlenwert-Felds bzw. berechneten Zahlen-Felds über eine
// Menge von Datums-Keys.
export function numberFieldStats(habit, dateKeys) {
  let series = dateKeys
    .map((k) => ({ key: k, value: habitNumericValue(habit, k) }))
    .filter((p) => p.value !== undefined && p.value !== null);
  if (!series.length) return null;
  if (isTimeKind(habit)) series = unwrapClockSeries(series);
  const values = series.map((p) => p.value);
  return {
    series,
    count: series.length,
    min: Math.min(...values),
    max: Math.max(...values),
    avg: values.reduce((a, b) => a + b, 0) / values.length,
    sum: values.reduce((a, b) => a + b, 0),
    last: series[series.length - 1].value,
  };
}

// Ein Wert eines Felds mit Verlauf, wie er angezeigt wird: Uhrzeit, Dauer oder Zahl + Einheit.
export function formatSeriesValue(h, v) {
  if (isTimeKind(h)) return formatClock(v);
  if (isDurationComputed(h)) return `${formatDuration(v)} h`;
  if (isSinceComputed(h)) {
    if (h.since?.mode === 'start') return tPlain('since.dayN', { n: formatNumber(v) });
    return v === 0 ? tPlain('since.today') : tPlain(v === 1 ? 'since.oneDay' : 'since.days', { n: formatNumber(v) });
  }
  const unit = isNumberComputed(h) ? computedUnit(h) : h.unit;
  return formatNumber(v) + (unit ? ` ${unit}` : '');
}
