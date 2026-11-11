// Tests der Rechenlogik (Vitest: npm test). Aus dev/tests.mjs übernommen, wo sie im Browser über die
// Vorschau liefen: dieselben Fälle, Vergleich wie dort über JSON. Neue Rechenlogik -> hier einen Fall
// dazu (CLAUDE.md). Zeitzone und Sprache wie im Testbrowser: vite.config.js (test) und test-setup.js.
import { expect, test } from 'vitest';
import { SUPPORTED_KINDS, weekMoveTarget } from './data/data.js';
import { weekLastIso } from './domain/dates.js';
import { durationComputedDay, goalFromPayload, goalScore, isOpenToday, numberComputedDay, sectionDoneOn, sinceComputedDay, timeValueOn, weekGoalWeeks } from './domain/fields.js';
import { formatSeriesValue } from './domain/scores.js';
import { isOptionalAllowed, parseNumberGoal } from './features/field-form.js';
import { fieldMoveStep, remapSince, typeEditTo } from './features/type-change.js';
import { addDays, formatKey, isFutureKey, isScheduledOn, parseDateKey, startOfWeekWith } from './lib/calendar.js';
import { featureVisible } from './lib/feature-access.js';
import { STRINGS } from './lib/strings.js';
import { state } from './state/state.js';
import { multiOptionCounts } from './ui/about-view.js';
import { FIELD_TEMPLATES, PACKAGE_GROUPS, isYesNoField, mergedMultiOptions, packageDefaultChoice, packageFieldCount, templateById, templateSlotForm, templateTakeMode, templateWithExtras, yesValueOf } from './ui/templates.js';

// Vergleich wie früher über JSON; expect.soft prüft nach einem Fehlschlag weiter wie die alte Liste.
const norm = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const eq = (name, actual, expected) => expect.soft(norm(actual), name).toEqual(norm(expected));
const day = (offset) => formatKey(addDays(new Date(), offset)); // offset 0 = heute
// Vorlagen-Helfer (mehrere Abschnitte)
const slot = (id, i = 0) => { const tpl = templateById(id); return templateSlotForm(tpl, tpl.slots[i], 'x'); };
const scale = (min, max, extra = {}) => ({ kind: 'scale', min, max, labels: null, period: 'day', ...extra });

test('Tage seit', () => {
  const period = { id: 'p', kind: 'scale', min: 1, max: 4, labels: ['keine', 'leicht', 'mittel', 'stark'], good: null, period: 'day' };
  const sinceStart = { id: 's1', kind: 'computed', aggregate: 'since', members: ['p'], since: { values: [2, 3, 4], atLeast: null, mode: 'start' } };
  const sinceLast = { id: 's2', kind: 'computed', aggregate: 'since', members: ['p'], since: { values: [2, 3, 4], atLeast: null, mode: 'last' } };
  const sport = { id: 'n', kind: 'number', period: 'day' };
  const sinceNum = { id: 's3', kind: 'computed', aggregate: 'since', members: ['n'], since: { values: null, atLeast: 2, mode: 'last' } };
  state.habits = [period, sinceStart, sinceLast, sport, sinceNum];
  const e = {};
  for (const i of [50, 49, 48, 22, 21, 19, 18]) e[day(-i)] = { p: 3 }; // vor 20 vergessen
  e[day(-10)] = { p: 1 }; // "keine" zählt nicht
  e[day(-5)] = { n: 1 }; e[day(-3)] = { n: 2 };
  state.entries = e;
  const v = (h, i) => sinceComputedDay(h, day(i)).value;
  eq('seit Beginn: heute Tag 23', v(sinceStart, 0), 23);
  eq('seit Beginn: vergessener Tag beginnt nicht neu', v(sinceStart, -19), 4);
  eq('seit Beginn: Ende des vorigen Zyklus', v(sinceStart, -23), 28);
  eq('seit Beginn: Beginn selbst ist Tag 1', v(sinceStart, -22), 1);
  eq('seit dem letzten Mal: 18 Tage', v(sinceLast, 0), 18);
  eq('seit dem letzten Mal: am Tag selbst 0', v(sinceLast, -18), 0);
  eq('"keine" zählt nicht', v(sinceLast, -10), 8);
  eq('vor dem ersten Eintrag kein Wert', v(sinceLast, -60), null);
  eq('Zukunft kein Wert', v(sinceLast, 1), null);
  eq('Zahl "ab 2": 1 zählt nicht, 2 schon', [v(sinceNum, -4), v(sinceNum, 0)], [null, 3]);
  eq('Anzeige seit Beginn', formatSeriesValue(sinceStart, 23), 'Tag 23');
  eq('Anzeige seit dem letzten Mal', [0, 1, 5].map((n) => formatSeriesValue(sinceLast, n)), ['heute', '1 Tag', '5 Tage']);
});

