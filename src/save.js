import { supabase } from './config.js';
import { decryptData, encryptData } from './crypto.js';
import { DEF_PLAINTEXT_CLEARED, activeHabits, counterReminderThresholds, isCounterKind, isTextKind } from './fields.js';
import { entryKeyFor, isPlannedOn } from './dates.js';
import { currentDek, runtime, state } from './state.js';
import { t, tPlain } from './i18n.js';
import { haptic } from './theme.js';
import { errorNotice } from './errors.js';
import { formatKey, isPeriodField } from './calendar.js';
import { refreshOpenMarkers, renderUnlessTyping, requestRender } from './render-request.js';

// --- Notizen ---------------------------------------------------------------
// Liegen verschlüsselt im selben Tagesobjekt wie die Werte, unter EINEM reservierten
// Schlüssel: { mood: 3, _notes: { mood: "…", _day: "…" } }. Kann nie mit einem Feld
// kollidieren: Feld-Schlüssel bestehen nur aus a-z0-9 (alte aus dem Namen abgeleitete
// wie "mood", neue zufällige aus newHabitKey). Alles mit "_" am Anfang ist dadurch
// "kein Feldwert" - wichtig v.a. für filled_slugs (siehe filledFieldIds): eine Notiz
// allein zählt für die Erinnerungen nicht als eingetragen. Die Werte-Logik (Scores,
// Graphen, habitHasData, ...) greift immer gezielt per Feld-Schlüssel zu und sieht den
// Notiz-Schlüssel nie.
export const NOTES_KEY = '_notes';
export const DAY_NOTE_KEY = '_day';
// Notizen zu einer Gruppe: unter 'section:<id>' (gleicher Schlüssel wie ihr Zeilen-Menü).
// Kollidiert nie mit Feld-Schlüsseln (nur a-z0-9) oder _day.
export const SECTION_NOTE_PREFIX = 'section:';
// Eine Gruppe steht in "Heute" nur, wenn heute mindestens eines ihrer aktiven Felder
// geplant ist (siehe renderToday/renderBySection) - nur dann ist ihre Notiz sichtbar.
export function sectionShownToday(sectionId) {
  return state.sections.some((sec) => sec.id === sectionId)
    && activeHabits().some((h) => h.sectionId === sectionId && isPlannedOn(h, state.currentDate));
}
export function keyHasNotes(key) {
  return Object.values(state.entries).some((day) => day?.[NOTES_KEY]?.[key] !== undefined);
}
export function getNote(dateKey, key) {
  return state.entries[dateKey]?.[NOTES_KEY]?.[key] ?? '';
}
export function dayHasNote(dateKey) {
  return Object.keys(state.entries[dateKey]?.[NOTES_KEY] ?? {}).length > 0;
}
// Gibt das Tagesobjekt mit gesetzter (bzw. bei leerem Text entfernter) Notiz zurück -
// ohne verbleibende Notizen verschwindet auch der _notes-Schlüssel selbst wieder.
export function withNote(day, key, text) {
  const notes = { ...(day[NOTES_KEY] || {}) };
  if (text) notes[key] = text;
  else delete notes[key];
  const next = { ...day };
  if (Object.keys(notes).length) next[NOTES_KEY] = notes;
  else delete next[NOTES_KEY];
  return next;
}
// Sicherung der Werte von vor "Stufen ändern" (siehe runStepChange): im selben Tagesobjekt
// unter { _prev: { <Feld>: { c: <Umstellungs-Id>, v: <alter Wert> } } }. Wie bei withNote
// verschwindet _prev ohne Inhalt wieder; backup undefined entfernt den Eintrag des Felds.
export const PREV_KEY = '_prev';
export function withPrev(day, key, backup) {
  const prev = { ...(day[PREV_KEY] || {}) };
  if (backup !== undefined) prev[key] = backup;
  else delete prev[key];
  const next = { ...day };
  if (Object.keys(prev).length) next[PREV_KEY] = prev;
  else delete next[PREV_KEY];
  return next;
}
export const NOTE_MAX_LENGTH = 2000;
// Schreibt den Entwurf eines offenen Editors in den Tages-Eintrag (nur wenn er sich
// vom gespeicherten Stand unterscheidet), ohne den Editor zu schließen.
function persistNoteDraft() {
  const ed = state.noteEditor;
  if (!ed) return;
  const text = ed.draft.trim().slice(0, NOTE_MAX_LENGTH);
  if (text === getNote(ed.dateKey, ed.key)) return;
  const day = withNote(state.entries[ed.dateKey] || {}, ed.key, text);
  state.entries = { ...state.entries, [ed.dateKey]: day };
  saveDay(ed.dateKey);
}
// Speichern und schließen. Außer über den Speichern-Button auch immer dann, wenn der
// Editor nicht mehr sichtbar ist (Tag-/Tab-Wechsel, anderer Editor geöffnet, siehe
// render()) - Getipptes soll nie still verloren gehen oder unbemerkt ungespeichert
// herumliegen. Auch Android-Zurück speichert (closeTopLayer); nur "Abbrechen" verwirft bewusst.
export function commitPendingNoteDraft() {
  persistNoteDraft();
  state.noteEditor = null;
}
// Abbrechen: stellt den Stand von vor dem Öffnen wieder her - nötig, weil ein Wechsel
// in eine andere App den Entwurf zwischendurch schon gespeichert haben kann (siehe
// visibilitychange-Listener).
function discardNoteDraft() {
  const ed = state.noteEditor;
  if (!ed) return;
  state.noteEditor = null;
  if (getNote(ed.dateKey, ed.key) === ed.original) return;
  const day = withNote(state.entries[ed.dateKey] || {}, ed.key, ed.original);
  state.entries = { ...state.entries, [ed.dateKey]: day };
  saveDay(ed.dateKey);
}
export function openNoteEditor(key) {
  const dateKey = entryKeyFor(key, formatKey(state.currentDate)); // Notiz eines Zeitraum-Felds: am Zeitraum
  // Schon offen (z.B. erneut über das Zeilen-Menü gewählt, während man darin schreibt):
  // nichts neu anlegen, nur zurück ins Textfeld - sonst passierte scheinbar gar nichts.
  if (!(state.noteEditor?.dateKey === dateKey && state.noteEditor.key === key)) {
    commitPendingNoteDraft();
    const original = getNote(dateKey, key);
    state.noteEditor = { dateKey, key, draft: original, original };
  }
  requestRender();
  const input = document.getElementById('note-input');
  if (input) {
    input.focus({ preventScroll: true });
    input.setSelectionRange(input.value.length, input.value.length);
    ensureNoteEditorVisible();
  }
}
// Hält Textfeld + Speichern/Abbrechen im sichtbaren Bereich, auch wenn die
// Bildschirmtastatur aufgeht: die verkleinert auf Android/iOS nur den *visuellen*
// Viewport (window.visualViewport), nicht das Layout - scrollIntoView() allein weiß
// davon nichts und ließ den Editor unter der Tastatur. Deshalb von Hand gegen die
// visualViewport-Maße gerechnet, aufgerufen beim Öffnen und bei jeder Größenänderung
// des visuellen Viewports (Tastatur geht auf), solange die Textarea den Fokus hat.
// Oben zusätzlich der angepinnte Header (.sticky-top), unter dem nichts landen soll.
// Unterkante des angepinnten Kopfs (Header + Tab-Leiste) - 0, wenn er gerade nicht
// angepinnt ist (wenig Höhe, siehe @media max-height in logbuch.css): dann verdeckt er
// nichts, und seine Position beim Scrollen spielt keine Rolle.
export function stickyHeaderBottom() {
  const el = document.querySelector('.sticky-top');
  if (!el || getComputedStyle(el).position !== 'sticky') return 0;
  return Math.max(0, el.getBoundingClientRect().bottom);
}
function ensureNoteEditorVisible() {
  const editor = document.querySelector('.note-editor');
  if (!editor || document.activeElement?.id !== 'note-input') return;
  const vv = window.visualViewport;
  const viewTop = (vv ? vv.offsetTop : 0) + (stickyHeaderBottom());
  const viewBottom = vv ? vv.offsetTop + vv.height : window.innerHeight;
  const margin = 12;
  const r = editor.getBoundingClientRect();
  if (r.bottom + margin > viewBottom) window.scrollBy(0, Math.min(r.bottom + margin - viewBottom, r.top - viewTop - margin));
  else if (r.top - margin < viewTop) window.scrollBy(0, r.top - margin - viewTop);
}
// Die Tastatur fährt animiert auf und feuert dabei mehrere resize-Events - beim ersten
// ist sie oft erst halb offen. Deshalb sofort UND nach dem Ende der Animation (kein
// weiteres resize mehr für 250ms) nachrechnen, sonst blieb ein Teil verdeckt.
let noteEditorSettleTimer = null;
function onViewportResize() {
  ensureNoteEditorVisible();
  clearTimeout(noteEditorSettleTimer);
  noteEditorSettleTimer = setTimeout(ensureNoteEditorVisible, 250);
}
// Speichern UND Abbrechen: danach zurück auf das Element, von dem aus man gekommen ist
// (⋮-Button des Feldes bzw. der Tagesnotiz-Bereich), da render() den Fokus sonst verwirft.
// Der Entwurf ist über den 'input'-Listener immer aktuell in state.noteEditor.draft.
export function closeNoteEditor(save) {
  const { key } = state.noteEditor;
  if (save) commitPendingNoteDraft();
  else discardNoteDraft();
  requestRender();
  const focusTarget = key === DAY_NOTE_KEY
    ? document.querySelector('.day-note [data-action="note-edit"]')
    : document.querySelector(`.row-menu-trigger[data-menu="${key}"]`);
  focusTarget?.focus({ preventScroll: true });
}

