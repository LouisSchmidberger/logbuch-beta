import { runtime, state } from '../state/state.js';
import { isPatternDisabled } from '../lib/theme.js';
import { formatDMY, mondayFirstWeekdayShortNames } from '../lib/format.js';
import { esc } from '../lib/html.js';
import { addDays, formatKey, isFutureKey, isPastKey, isPeriodField, isScheduledOn, parseDateKey, periodStartWith, startOfWeekWith } from '../lib/calendar.js';
import { formatNumber, t, tPlain } from '../lib/i18n.js';

// Ob ein Feld an einem Tag "dran" ist. Berechnete Felder haben keinen eigenen Plan: dran, sobald
// eines ihrer aktiven Mitglieder dran ist.
export function isPlannedOn(h, date) {
  if (h.kind !== 'computed') return isScheduledOn(h.schedule, date);
  return (h.members || []).some((slug) => {
    const m = state.habits.find((x) => x.id === slug);
    return m && !m.archivedAt && isScheduledOn(m.schedule, date);
  });
}
// Kurzbeschreibung für die Verwaltungsliste ('' bei täglich): die Wochentage bzw. "alle N Tage".
export function scheduleSummary(schedule) {
  if (schedule?.type === 'interval') return t('schedule.summary.everyDays', { n: schedule.every });
  if (schedule?.type !== 'weekly') return '';
  const names = mondayFirstWeekdayShortNames();
  return weekdayOrder().filter((d) => schedule.days.includes(d)).map((d) => names[d]).join(', ');
}

// Steht die Ansicht schon beim laufenden Tag/Woche/Monat/Jahr? Dann geht es nicht weiter.
export function atCurrentPeriod(view = state.view) {
  const now = new Date();
  if (view === 'today') return !isPastKey(formatKey(state.currentDate));
  if (view === 'week') return formatKey(startOfWeek(state.weekAnchor)) >= formatKey(startOfWeek(now));
  if (view === 'month') return state.monthAnchor.getFullYear() * 12 + state.monthAnchor.getMonth() >= now.getFullYear() * 12 + now.getMonth();
  if (view === 'year') return state.yearAnchor >= now.getFullYear();
  return false;
}
export const nextPeriodDisabled = (view) => (atCurrentPeriod(view) ? ' aria-disabled="true"' : '');
// Zellen der Übersicht, die einen Tag öffnen - zukünftige sind keine Knöpfe.
export function openDayAttrs(d) {
  const key = formatKey(d);
  return isFutureKey(key) ? 'role="img"' : `data-action="open-day" data-date="${key}" tabindex="0" role="button"`;
}
export function startOfWeek(date) { return startOfWeekWith(date, runtime.weekStartIso); }
// Letzter Tag der Woche als ISO-Wochentag (Gegenstück zu public.habit_week_last_isodow).
export function weekLastIso(iso = runtime.weekStartIso) { return ((iso + 5) % 7) + 1; }
// Wochentage (0 = Montag) in Anzeige-Reihenfolge ab dem Wochenbeginn.
export function weekdayOrder() { return Array.from({ length: 7 }, (_, i) => (runtime.weekStartIso - 1 + i) % 7); }
export function periodStart(period, date) { return periodStartWith(period, date, runtime.weekStartIso); }
export function periodEnd(period, date) {
  const start = periodStart(period, date);
  if (period === 'week') return addDays(start, 6);
  if (period === 'month') return new Date(start.getFullYear(), start.getMonth() + 1, 0);
  if (period === 'year') return new Date(start.getFullYear(), 11, 31);
  return start;
}
// Unter welchem Tag der Wert eines Felds steht: Tagesfelder am Tag selbst, Zeitraum-Felder am
// ersten Tag ihres Zeitraums. Alle Speicher-Wege (handleSelect & Co., Notizen) laufen hier
// durch - so bleibt der Rest (saveDay, mergeDay, Verschlüsselung) unverändert.
export function entryKeyFor(habitId, dateKey) {
  const h = state.habits.find((x) => x.id === habitId);
  return isPeriodField(h) ? formatKey(periodStart(h.period, parseDateKey(dateKey))) : dateKey;
}