test('Stufen ändern nimmt die zählenden Stufen mit', () => {
  const sc = { from: { min: 1, max: 4 }, to: { min: 1, max: 3 }, map: { 1: 1, 2: 2, 3: 2, 4: 3 } };
  eq('Stufen ändern: 2,3,4 -> 2,3', remapSince({ values: [2, 3, 4], mode: 'start' }, sc, false, true).values, [2, 3]);
  eq('Stufen ändern rückgängig: 2,3 -> 2,3,4', remapSince({ values: [2, 3], mode: 'start' }, sc, true, true).values, [2, 3, 4]);
  eq('Stufen ändern: entfernte Stufe fällt weg', remapSince({ values: [4] }, { ...sc, map: { 4: null } }, false, true).values, []);
  const rangeGoal = { dir: 'range', target: 5, max: 8, scope: 'day' };
  const toText = typeEditTo({ kind: 'number', goal: rangeGoal, goalRaw: rangeGoal }, { kind: 'text' });
  eq('Typ ändern: Ziel (Bereich/Woche) fällt weg', [toText.goal, toText.goalRaw], [null, null]);
});

test('Dauer', () => {
  const bed = { id: 'b', kind: 'time' }, up = { id: 'u', kind: 'time' };
  const dur = { id: 'd', kind: 'computed', aggregate: 'duration', members: ['b', 'u'] };
  state.habits = [bed, up, dur];
  state.entries = { [day(-2)]: { b: 1410 }, [day(-1)]: { u: 420, b: 1470 }, [day(0)]: { u: 450 } };
  eq('Dauer über Mitternacht (23:30 -> 7:00)', durationComputedDay(dur, day(-1)).value, 7.5);
  eq('Dauer: Bettzeit nach Mitternacht (0:30 -> 7:30)', durationComputedDay(dur, day(0)).value, 7);
});

test('Summe aus Zahlen: fehlendes Mitglied zählt als 0, keins = kein Wert', () => {
  const a = { id: 'a', kind: 'number' }, b2 = { id: 'b2', kind: 'number' };
  const sum = { id: 'sum', kind: 'computed', aggregate: 'sum', members: ['a', 'b2'] };
  state.habits = [a, b2, sum];
  state.entries = { [day(0)]: { a: 2 }, [day(-1)]: {} };
  eq('Summe mit fehlendem Mitglied', numberComputedDay(sum, day(0)).value, 2);
  eq('Summe ohne Einträge', numberComputedDay(sum, day(-1)).value, null);
});

test('Zeitpläne (synchron halten mit public.habit_scheduled_on!)', () => {
  const mon = parseDateKey('2026-10-26'); // Montag
  eq('wöchentlich Mo/Mi: Montag dran', isScheduledOn({ type: 'weekly', days: [0, 2] }, mon), true);
  eq('wöchentlich Mo/Mi: Dienstag nicht', isScheduledOn({ type: 'weekly', days: [0, 2] }, addDays(mon, 1)), false);
  eq('alle 3 Tage ab Mo: Do dran, Fr nicht', [3, 4].map((i) => isScheduledOn({ type: 'interval', every: 3, unit: 'day', start: '2026-10-26' }, addDays(mon, i))), [true, false]);
  eq('alle 3 Tage: vor dem Start nicht', isScheduledOn({ type: 'interval', every: 3, unit: 'day', start: '2026-10-26' }, addDays(mon, -3)), false);
  eq('täglich', isScheduledOn(null, mon), true);
});

test('Uhrzeit auf dem Tag', () => {
  eq('0:30 heute, eingetragen auf gestern = 1470', timeValueOn('2026-10-29', new Date(2026, 9, 30, 0, 30)), 1470);
  eq('Zukunft erkannt', [isFutureKey(day(1)), isFutureKey(day(0))], [true, false]);
});