// Für filled_slugs (Erinnerungen): die IDs der Felder mit Wert an dem Tag - nicht ihre
// Schlüssel (bei alten Feldern aus dem Namen abgeleitet, z.B. "gekifft"). Notizen
// (_-Schlüssel) und Werte endgültig gelöschter Felder fallen weg.
function filledFieldIds(dayData) {
  return Object.keys(dayData)
    .filter((k) => !k.startsWith('_'))
    .map((k) => (state.habits.find((h) => h.id === k) || state.unsupportedHabits.find((h) => h.id === k))?.defId)
    .filter(Boolean);
}

// Für reminder_progress (Erinnerungen an Zähler, Nutzer-Entscheidung 2026-10-28): je Zähler
// mit eigenen Zeiten und Bedingungen ("falls weniger als", counterReminderThresholds), wie
// viele davon erfüllt sind - Stufe i ist erreicht, sobald der Zählerstand die i-te Zahl
// erreicht. Der Server sieht nur die Stufe, nicht Zählerstand oder Zahlen. Zähler ohne
// Bedingungen fehlen hier: die erinnern zu jeder ihrer Zeiten (Stufe 0).
function reminderProgress(dayData) {
  const progress = {};
  for (const h of state.habits) {
    if (!isCounterKind(h) || isPeriodField(h) || h.archivedAt || !h.reminderTimes.length) continue;
    const thresholds = counterReminderThresholds(h);
    if (thresholds.some((x) => x === null)) continue;
    const count = Number(dayData[h.id]) || 0;
    let reached = 0;
    while (reached < thresholds.length && count >= thresholds[reached]) reached++;
    progress[h.defId] = reached;
  }
  return progress;
}