// 0 = schlechtester, 1 = bester Wert
export function normalize(habit, value) {
  if (value === undefined || value === null) return null;
  const raw = (value - habit.min) / (habit.max - habit.min);
  return habit.good === 'low' ? 1 - raw : raw;
}

export function scoreColor(score) {
  if (score === null || score === undefined) return 'transparent';
  const rust = [162, 80, 58], sand = [150, 142, 124], moss = [75, 107, 79];
  let c;
  if (score < 0.5) { const t = score / 0.5; c = rust.map((v, i) => Math.round(v + (sand[i] - v) * t)); }
  else { const t = (score - 0.5) / 0.5; c = sand.map((v, i) => Math.round(v + (moss[i] - v) * t)); }
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

// Skala-Felder ohne Gut/Schlecht-Bewertung (good = null, siehe habitForm.noValuation) -
// bewusstes Tracken ohne Wertung. Werden bewusst gar nicht nach Wert eingefärbt, auch
// nicht in Graustufen (Nutzer-Entscheidung 2026-09-28): eine Abstufung hell -> dunkel
// setzt eine Reihenfolge der Stufen voraus, die es bei vielen solchen Feldern nicht gibt
// (z.B. "sonnig/bewölkt/Regen"), und wirkte trotzdem wie eine Wertung. Stattdessen nur
// "eingetragen" (NEUTRAL_FILL) bzw. in "Heute" die übliche Auswahl-Farbe
// (NEUTRAL_SELECTED, wie .pill-toggle--active), und keine %-Durchschnitte.
export function isNeutralScale(h) { return h.kind === 'scale' && !h.good; }
export const NEUTRAL_FILL = 'var(--sand)';
export const NEUTRAL_SELECTED = 'var(--ink)';
export const NEUTRAL_SELECTED_TEXT = 'var(--paper)';
// Zentrale Weiche für jede farbliche Score-Darstellung eines konkreten Feldes -
// scoreColor() für bewertete (auch berechnete) Felder, NEUTRAL_FILL für unbewertete.
export function habitColor(habit, score) {
  if (isNeutralScale(habit)) return score === null || score === undefined ? 'transparent' : NEUTRAL_FILL;
  return scoreColor(score);
}
// Textfarbe auf einer Score-Farbe (rgb()-String aus scoreColor): hell oder dunkel, je
// nachdem was mehr Kontrast hat (WCAG-Leuchtdichte). Ein fester heller Text (--on-score)
// war auf den hellen Stufen kaum lesbar (Sandton in der Mitte der Skala ~3:1). Bewusst
// reines Weiß/Schwarz statt der warmen App-Töne: die Mittelstufen liegen genau im
// ungünstigsten Helligkeitsbereich, nur damit erreicht jede Stufe mind. 4,5:1
// (nachgerechnet über alle Stufen; mit #f5f3ee/#2b2620 nur 3,7:1).
const ON_SCORE_LIGHT = '#ffffff';
const ON_SCORE_DARK = '#000000';
export function textOnScore(rgb) {
  const m = /rgb\((\d+), (\d+), (\d+)\)/.exec(rgb || '');
  if (!m) return 'inherit'; // kein Score (transparent) - normaler Text, z.B. für "–"
  const channel = (c) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  const lum = 0.2126 * channel(+m[1]) + 0.7152 * channel(+m[2]) + 0.0722 * channel(+m[3]);
  const contrast = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  // Leuchtdichte von Weiß = 1, von Schwarz = 0
  return contrast(lum, 1) >= contrast(lum, 0) ? ON_SCORE_LIGHT : ON_SCORE_DARK;
}
// Score-Farbe als Schriftfarbe auf --paper (Werte in Monat/Jahr/Gesamt): pur erreichen die
// Mittelstufen nur ~2,6:1 (hell) bzw. ~2,9:1 (dunkel). 60 % Score-Farbe + 40 % --ink hält
// den Farbton und kommt über alle Stufen auf mind. 4,8:1 (hell) bzw. 5,9:1 (dunkel) –
// --ink ist im Dark Mode hell, die Mischung hellt dort also auf.
export function scoreTextColor(color) {
  return `color-mix(in srgb, ${color} 60%, var(--ink))`;
}
export function goalSuffixHtml(h) {
  const g = h.goal;
  const shown = g.dir === 'range' ? `${formatNumber(g.target)}–${formatNumber(g.max)}` : formatNumber(g.target);
  const sr = g.dir === 'range' ? tPlain('today.goalRange', { min: formatNumber(g.target), max: formatNumber(g.max) }) : tPlain('today.goalOf', { target: formatNumber(g.target) });
  return `<span class="goal-suffix"><span aria-hidden="true">/ ${esc(shown)}</span><span class="visually-hidden">${esc(sr)}</span></span>`;
}

// Zusätzlich zur Farbe (scoreColor) ein Streifenmuster, dessen Dichte/Deckkraft mit
// dem Score steigt — macht die Bewertung auch für Rot-Grün-Farbenblinde ohne Farbe
// erkennbar, nicht als Ersatz für die Farbe, sondern als Ergänzung. Bewusst diskrete
// Stufen statt stufenloser Variation: bei 8-22px Zellgröße wäre ein kontinuierlicher
// Verlauf visuelles Rauschen, diskrete Stufen sind als "Sprosse auf einer Leiter"
// erkennbar unabhängig vom Farbton. coarse=true (Jahres-Ansicht, ~8px Zellen) nutzt
// nur 3 statt 5 Stufen mit weiter auseinanderliegenden Streifen.
export function scorePatternStyle(score, coarse) {
  if (score === null || score === undefined || isPatternDisabled()) return '';
  const spacing = coarse ? [6, 4, 2] : [6, 5, 4, 3, 2];
  const opacity = coarse ? [0.15, 0.25, 0.35] : [0, 0.12, 0.2, 0.28, 0.35];
  const buckets = spacing.length;
  const step = Math.min(buckets - 1, Math.floor(score * buckets));
  if (opacity[step] === 0) return '';
  return `background-image:repeating-linear-gradient(45deg, rgba(0,0,0,${opacity[step]}) 0, rgba(0,0,0,${opacity[step]}) 1px, transparent 1px, transparent ${spacing[step]}px);`;
}

// Beschreibung für Kalender-Tage (Wochentage der Woche, Monat, Jahr), die nur per
// Hintergrundfarbe bewertet sind — macht den Tages-Gesamtwert über alle Felder per
// Tastatur/Screenreader zugänglich. tPlain: die Aufrufer escapen das Ergebnis fürs Attribut.
export function dayCellAriaLabel(date, score) {
  const scoreText = score === null || score === undefined ? t('common.noData') : `${Math.round(score * 100)}%`;
  return tPlain('ariaLabel.dayCell', { date: formatDMY(date), score: scoreText });
}

// Verschiebt einen normalisierten Score (0-1) anhand der pro Feld einstellbaren
// Ziel-Quote (goalThreshold, Standard 1 = 100%) für die FARBGEBUNG — z.B. bei
// "Kraftsport gemacht" kann eine 50%-Quote schon als voll erreicht (Score 1) gelten.
// Ändert NIE angezeigte Prozentzahlen, nur die Farbe, und wird bewusst NICHT in der
// "Heute"-Ansicht verwendet (siehe renderHabitOptions). Bei Standard-Ziel (1) exakter
// Durchreicher, keine Änderung ggü. vorher.
export function applyGoal(habit, score) {
  if (score === null || score === undefined) return null;
  const threshold = habit.goalThreshold ?? 1;
  if (threshold >= 1) return score;
  return Math.min(1, score / threshold);
}