test('Mehrfachauswahl: je Option "an n von m Tagen", m = eingetragene Tage (auch "nichts davon")', () => {
  const multi = { id: 'm', kind: 'multi', options: [{ id: 'a', label: 'Sport' }, { id: 'b', label: 'Streit' }, { id: 'c', label: 'alt', hidden: true }, { id: 'd', label: 'alt2', hidden: true }] };
  state.habits = [multi];
  state.entries = { [day(-3)]: { m: ['a', 'b'] }, [day(-2)]: { m: [] }, [day(-1)]: { m: ['a', 'c'] }, [day(0)]: {} };
  const mc = multiOptionCounts(multi, [-3, -2, -1, 0].map(day));
  eq('Mehrfachauswahl: eingetragene Tage inkl. "nichts davon"', mc.entered, 3);
  eq('Mehrfachauswahl: je Option, ausgeblendete nur mit Vorkommen', mc.options.map((o) => [o.option.id, o.n]), [['a', 2], ['b', 1], ['c', 1]]);
});

test('Schalter', () => {
  const g = [null, 'tester', 'owner'];
  eq('Stufe off', g.map((x) => featureVisible('off', x)), [false, false, false]);
  eq('Stufe owner', g.map((x) => featureVisible('owner', x)), [false, false, true]);
  eq('Stufe testers', g.map((x) => featureVisible('testers', x)), [false, true, true]);
  eq('Stufe all', g.map((x) => featureVisible('all', x)), [true, true, true]);
  eq('unbekannter Schalter ist aus', featureVisible(undefined, 'owner'), false);
});

test('Vorlagen: übernehmen', () => {
  eq('übernehmen: Skala gleiche Stufen', templateTakeMode(slot('mood'), scale(1, 5)), 'same');
  eq('übernehmen: Skala andere Stufen', templateTakeMode(slot('mood'), scale(1, 10)), 'steps');
  eq('übernehmen: freier Regler behält Bereich', templateTakeMode(slot('stress'), scale(1, 10)), 'same');
  eq('übernehmen: Regler mit Bezeichnungen -> Stufen', templateTakeMode(slot('stress'), scale(1, 4, { labels: ['a', 'b', 'c', 'd'] })), 'steps');
  eq('übernehmen: Zahl -> Zähler', templateTakeMode(slot('water'), { kind: 'number', period: 'day' }), 'counter');
  eq('übernehmen: Zeitraum-Feld nie', templateTakeMode(slot('mood'), scale(1, 5, { period: 'week' })), null);
  eq('übernehmen: archiviert nie', templateTakeMode(slot('mood'), scale(1, 5, { archivedAt: '2026-01-01' })), null);
  eq('übernehmen: Dauer nur aus Dauer', templateTakeMode(slot('sleep', 2), { kind: 'computed', aggregate: 'avg', period: 'day' }), null);
  eq('übernehmen: Uhrzeit aus Uhrzeit', templateTakeMode(slot('sleep', 0), { kind: 'time', period: 'day' }), 'same');
});

test('Vorlagen: zusammenführen', () => {
  eq('zusammenführen: Ja oben', yesValueOf(scale(1, 2, { labels: ['Nein', 'Ja'] })), 2);
  eq('zusammenführen: Ja vorn', yesValueOf(scale(0, 1, { labels: ['Ja', 'Nein'] })), 0);
  eq('zusammenführen: ohne Bezeichnungen oben', yesValueOf(scale(1, 2)), 2);
  eq('zusammenführen: nur zwei Stufen', [isYesNoField(scale(1, 2)), isYesNoField(scale(1, 3))], [true, false]);
  const merged = mergedMultiOptions([{ id: 'a', label: 'Sport' }, { id: 'b', label: 'Streit', hidden: true }],
    [{ defId: 'd1', name: 'sport?' }, { defId: 'd2', name: 'Kreatin?' }, { defId: 'd3', name: 'Streit' }]);
  eq('zusammenführen: gleichnamige Option mitbenutzt', [merged.idOf.get('d1'), merged.idOf.get('d3')], ['a', 'b']);
  eq('zusammenführen: neue Option ohne Fragezeichen', merged.options.map((o) => o.label), ['Sport', 'Streit', 'Kreatin']);
  eq('zusammenführen: ausgeblendete wieder sichtbar', merged.options[1].hidden, undefined);
  eq('Startpaket: vorausgewählt 11 Felder', packageFieldCount(packageDefaultChoice()), 11);
});