// Ändert einzelne verschlüsselte Eigenschaften eines bestehenden Felds (außerhalb des
// Feld-Formulars, z.B. "In der Auswertung anzeigen" bei archivierten Feldern): baut die
// vollständige payload aus dem Feld-Objekt, verschlüsselt neu und speichert sie. Leert
// dabei vorsorglich die Klartext-Spalten (falls das Feld noch unverschlüsselt war).
export async function updateHabitPayload(habit, changes) {
  const next = { ...habit, ...changes };
  const payload = {
    key: next.id, name: next.name, unit: next.unit ?? null, min: next.min ?? null, max: next.max ?? null,
    labels: next.labels ?? null, good: next.good ?? null, displayStyle: next.displayStyle ?? 'buttons',
    sliderShowValue: next.sliderShowValue ?? true, groupMembers: next.members ?? null,
    goalThreshold: next.goalThreshold ?? null, aggregate: next.aggregate ?? null, since: next.since ?? undefined, options: next.options ?? undefined,
    hideInStats: !!next.hideInStats, archivedInStats: !!next.archivedInStats,
    // Ohne diese gingen Ziel/Schritt/Summe einer Zahl bzw. eines Zählers hier still verloren.
    step: isCounterKind(next) ? next.step : undefined, target: next.target ?? undefined, numberGoal: next.goalRaw ?? undefined,
    summary: next.summary === 'sum' ? 'sum' : undefined, counterSince: next.counterSince ?? undefined,
    reminderBelow: next.reminderBelow ?? undefined, stepChange: next.stepChange ?? undefined,
  };
  const enc = await encryptData(currentDek, payload);
  // Typwechsel (siehe startStepChange): kind steht im Klartext, weil die Erinnerungen ihn brauchen.
  const kindChange = next.kind !== habit.kind ? { kind: next.kind } : {};
  const { error } = await supabase.from('habit_definitions').update({ enc, ...DEF_PLAINTEXT_CLEARED, ...kindChange }).eq('id', habit.defId);
  if (error) {
    state.notice = errorNotice('notice.saveFailed', error.message);
    requestRender();
    return false;
  }
  state.habits = state.habits.map((h) => (h.defId === habit.defId ? next : h));
  requestRender();
  return true;
}

