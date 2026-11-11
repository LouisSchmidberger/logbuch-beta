import { readTimeInput } from '../lib/calendar.js';
import { defaultHabitForm, stepEditKey, syncHabitFormFromDom, typeEditKey } from './field-form.js';
import { SECTION_COLLAPSE_MODES } from '../domain/fields.js';
import { requestRender } from '../lib/render-request.js';
import { runtime, state } from '../state/state.js';
export function readSectionFormFromDom() {
  const sf = state.sectionForm;
  const nameEl = document.getElementById('section-form-name');
  if (nameEl) sf.name = nameEl.value;
  const collapseEl = document.getElementById('section-form-collapse');
  if (collapseEl && SECTION_COLLAPSE_MODES.includes(collapseEl.value)) sf.collapse = collapseEl.value;
  const boxes = [...document.querySelectorAll('[data-section-member]')];
  if (boxes.length) sf.members = boxes.filter((b) => b.checked && !b.disabled).map((b) => b.dataset.sectionMember);
  const reminderEnabledEl = document.getElementById('section-form-reminder-enabled');
  if (reminderEnabledEl) sf.reminderEnabled = reminderEnabledEl.checked;
  const reminderTime = readTimeInput('section-form-reminder-time');
  if (reminderTime !== null) sf.reminderMinute = reminderTime;
}

function sectionFormSnapshot(sf) {
  return JSON.stringify({
    name: sf.name, collapse: sf.collapse, members: [...sf.members].sort(),
    reminderMinute: sf.reminderEnabled ? sf.reminderMinute : null,
  });
}

// --- Rückfrage beim Verlassen eines geänderten Formulars ----------------------
// Feld- und Gruppen-Formular: wer sie mit Änderungen anders als über "Abbrechen" verlässt
// (←, Wischen, Android-Zurück, Menü), wird gefragt, statt still alles zu verlieren.
// "Abbrechen" verwirft bewusst ohne Rückfrage. Verglichen wird mit dem Stand direkt nach
// dem Öffnen (form.baseline, gesetzt von markFormBaseline) - nur die gespeicherten
// Werte, keine reinen Anzeige-Zustände (Fehler, aufgeklappte Teile). Formulare ohne
// baseline (Tutorial) fragen nie: dort gibt es eigene Wege (Überspringen-Rückfrage).
function habitFormSnapshot(f) {
  const snap = {};
  for (const k of Object.keys(defaultHabitForm())) snap[k] = f[k];
  snap.labels = f.labelsEnabled ? f.labels.slice(0, f.max - f.min + 1) : null;
  snap.members = [...f.members].sort();
  snap.schedule = f.schedule.mode === 'interval'
    ? { every: f.schedule.every, start: f.schedule.start }
    : [...f.schedule.days].sort();
  if (!f.reminderEnabled) { snap.reminderTimes = null; snap.reminderBelow = null; }
  // "Stufen ändern" offen und schon etwas eingestellt (nur Öffnen zählt nicht).
  snap.stepEdit = f.stepEdit && stepEditKey(f.stepEdit) !== f.stepEdit.initial ? 'changed' : null;
  snap.typeEdit = f.typeEdit && typeEditKey(f.typeEdit) !== f.typeEdit.initial ? 'changed' : null;
  return JSON.stringify(snap);
}

// Nach dem ersten render() des Formulars aufrufen: liest es einmal aus dem DOM zurück,
// damit Normalisierungen beim Einlesen (Uhrzeit, Bezeichnungen) nicht als Änderung zählen.
export function markFormBaseline() {
  if (state.habitForm) { syncHabitFormFromDom(); state.habitForm.baseline = habitFormSnapshot(state.habitForm); }
  else if (state.sectionForm) { readSectionFormFromDom(); state.sectionForm.baseline = sectionFormSnapshot(state.sectionForm); }
}

export function openFormHasChanges() {
  const f = state.habitForm;
  if (f?.baseline) { syncHabitFormFromDom(); return habitFormSnapshot(f) !== f.baseline; }
  const sf = state.sectionForm;
  if (sf?.baseline) { readSectionFormFromDom(); return sectionFormSnapshot(sf) !== sf.baseline; }
  return false;
}

// Das Feld-Formular ist eine eigene Ebene innerhalb der Verwaltung: solange es offen
// ist, zeigt die Verwaltung NUR das Formular (kein Weiterscrollen zu den anderen
// Feldern, Titel im Seitenkopf, siehe renderManage/renderApp). Geöffnet wird es immer
// über openHabitForm, das sich die Scroll-Position merkt - closeHabitForm (einziger
// Schließ-Weg: Speichern, Abbrechen, ←-Button, Wischen, Android-Zurück) bringt einen
// genau dorthin zurück (per runtime.pendingScrollRestore, eingelöst am Ende von render()).
// Wurde es über einen Shortcut aus "Heute" geöffnet (returnToTab, lebt bewusst im
// Formular-Zustand und verschwindet so automatisch mit ihm), geht es danach direkt
// zurück zum Tab statt in der Verwaltung zu bleiben - die Absicht war dort "jetzt
// tracken", nicht "verwalten".
export function openHabitForm(form) {
  runtime.habitFormReturnScrollY = window.scrollY;
  state.habitForm = form;
  requestRender();
  markFormBaseline();
  window.scrollTo(0, 0);
  // Nur beim Neuanlegen direkt den Namen fokussieren (öffnet auf dem Handy gleich die
  // Tastatur, funktioniert nur zuverlässig synchron aus einem Klick-Handler) - ohne
  // Namen geht es dort nicht weiter. Beim Bearbeiten will man meist etwas anderes
  // ändern; dort bleibt der Fokus auf der Seitenüberschrift (siehe renderApp).
  if (!form.defId) requestAnimationFrame(() => document.getElementById('habit-form-name')?.focus());
}