test('Vorlagen: Zusätze', () => {
  const sleepTpl = templateById('sleep');
  eq('Zusätze: ohne Auswahl nur Schlaf', templateWithExtras(sleepTpl).slots.map((x) => x.slot), ['bed', 'up', 'duration']);
  eq('Zusätze: Mittagsschlaf', templateWithExtras(sleepTpl, { nap: true }).slots.length, 6);
  eq('Zusätze: Mittagsschlaf darf leer bleiben', templateSlotForm(sleepTpl, sleepTpl.slots[4], 'x').optional, true);
});

test('Darf leer bleiben', () => {
  const opt = { id: 'o', kind: 'time', optional: true, period: 'day' };
  const req = { id: 'r', kind: 'scale', period: 'day' };
  eq('optional: leer fehlt nicht', [isOpenToday(opt, {}), isOpenToday(req, {})], [false, true]);
  eq('optional: Gruppe erledigt ohne das optionale', sectionDoneOn([opt, req], { r: 3 }), true);
  eq('optional: nur optionale = nie erledigt', sectionDoneOn([opt], {}), false);
  eq('optional: nur Tagesfelder, nicht berechnet/Zähler', ['scale', 'computed', 'counter'].map((k) => isOptionalAllowed({ kind: k, period: 'day' })).concat(isOptionalAllowed({ kind: 'scale', period: 'week' })), [true, false, false, false]);
});

test('Verschieben mit ↑/↓ über Gruppengrenzen', () => {
  const savedSections = state.sections;
  state.sections = [{ id: 'G', sortOrder: 2 }];
  const fld = (defId, sortOrder, extra = {}) => ({ id: defId, defId, kind: 'scale', period: 'day', sortOrder, sectionId: null, archivedAt: null, ...extra });
  state.habits = [fld('a', 1), fld('g1', 1, { sectionId: 'G' }), fld('g2', 2, { sectionId: 'G' }), fld('b', 3), fld('w', 4, { period: 'week' })];
  const mv = (id, dir) => { const r = fieldMoveStep(id, dir); return r && [r.sectionId, r.items.map((x) => x.id + ('sectionId' in x ? '>' + x.sectionId : ''))]; };
  eq('↓ vor Gruppe: an den Anfang der Gruppe', mv('a', 'down'), ['G', ['a>G', 'g1', 'g2']]);
  eq('↑ unter Gruppe: ans Ende der Gruppe', mv('b', 'up'), ['G', ['g1', 'g2', 'b>G']]);
  eq('↑ erstes in Gruppe: davor hinaus', mv('g1', 'up'), [null, ['a', 'g1>null', 'G', 'b', 'w']]);
  eq('↓ letztes in Gruppe: dahinter hinaus', mv('g2', 'down'), [null, ['a', 'G', 'g2>null', 'b', 'w']]);
  eq('innerhalb der Gruppe tauschen', mv('g1', 'down'), ['G', ['g2', 'g1']]);
  eq('Zeitraum-Feld springt über die Gruppe', mv('w', 'up'), [null, ['a', 'G', 'w', 'b']]);
  eq('ganz oben geht nicht weiter', mv('a', 'up'), null);
  state.sections = savedSections;
});

test('Wochenbeginn (synchron mit public.habit_period_start / habit_week_last_isodow)', () => {
  const wk = (key, iso) => formatKey(startOfWeekWith(parseDateKey(key), iso));
  eq('Woche ab Montag', ['2026-11-09', '2026-11-12', '2026-11-15'].map((k) => wk(k, 1)), ['2026-11-09', '2026-11-09', '2026-11-09']);
  eq('Woche ab Sonntag', ['2026-11-08', '2026-11-14', '2026-11-15'].map((k) => wk(k, 7)), ['2026-11-08', '2026-11-08', '2026-11-15']);
  eq('Woche ab Samstag', ['2026-11-07', '2026-11-13', '2026-11-14'].map((k) => wk(k, 6)), ['2026-11-07', '2026-11-07', '2026-11-14']);
  eq('letzter Tag der Woche', [1, 7, 6].map((i) => weekLastIso(i)), [7, 6, 5]);
  eq('Umzug Mo -> So: Woche mit dem mittleren Tag', weekMoveTarget('2026-11-09', 7), '2026-11-08');
  eq('Umzug So -> Mo', weekMoveTarget('2026-11-08', 1), '2026-11-09');
  eq('Umzug Mo -> Sa', weekMoveTarget('2026-11-09', 6), '2026-11-07');
  eq('Umzug Sa -> So', weekMoveTarget('2026-11-07', 7), '2026-11-08');
});