// --- Speichern eines Tages -------------------------------------------------
// Ein Tag ist EIN verschlüsseltes Objekt (alle Werte + Notizen). Zwei Gefahren dabei:
// 1. Mehrere Geräte: ein Gerät mit veraltetem Stand (App seit gestern im Hintergrund
//    offen) würde beim Speichern die inzwischen anderswo eingetragenen Werte des Tages
//    still überschreiben. Deshalb wird vor jedem Schreiben die aktuelle Zeile geholt; hat
//    sie sich seit unserem letzten bekannten Stand (syncedEntries, erkennbar am IV) geändert,
//    werden beide Stände Schlüssel für Schlüssel zusammengeführt (mergeDay).
// 2. Schnelle Änderungen hintereinander: jede ist ein eigener Request - kämen sie in
//    falscher Reihenfolge an, bliebe der ältere Stand gespeichert. Deshalb laufen die
//    Speicherungen eines Tages nacheinander (daySaveChains), und jede schreibt den dann
//    AKTUELLEN Stand aus state.entries (Aufrufer ändern state.entries immer vorher) - keine
//    ältere Momentaufnahme.
export const syncedEntries = new Map(); // dateKey -> { day, iv } - zuletzt bekannter Server-Stand
const daySaveChains = new Map(); // dateKey -> Promise der letzten eingereihten Speicherung
export function saveDay(dateKey) {
  const prev = daySaveChains.get(dateKey) || Promise.resolve();
  const next = prev.then(() => saveDayNow(dateKey));
  daySaveChains.set(dateKey, next);
  next.finally(() => { if (daySaveChains.get(dateKey) === next) daySaveChains.delete(dateKey); });
  return next;
}
// Rückgabe: true = gespeichert (gebraucht von runStepChange, die anderen Aufrufer melden
// Fehler nur über die Meldung).
export async function saveDayNow(dateKey) {
  if (runtime.undecryptableEntryDates.has(dateKey)) {
    state.entries = { ...state.entries, [dateKey]: {} }; // die Änderung nicht stehen lassen - sie ist ja nicht gespeichert
    state.notice = { type: 'error', text: t('notice.dayUndecryptable') };
    requestRender();
    return false;
  }
  if (!currentDek || !state.session) return false; // inzwischen abgemeldet / Schlüssel verworfen
  try {
    const { data: row, error: fetchErr } = await supabase.from('habit_entries')
      .select('data').eq('entry_date', dateKey).maybeSingle();
    if (fetchErr) throw fetchErr;
    const base = syncedEntries.get(dateKey) || { day: {}, iv: null };
    let day = state.entries[dateKey] || {};
    if ((row?.data?.iv ?? null) !== base.iv) {
      // Seit unserem letzten Stand hat ein anderes Gerät diesen Tag gespeichert.
      let server;
      try {
        server = row?.data ? await decryptData(currentDek, row.data) : {};
      } catch {
        runtime.undecryptableEntryDates.add(dateKey);
        return saveDayNow(dateKey); // -> Meldung, nichts überschreiben
      }
      day = mergeDay(base.day, day, server);
      state.entries = { ...state.entries, [dateKey]: day };
      renderUnlessTyping();
    }
    if (!currentDek) return false;
    const encrypted = await encryptData(currentDek, day);
    const { error } = await supabase
      .from('habit_entries')
      .upsert(
        { user_id: state.session.user.id, entry_date: dateKey, data: encrypted, filled_slugs: filledFieldIds(day), reminder_progress: reminderProgress(day) },
        { onConflict: 'user_id,entry_date' }
      );
    if (error) throw error;
    syncedEntries.set(dateKey, { day, iv: encrypted.iv });
    return true;
  } catch (err) {
    state.notice = errorNotice('notice.saveFailed', err?.message || String(err));
    requestRender();
    return false;
  }
}
// Dreiwege-Zusammenführung eines Tages: was WIR seit dem gemeinsamen Stand (base)
// geändert haben, gewinnt; alles andere kommt vom Server (die Änderungen des anderen
// Geräts). Pro Feld-Schlüssel und pro Notiz einzeln.
function mergeDay(base, local, server) {
  const pick = (b, l, s) => {
    const out = {};
    for (const k of new Set([...Object.keys(b), ...Object.keys(l), ...Object.keys(s)])) {
      if (k === NOTES_KEY) continue;
      const v = JSON.stringify(l[k]) !== JSON.stringify(b[k]) ? l[k] : s[k];
      if (v !== undefined) out[k] = v;
    }
    return out;
  };
  const merged = pick(base, local, server);
  const notes = pick(base[NOTES_KEY] || {}, local[NOTES_KEY] || {}, server[NOTES_KEY] || {});
  if (Object.keys(notes).length) merged[NOTES_KEY] = notes;
  return merged;
}

// Ein entfernter Wert lässt sich über die Meldung wiederherstellen. Gilt für alle: wer
// einen Wert "zur Sicherheit nochmal antippt", entfernt ihn (Umschalten, siehe
// handleSelect) - vorher ging er dabei still verloren.
function offerUndoRemoval(dateKey, habitId, previous) {
  const habit = state.habits.find((h) => h.id === habitId);
  state.notice = {
    type: 'ok',
    text: tPlain('notice.valueRemoved', { name: habit?.name ?? '' }),
    action: {
      label: t('notice.undo'),
      run: () => {
        const day = { ...(state.entries[dateKey] || {}) };
        if (day[habitId] !== undefined) return; // inzwischen neu eingetragen
        day[habitId] = previous;
        state.entries = { ...state.entries, [dateKey]: day };
        requestRender();
        saveDay(dateKey);
      },
    },
  };
}

export function handleSelect(dateKey, habitId, value) {
  dateKey = entryKeyFor(habitId, dateKey);
  const day = { ...(state.entries[dateKey] || {}) };
  if (day[habitId] === value) {
    delete day[habitId];
    offerUndoRemoval(dateKey, habitId, value);
  } else day[habitId] = value;
  state.entries = { ...state.entries, [dateKey]: day };
  haptic();
  requestRender();
  saveDay(dateKey);
}