test('Ziele: Bereich und Wochensumme (G3)', () => {
  eq('Ziel aus good/target (alte Form)', goalFromPayload('number', { good: 'high', target: 8 }), { dir: 'high', target: 8, max: null, scope: 'day' });
  eq('berechnet: good allein ist kein Ziel', goalFromPayload('computed', { good: 'high', target: 8 }), null);
  eq('Bereich aus numberGoal', goalFromPayload('computed', { numberGoal: { dir: 'range', target: 7, max: 9, scope: 'week' } }), { dir: 'range', target: 7, max: 9, scope: 'day' });
  eq('Bereich mit Obergrenze unter Untergrenze verworfen', goalFromPayload('number', { numberGoal: { dir: 'range', target: 9, max: 7 } }), null);
  eq('Wochenziel', goalFromPayload('number', { numberGoal: { dir: 'high', target: 150, scope: 'week' } }), { dir: 'high', target: 150, max: null, scope: 'week' });
  const range = { dir: 'range', target: 7, max: 9 };
  eq('Bereich: Score', [3.5, 7, 8, 9, 13.5, 18].map((v) => Math.round(goalScore(range, v) * 100) / 100), [0.5, 1, 1, 1, 0.5, 0]);
  eq('Formular: Bereich ohne Obergrenze', !!parseNumberGoal({ numberGoalDir: 'range', numberGoalValue: '7', numberGoalMax: '', period: 'day' }).notice, true);
  eq('Formular: Wochenziel nur bei Tagesfeldern', parseNumberGoal({ numberGoalDir: 'high', numberGoalValue: '2', numberGoalScope: 'week', period: 'month' }).goal.scope, 'day');
  eq('Formular: Komma', parseNumberGoal({ numberGoalDir: 'low', numberGoalValue: '7,5', period: 'day' }).goal.target, 7.5);
  const wg = { id: 'mv', kind: 'number', period: 'day', goal: { dir: 'high', target: 150, max: null, scope: 'week' } };
  state.habits = [wg];
  state.entries = { '2026-10-05': { mv: 50 }, '2026-10-07': { mv: 60 }, '2026-10-11': { mv: 50 }, '2026-10-14': { mv: 100 } };
  const oct = Array.from({ length: 31 }, (_, i) => `2026-10-${String(i + 1).padStart(2, '0')}`);
  eq('Wochenziel: bewertete Wochen im Monat', weekGoalWeeks(wg, oct).filter((w) => w.judged).map((w) => [w.start, w.sum, w.score >= 0.999]), [['2026-10-05', 160, true], ['2026-10-12', 100, false]]);
  eq('Wochenziel: Woche über den Monatswechsel zählt im Monat ihres Endes', weekGoalWeeks(wg, oct).find((w) => w.start === '2026-10-26')?.judged, false);
});

test('Texte', () => {
  // Gleiche Schlüssel in derselben Reihenfolge (CLAUDE.md), und die dynamisch gebauten gibt es.
  eq('Texte: de und en gleiche Schlüssel', Object.keys(STRINGS.en), Object.keys(STRINGS.de));
  const needed = [
    ...SUPPORTED_KINDS.map((k) => 'tutorial.form.tip.' + k),
    ...FIELD_TEMPLATES.flatMap((x) => [`tpl.${x.id}.name`, `tpl.${x.id}.note`, ...(x.direct ? [] : [`tpl.${x.id}.explain`]),
      ...(x.slots.length > 1 ? x.slots.map((s) => `tpl.${x.id}.${s.slot}`) : [])]),
    ...PACKAGE_GROUPS.flatMap((g) => [`pkg.group.${g.id}`, ...g.items.flatMap((it) => [`pkg.item.${it.id}`, it.nameKey || `tpl.${it.tpl || it.id}.name`])]),
  ];
  eq('Texte: dynamische Schlüssel vorhanden', needed.filter((k) => !(k in STRINGS.de)), []);
});