// Mehrfachauswahl: optionId = Option an-/abwählen, null = "nichts davon" (nochmal = wieder leer).
// Wird die letzte Option abgewählt, ist das Feld wieder offen (wie das Abwählen einer Stufe);
// "nichts davon" ist eine bewusste Angabe und steht deshalb für sich.
export function handleMultiToggle(dateKey, habitId, optionId) {
  dateKey = entryKeyFor(habitId, dateKey);
  const day = { ...(state.entries[dateKey] || {}) };
  const prev = Array.isArray(day[habitId]) ? day[habitId] : null;
  let next;
  if (optionId === null) next = prev?.length === 0 ? null : [];
  else {
    next = prev?.includes(optionId) ? prev.filter((x) => x !== optionId) : [...(prev || []), optionId];
    if (!next.length) next = null;
  }
  if (next) day[habitId] = next;
  else {
    delete day[habitId];
    if (prev) offerUndoRemoval(dateKey, habitId, prev);
  }
  state.entries = { ...state.entries, [dateKey]: day };
  haptic();
  requestRender();
  saveDay(dateKey);
}

// Schieberegler: setzt immer (nie das Umschalten von handleSelect, wo derselbe Wert
// ein zweites Mal den Eintrag entfernt - beim Regler ist "loslassen auf demselben Wert"
// keine Absicht zum Löschen, dafür gibt es das ×). Idempotent, da der Regler-Commit auf
// zwei Wegen ankommen kann (siehe 'change' und 'pointerup' weiter unten).
export function handleSetValue(dateKey, habitId, value) {
  dateKey = entryKeyFor(habitId, dateKey);
  const day = { ...(state.entries[dateKey] || {}) };
  if (day[habitId] === value) return;
  day[habitId] = value;
  state.entries = { ...state.entries, [dateKey]: day };
  haptic();
  requestRender();
  saveDay(dateKey);
}

// Text-Felder (kind='text'): jeder Tastendruck aktualisiert sofort state.entries (ohne
// render() - das würde Fokus/Cursor stören; ein anderweitig ausgelöster Re-Render zeigt
// so trotzdem immer den aktuellen Text), gespeichert wird aber erst, wenn eine Sekunde
// lang nicht mehr getippt wurde - sonst ein verschlüsselter Upsert pro Buchstabe.
// Sofort gespeichert wird zusätzlich beim Verlassen des Feldes ('change'), beim
// Wechsel in eine andere App und beim Abmelden (flushAllDaySaves).
const TEXT_SAVE_DELAY_MS = 1000;
const pendingDaySaves = new Map(); // dateKey -> Timer
export function updateTextValue(dateKey, habitId, raw) {
  dateKey = entryKeyFor(habitId, dateKey);
  const day = { ...(state.entries[dateKey] || {}) };
  if (raw.trim()) day[habitId] = raw.slice(0, NOTE_MAX_LENGTH);
  else delete day[habitId];
  state.entries = { ...state.entries, [dateKey]: day };
  refreshOpenMarkers();
  clearTimeout(pendingDaySaves.get(dateKey));
  pendingDaySaves.set(dateKey, setTimeout(() => flushDaySave(dateKey), TEXT_SAVE_DELAY_MS));
}
export function flushDaySave(dateKey) {
  if (!pendingDaySaves.has(dateKey)) return;
  clearTimeout(pendingDaySaves.get(dateKey));
  pendingDaySaves.delete(dateKey);
  if (!currentDek || !state.session) return;
  saveDay(dateKey);
}
export function flushAllDaySaves() {
  [...pendingDaySaves.keys()].forEach(flushDaySave);
}
// Verwirft ausstehende Speicherungen ungesendet (veralteter Schlüssel, checkDekStillCurrent).
export function dropPendingDaySaves() {
  pendingDaySaves.forEach((timer) => clearTimeout(timer));
  pendingDaySaves.clear();
}

// Löscht Werte UND Notizen des Tages - deshalb immer erst nach Rückfrage
// (renderResetConfirm), nie direkt über den Button.
export function handleReset(dateKey) {
  state.entries = { ...state.entries, [dateKey]: {} };
  if (state.noteEditor?.dateKey === dateKey) state.noteEditor = null;
  requestRender();
  saveDay(dateKey);
}

// Einzelnen Eintrag löschen (nicht den ganzen Tag) — für den Slider gebraucht, der
// anders als Buttons (nochmal klicken) oder Zahlenfeld (leeren) sonst keine
// Möglichkeit hat, einen Wert wieder auszutragen.
export function handleClearValue(dateKey, habitId) {
  dateKey = entryKeyFor(habitId, dateKey);
  const day = { ...(state.entries[dateKey] || {}) };
  if (day[habitId] !== undefined) offerUndoRemoval(dateKey, habitId, day[habitId]);
  delete day[habitId];
  state.entries = { ...state.entries, [dateKey]: day };
  haptic();
  requestRender();
  saveDay(dateKey);
}

// Zähler um einen Schritt ändern; nie unter 0. Auf 0 heruntergezählt = kein Eintrag (gilt
// ohnehin als 0). Gerundet, damit z.B. 0,1-Schritte keine Fließkomma-Reste ansammeln.
export function handleCounterStep(dateKey, habitId, dir) {
  dateKey = entryKeyFor(habitId, dateKey);
  const h = state.habits.find((x) => x.id === habitId);
  if (!h) return;
  const day = { ...(state.entries[dateKey] || {}) };
  const next = Math.max(0, Math.round(((day[habitId] ?? 0) + dir * h.step) * 1e6) / 1e6);
  if (next === 0) delete day[habitId]; else day[habitId] = next;
  state.entries = { ...state.entries, [dateKey]: day };
  haptic();
  requestRender();
  saveDay(dateKey);
}

export function handleSaveNumber(dateKey, habitId, rawValue) {
  dateKey = entryKeyFor(habitId, dateKey);
  const day = { ...(state.entries[dateKey] || {}) };
  const trimmed = String(rawValue).trim().replace(',', '.');
  if (trimmed === '') {
    delete day[habitId];
  } else {
    const num = Number(trimmed);
    // Number statt parseFloat: "12abc" ist keine Zahl; isFinite: "1e400" wäre Infinity und
    // würde als null gespeichert (JSON kennt kein Infinity).
    if (!Number.isFinite(num)) {
      state.notice = { type: 'error', text: t('notice.invalidNumber') };
      requestRender();
      return;
    }
    day[habitId] = num;
  }
  state.entries = { ...state.entries, [dateKey]: day };
  requestRender();
  saveDay(dateKey);
}

export function findLastValue(habitId, beforeOrOnDateKey) {
  const keys = Object.keys(state.entries)
    .filter((k) => k <= beforeOrOnDateKey && state.entries[k]?.[habitId] !== undefined)
    .sort();
  if (!keys.length) return null;
  const lastKey = keys[keys.length - 1];
  return { dateKey: lastKey, value: state.entries[lastKey][habitId] };
}

// --- Stufen ändern (Skala mit Einträgen) -------------------------------------
// Nutzer-Entscheidung 2026-10-29: die Anzahl Stufen einer Skala mit Einträgen ist änderbar,
// was aus den bisherigen Werten wird, entscheidet man selbst (je alte Stufe eine neue oder
// "entfernen"). Die alten Werte bleiben als Sicherung im selben Tages-Eintrag (withPrev) -
// nicht als archiviertes Zweitfeld: archivierte Felder rechnen in die Tagesfarbe mit
// (dayOverallScore), alte Tage zählten doppelt.
// Ablauf über h.stepChange (verschlüsselt in enc): state 'apply' (Definition noch "from") ->
// Tage umschreiben -> Definition "to", state 'done'. Rückgängig: state 'undo' -> Tage aus der
// Sicherung -> Definition "from", stepChange null. Jeder Tag schreibt Wert und Sicherung in
// einem Zug, und welche Tage fertig sind, steht in den Tagen selbst (_prev.c) - ein Abbruch
// (Netz weg, App zu) läuft beim nächsten Laden weiter (resumeStepChanges).
const STEP_CHANGE_PARALLEL = 6;

// Schreibt alle noch offenen Tage einer laufenden Umstellung (bzw. Rückgängig) und setzt danach
// die Definition. Rückgabe: true = fertig. Fortschritt direkt ins DOM (#step-change-progress),
// ohne render() je Tag.
// Schreibt viele Tage um (Stufen/Typ ändern, Felder zusammenführen): transform(day, dateKey) gibt
// den neuen Tag zurück, je STEP_CHANGE_PARALLEL Tage gleichzeitig. Ein nicht gespeicherter Tag
// bekommt seinen alten Stand zurück - sonst hielte ein zweiter Lauf ihn für fertig.
export async function rewriteDays(dateKeys, transform, onProgress = () => {}) {
  let done = 0, failed = 0;
  const queue = [...dateKeys];
  onProgress(0, dateKeys.length);
  const worker = async () => {
    while (queue.length) {
      const dateKey = queue.shift();
      const before = state.entries[dateKey];
      const changed = transform(before || {}, dateKey);
      state.entries = { ...state.entries, [dateKey]: changed };
      if (await saveDay(dateKey)) done++;
      else {
        failed++;
        if (state.entries[dateKey] === changed) {
          const { [dateKey]: _, ...rest } = state.entries;
          state.entries = before === undefined ? rest : { ...state.entries, [dateKey]: before };
        }
      }
      onProgress(done + failed, dateKeys.length);
    }
  };
  await Promise.all(Array.from({ length: STEP_CHANGE_PARALLEL }, worker));
  return { done, failed };
}

// Der Notiz-Editor gehört zu einem bestimmten Tag in "Heute" und ist nur offen, solange
// er dort auch sichtbar ist - wechselt man Tag/Tab, speichert render() den Entwurf und
// schließt ihn (siehe commitPendingNoteDraft).
// Zusätzlich muss das Feld selbst noch in "Heute" stehen - wird es z.B. über das
// Zeilen-Menü archiviert, während seine Notiz offen ist, wäre der Editor sonst
// unsichtbar, zählte aber weiter als offene Ebene.
export function isNoteEditorOpen() {
  const ed = state.noteEditor;
  if (!ed || state.view !== 'today' || ed.dateKey !== entryKeyFor(ed.key, formatKey(state.currentDate))) return false;
  if (ed.key === DAY_NOTE_KEY) return true;
  if (ed.key.startsWith(SECTION_NOTE_PREFIX)) return sectionShownToday(ed.key.slice(SECTION_NOTE_PREFIX.length));
  return activeHabits().some((h) => h.id === ed.key && !isTextKind(h));
}

// Was beim Start einmal laufen muss (Event-Listener u.ä.). Nicht beim Laden des Moduls, sondern
// vom Einstieg (main.js) aufgerufen, in fester Reihenfolge, wenn alle Module geladen sind.
export function initSave() {
  window.visualViewport?.addEventListener('resize', onViewportResize);
  window.addEventListener('resize', onViewportResize);
  // Beim Wechsel in eine andere App (oder Sperren des Handys) den Entwurf schon mal
  // sichern - der Browser kann die Seite im Hintergrund jederzeit verwerfen. Der Editor
  // bleibt dabei offen, man schreibt nach der Rückkehr einfach weiter.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { persistNoteDraft(); flushAllDaySaves(); }
  });
}
