import { currentDek, restoreModalFocus, runtime, state } from '../state/state.js';
import { closeModals, isOverlayOpen } from './navigation.js';
import { haptic, setDayProgressShown, setHapticsDisabled, setPatternDisabled } from '../lib/theme.js';
import { AUTH_MIN_PASSWORD_LENGTH } from '../lib/format.js';
import { runWeekStartChange, saveLocale, saveSummaryNotifications } from '../data/data.js';
import { handleEmailChangeSubmit, handlePasswordChangeSubmit, handleSpareKeyCheckSubmit } from '../data/keys.js';
import { SLIDER_STEP_CAP, clampHabitFormSteps, goalSliderText, habitFormStepCount, habitFormStepValue, resizeLabels, syncHabitFormFromDom } from '../features/field-form.js';
import { closeStepDialog, stepEditCap, stepEditCountChanged, stepEditSummary, typeEditStepsChanged, typeEditSummary } from '../features/type-change.js';
import { flushDaySave, handleSaveNumber, handleSetValue, updateHabitPayload, updateTextValue } from '../data/save.js';
import { passwordRuleText } from './auth-view.js';
import { closeRowMenu, habitSliderValueText, previewHabitFromForm, refreshHabitFormPreview, setPreviewValue, sliderColor, timePicker } from './row-view.js';
import { feedbackSenderNote } from './about-view.js';
import { readTemplateFromDom } from './templates.js';
import { habitFormReminderNote } from './fields-view.js';
import { focusReopensPicker, render } from './main-view.js';
import { SWIPEABLE_VIEWS, lastPointerType, shiftPeriod } from './gestures.js';
import { app } from '../lib/html.js';
import { formatKey, isFutureKey, parseDateKey, startOfDay } from '../lib/calendar.js';
import { renderUnlessTyping } from '../lib/render-request.js';
import { readSectionFormFromDom } from '../features/form-baseline.js';
import { authActions } from './actions/auth.js';
import { fieldsActions } from './actions/fields.js';
import { menuActions } from './actions/menu.js';
import { todayActions } from './actions/today.js';
import { tutorialActions } from './actions/tutorial.js';

// Nur beim Wechsel erfüllt/unerfüllt anfassen - sonst läse ein Screenreader (aria-live)
// bei jedem Tastendruck denselben Satz vor.
function syncPasswordCount(id, len) {
  const count = document.getElementById(id);
  const ok = len >= AUTH_MIN_PASSWORD_LENGTH;
  if (count && count.classList.contains('password-count--ok') !== ok) {
    count.textContent = passwordRuleText(len);
    count.classList.toggle('password-count--ok', ok);
  }
}

// Live-Vorschau während des Ziehens am Schieberegler — nur DOM-Update, kein
// Re-Render/Speichern (verhindert Ruckeln/Sprünge im Formular während der Eingabe).
// Gilt genauso für den Regler in der Vorschau des Feld-Formulars (preview-slider).
function sliderHabit(slider) {
  return slider.dataset.action === 'preview-slider'
    ? (state.habitForm ? previewHabitFromForm(state.habitForm) : null)
    : state.habits.find((h) => h.id === slider.dataset.habit);
}
function commitSliderValue(slider) {
  if (slider.dataset.action === 'preview-slider') setPreviewValue(Number(slider.value), '.value-slider');
  else handleSetValue(formatKey(state.currentDate), slider.dataset.habit, Number(slider.value));
}
// Lücke im nativen 'change'-Event: das feuert beim Loslassen nur, wenn sich der Wert
// seit dem Drücken geändert hat. Ein noch leerer Regler steht aber schon mittig -
// zieht man ihn und lässt ihn genau dort wieder los, sah er durch die Live-Vorschau
// oben eingetragen aus (eingefärbt), gespeichert wurde aber nichts, und das × fehlte.
// Deshalb zusätzlich beim Loslassen selbst speichern, sobald während des Ziehens ein
// 'input' kam (data-dirty). Auf document statt app, da die Maus beim Loslassen schon
// außerhalb des Reglers sein kann; setTimeout, damit ein ggf. danach noch feuerndes
// 'change' nicht doppelt rendert - handleSetValue ist ohnehin idempotent, und hat
// 'change' schon neu gerendert, hängt der alte Regler nicht mehr im DOM.
let sliderPointerTarget = null;

// Tastatur am Computer: ← → blättern wie Wischen, Strg/⌘+Enter speichert das offene Formular,
// die Notiz bzw. das Feedback. Bewusst keine Kürzel mit einzelnen Buchstaben: Screenreader-
// Nutzer lösten sie beim Lesen aus Versehen aus (WCAG 2.1.4). Auf document statt #app: nach
// einem Neuzeichnen hat nichts den Fokus, die Tasten kommen dann bei <body> an.
const CTRL_ENTER_ACTIONS = ['note-save', 'habit-save', 'section-form-save', 'feedback-submit'];

// Was beim Start einmal laufen muss (Event-Listener u.ä.). Nicht beim Laden des Moduls, sondern
// vom Einstieg (main.js) aufgerufen, in fester Reihenfolge, wenn alle Module geladen sind.
export function initEvents() {
  // Klick-Aktionen je Bereich (src/ui/actions/), nachgeschlagen über data-action.
  const clickActions = { ...authActions, ...tutorialActions, ...menuActions, ...todayActions, ...fieldsActions };
  // --- Event-Delegation ----------------------------------------------------
  app.addEventListener('click', async (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const action = el.dataset.action;
    // Jede neue Aktion räumt eine noch angezeigte Meldung von einer früheren Aktion weg
    // (z.B. einen Validierungsfehler, der sonst nach erfolgreicher Korrektur einfach
    // stehen bliebe, bis man aktiv neu lädt) – die aktuelle Aktion setzt bei Bedarf
    // gleich danach ihre eigene, aktuelle Meldung.
    state.notice = null;
    // Jede andere Aktion (Wert wählen, Tag/Tab wechseln, ...) schließt ein offenes
    // Zeilen-Menü mit - die Menüpunkte selbst lesen ihr Ziel aus el.dataset, nicht aus
    // state.rowMenu.
    if (action !== 'row-menu') state.rowMenu = null;

    if (action === 'pick-date') {
      // Finger: das Gerät öffnet seinen Kalender selbst. Maus: Chrome/Edge täten es nur über
      // das kleine Kalender-Symbol, das hier unsichtbar ist.
      if (lastPointerType === 'mouse') { try { el.showPicker(); } catch { /* ältere Browser: Tastatur-Eingabe */ } }
      return;
    }
    const handler = Object.prototype.hasOwnProperty.call(clickActions, action) ? clickActions[action] : null;
    if (handler) await handler(el, e, action);
  });
  // Ziel-Regler im Feld-Formular: Text beim Ziehen mitführen, ohne render() (Fokus bleibt).
  app.addEventListener('input', (e) => {
    const goalSliderEl = e.target.closest?.('[data-action="goal-slider"]');
    if (!goalSliderEl || !state.habitForm) return;
    const { text, span } = goalSliderText(state.habitForm, Number(goalSliderEl.value));
    document.getElementById('habit-form-goal-text').textContent = text;
    const spanEl = document.getElementById('habit-form-goal-span');
    spanEl.textContent = span;
    spanEl.hidden = !span;
    goalSliderEl.setAttribute('aria-valuetext', text + (span ? ' · ' + span : ''));
    const lo = Number(goalSliderEl.min), hi = Number(goalSliderEl.max);
    goalSliderEl.style.setProperty('--slider-pct', ((Number(goalSliderEl.value) - lo) / (hi - lo)) * 100 + '%');
  });
  app.addEventListener('change', async (e) => {
    state.notice = null; // siehe Kommentar beim 'click'-Listener oben
    if (e.target.id === 'day-date-input') {
      if (!e.target.value) return; // "Löschen" in der Datumsauswahl: Tag bleibt
      // max= hält nicht jeder Browser ein: ein Tag in der Zukunft wird zu heute.
      const picked = isFutureKey(e.target.value) ? startOfDay(new Date()) : parseDateKey(e.target.value);
      if (formatKey(picked) === formatKey(state.currentDate)) return;
      runtime.pendingPeriodSlide = picked > state.currentDate ? 1 : -1;
      state.currentDate = picked;
      render();
      const input = document.getElementById('day-date-input');
      if (input && !focusReopensPicker(input)) input.focus({ preventScroll: true });
      return;
    }
    // Berechnetes Feld aus Zahlen: nach jeder Mitglieder-Änderung neu rendern, damit Felder mit anderer
    // Einheit gesperrt bzw. wieder freigegeben werden (siehe computedBody).
    // "Tage seit": anderes Quellfeld -> andere Stufen zur Auswahl.
    if (e.target.id?.startsWith('pkg-item-') && state.habitForm?.packageChosen) {
      const id = e.target.id;
      state.habitForm.packageChosen[id.slice('pkg-item-'.length)] = e.target.checked;
      render();
      document.getElementById(id)?.focus();
      return;
    }
    if ((e.target.id === 'tpl-group' || e.target.id?.startsWith('tpl-source-') || e.target.id?.startsWith('tpl-merge-') || e.target.id?.startsWith('tpl-extra-')) && state.habitForm?.template) {
      const id = e.target.id;
      readTemplateFromDom(state.habitForm);
      render();
      if (id.startsWith('tpl-merge-') || id.startsWith('tpl-extra-')) document.getElementById(id)?.focus();
      return;
    }
    if (e.target.id === 'habit-form-since-source' && state.habitForm) {
      syncHabitFormFromDom();
      state.habitForm.sinceValues = [];
      render();
      const select = document.getElementById('habit-form-since-source');
      if (select && !focusReopensPicker(select)) select.focus();
      return;
    }
    const memberBox = e.target.closest?.('[data-member-key]');
    if (memberBox && state.habitForm?.computedType === 'number') {
      syncHabitFormFromDom();
      render();
      document.querySelector(`[data-member-key="${CSS.escape(memberBox.dataset.memberKey)}"]`)?.focus();
      return;
    }
    const archivedStatsToggle = e.target.closest?.('[data-action="archived-stats-toggle"]');
    if (archivedStatsToggle) {
      const habit = state.habits.find((h) => h.defId === archivedStatsToggle.dataset.id);
      if (habit) {
        const id = habit.defId;
        await updateHabitPayload(habit, { archivedInStats: archivedStatsToggle.checked });
        document.querySelector(`[data-action="archived-stats-toggle"][data-id="${id}"]`)?.focus(); // render() hat das DOM ersetzt
      }
      return;
    }
    if (e.target.classList?.contains('text-field-input')) {
      flushDaySave(formatKey(state.currentDate)); // Feld verlassen: nicht erst auf den Timer warten
      return;
    }
    const numberInput = e.target.closest('[data-action="number-input"]');
    if (numberInput) {
      // Speichert beim Verlassen des Feldes (Blur/Tab-Wechsel) statt über einen
      // separaten Button — zuverlässiger als Debounce-nach-Tippen (kein Timer, der bei
      // abruptem Verlassen noch nicht abgelaufen sein könnte).
      handleSaveNumber(formatKey(state.currentDate), numberInput.dataset.habit, numberInput.value);
      return;
    }
    // Von/Bis (Buttons) oder Anzahl Stufen (Schieberegler) geändert - Bezeichnungs-Liste
    // (auch wenn aktuell ausgeblendet, siehe resizeLabels) muss auf die neue Stufenzahl
    // gebracht werden, sonst zeigt die Live-Vorschau/das nächste Aktivieren der
    // Bezeichnungen eine falsche Anzahl Zeilen.
    const rangeEl = e.target.closest('[data-action="habit-range-change"]');
    if (rangeEl && state.habitForm) {
      syncHabitFormFromDom();
      const f = state.habitForm;
      // Deckel greift auch, wenn direkt in die Stufenzahl getippt wird (das max-Attribut
      // des Inputs verhindert das allein nicht zuverlässig, siehe clampHabitFormSteps).
      clampHabitFormSteps(f);
      f.labels = resizeLabels(f.labels, habitFormStepCount(f), f.labelsEnabled ? (i) => String(habitFormStepValue(f, i)) : undefined);
      render();
      return;
    }
    // Stufen ändern: neue Anzahl.
    const stepEditCountEl = e.target.closest('[data-action="step-edit-count"]');
    if (stepEditCountEl && state.habitForm?.stepEdit) {
      syncHabitFormFromDom();
      const f = state.habitForm;
      const h = state.habits.find((x) => x.defId === f.defId);
      if (!h) return;
      const steps = Math.round(Number(stepEditCountEl.value));
      stepEditCountChanged(h, f.stepEdit, Number.isFinite(steps) ? Math.min(stepEditCap(h), Math.max(2, steps)) : f.stepEdit.steps);
      render();
      return;
    }
    // Typ ändern: Anzahl Stufen der neuen Skala.
    const typeEditCountEl = e.target.closest('[data-action="type-edit-count"]');
    if (typeEditCountEl && state.habitForm?.typeEdit) {
      syncHabitFormFromDom();
      const f = state.habitForm;
      const h = state.habits.find((x) => x.defId === f.defId);
      if (!h) return;
      const steps = Math.round(Number(typeEditCountEl.value));
      typeEditStepsChanged(h, f.typeEdit, Number.isFinite(steps) ? Math.min(SLIDER_STEP_CAP, Math.max(2, steps)) : f.typeEdit.steps);
      render();
      return;
    }
    // Typ ändern: Zuordnung eines alten Werts - wie bei Stufen ändern ohne render().
    const typeMapEl = e.target.closest('[data-type-map]');
    if (typeMapEl && state.habitForm?.typeEdit) {
      const f = state.habitForm;
      const h = state.habits.find((x) => x.defId === f.defId);
      if (!h) return;
      if (typeMapEl.tagName === 'SELECT') {
        f.typeEdit.map[typeMapEl.dataset.typeMap] = typeMapEl.value === '' ? null : Number(typeMapEl.value);
        f.typeEdit.preset = 'custom';
        document.querySelectorAll('[data-action="type-edit-preset"]').forEach((b) => {
          b.classList.remove('pill-toggle--active');
          b.setAttribute('aria-pressed', 'false');
        });
      } else {
        f.typeEdit.map[typeMapEl.dataset.typeMap] = typeMapEl.value;
      }
      const summary = document.getElementById('type-edit-summary');
      if (summary) summary.innerHTML = typeEditSummary(h, f.typeEdit);
      return;
    }
    // Stufen ändern: eine alte Stufe zugeordnet - ohne render() (iOS öffnet die Auswahl sonst
    // wieder, siehe focusReopensPicker), nur Zusammenfassung und Vorschlag-Knöpfe nachziehen.
    const stepMapEl = e.target.closest('[data-step-map]');
    if (stepMapEl && state.habitForm?.stepEdit) {
      const f = state.habitForm;
      const h = state.habits.find((x) => x.defId === f.defId);
      if (!h) return;
      f.stepEdit.map[stepMapEl.dataset.stepMap] = stepMapEl.value === '' ? null : Number(stepMapEl.value);
      f.stepEdit.preset = 'custom';
      document.querySelectorAll('[data-action="step-edit-preset"]').forEach((b) => {
        b.classList.remove('pill-toggle--active');
        b.setAttribute('aria-pressed', 'false');
      });
      const summary = document.getElementById('step-edit-summary');
      if (summary) summary.innerHTML = stepEditSummary(h, f.stepEdit);
      return;
    }
    // Nur die Vorschau austauschen statt render() - hält den Fokus auf der Checkbox.
    const showValueEl = e.target.closest('[data-action="habit-slider-show-value"]');
    if (showValueEl && state.habitForm) {
      state.habitForm.sliderShowValue = showValueEl.checked;
      refreshHabitFormPreview();
      return;
    }
    const labelsToggleEl = e.target.closest('[data-action="habit-labels-toggle"]');
    if (labelsToggleEl && state.habitForm) {
      syncHabitFormFromDom();
      const f = state.habitForm;
      f.labelsEnabled = labelsToggleEl.checked;
      clampHabitFormSteps(f);
      // Beim Aktivieren bleiben die Zahlen als Startwert stehen (siehe resizeLabels) -
      // macht sichtbar, dass es weiterhin dieselbe Skala ist, bis man sie überschreibt.
      f.labels = resizeLabels(f.labels, habitFormStepCount(f), f.labelsEnabled ? (i) => String(habitFormStepValue(f, i)) : undefined);
      // Mit eigenen Bezeichnungen sind die Zahlen unsichtbar - intern wieder ab 1 (beim
      // Speichern ohnehin, siehe habitFormDefinition); die vorbelegten Texte behalten "0 …".
      if (f.labelsEnabled && !f.locked && f.min !== 1) { f.max = f.max - f.min + 1; f.min = 1; }
      render();
      return;
    }
    const sectionReminderToggle = e.target.closest('[data-action="section-reminder-toggle"]');
    if (sectionReminderToggle && state.sectionForm) {
      readSectionFormFromDom();
      render();
      document.getElementById('section-form-reminder-enabled')?.focus();
      return;
    }
    // Gruppe im Feld-Formular gewechselt: nur den Erinnerungs-Hinweis austauschen (kein
    // render(), der Fokus bleibt auf der Auswahl).
    if (e.target.id === 'habit-form-section' && state.habitForm) {
      state.habitForm.sectionId = e.target.value || null;
      const note = document.getElementById('habit-form-reminder-note');
      if (note) note.innerHTML = habitFormReminderNote(state.habitForm);
      return;
    }
    const reminderToggle = e.target.closest('[data-action="habit-reminder-toggle"]');
    if (reminderToggle && state.habitForm) {
      syncHabitFormFromDom();
      state.habitForm.reminderEnabled = reminderToggle.checked;
      render();
      return;
    }
    const dayProgressToggle = e.target.closest('[data-action="day-progress-toggle"]');
    if (dayProgressToggle) {
      setDayProgressShown(dayProgressToggle.checked);
      render();
      return;
    }
    const patternToggle = e.target.closest('[data-action="pattern-toggle"]');
    if (patternToggle) {
      setPatternDisabled(!patternToggle.checked);
      render();
      return;
    }
    // Kein render() nötig (nichts Sichtbares ändert sich) - so bleibt auch der Fokus auf
    // der Checkbox. Beim Einschalten einmal vibrieren, als direkte Rückmeldung.
    const hapticsToggle = e.target.closest('[data-action="haptics-toggle"]');
    if (hapticsToggle) {
      setHapticsDisabled(!hapticsToggle.checked);
      haptic();
      return;
    }
    const feedbackAnonymous = e.target.closest('[data-action="feedback-anonymous"]');
    if (feedbackAnonymous) {
      state.feedback.anonymous = feedbackAnonymous.checked;
      const note = document.getElementById('feedback-sender-note');
      if (note) note.innerHTML = feedbackSenderNote(feedbackAnonymous.checked);
      return;
    }
    const summaryToggle = e.target.closest('[data-action="summary-notifications-toggle"]');
    if (summaryToggle) {
      saveSummaryNotifications(summaryToggle.checked);
      return;
    }
    const localeEl = e.target.closest('[data-action="menu-locale"]');
    if (localeEl) {
      saveLocale(localeEl.value);
      return;
    }
    const weekStartEl = e.target.closest('[data-action="menu-week-start"]');
    if (weekStartEl) {
      await runWeekStartChange(Number(weekStartEl.value));
      document.getElementById('menu-week-start')?.focus({ preventScroll: true });
      return;
    }
    const slider = e.target.closest('[data-action="value-slider"], [data-action="preview-slider"]');
    if (slider) {
      // Loslassen/Commit — erst hier wird tatsächlich gespeichert, nicht bei jedem
      // Zwischenwert während des Ziehens.
      commitSliderValue(slider);
    }
  });
  app.addEventListener('submit', (e) => {
    if (e.target.id === 'password-change-form') { e.preventDefault(); handlePasswordChangeSubmit(); }
    if (e.target.id === 'spare-key-check-form') { e.preventDefault(); handleSpareKeyCheckSubmit(); }
    if (e.target.id === 'email-change-form') { e.preventDefault(); handleEmailChangeSubmit(); }
  });
  // Hält E-Mail/Passwort im Anmelde-Formular auch über einen Re-Render (z.B. nach
  // einem Fehler) hinweg – sonst wäre bei jedem Fehlversuch das ganze Formular leer.
  app.addEventListener('input', (e) => {
    if (e.target.id === 'email' && !state.session) { state.authEmail = e.target.value; return; }
    if (e.target.id === 'password' && !state.session) {
      state.authPassword = e.target.value;
      syncPasswordCount('password-count', e.target.value.length);
      return;
    }
    if (e.target.id === 'email-change-input' && state.emailChange) { state.emailChange.value = e.target.value; return; }
    if (e.target.id === 'email-change-password' && state.emailChange) { state.emailChange.password = e.target.value; return; }
    if (e.target.id === 'spare-key-check-input' && state.spareKeyCheck) { state.spareKeyCheck.value = e.target.value; return; }
    if (e.target.id === 'password-change-current' && state.passwordChange) { state.passwordChange.current = e.target.value; return; }
    if (e.target.id === 'password-change-new' && state.passwordChange) {
      state.passwordChange.next = e.target.value;
      syncPasswordCount('password-change-count', e.target.value.length);
      return;
    }
    // Kein render() beim Tippen (würde Fokus/Cursor zurücksetzen) - nur merken, damit
    // der Text einen späteren Re-Render (z.B. Meldung beim Absenden) übersteht.
    if (e.target.id === 'feedback-message') { state.feedback.message = e.target.value; return; }
    if (e.target.id === 'note-input' && state.noteEditor) { state.noteEditor.draft = e.target.value; return; }
    if (e.target.id === 'section-form-name' && state.sectionForm) { state.sectionForm.name = e.target.value; return; }
    if (e.target.classList.contains('text-field-input')) { updateTextValue(formatKey(state.currentDate), e.target.dataset.habit, e.target.value); return; }
    // Bezeichnungen im Feld-Formular: Live-Vorschau mitziehen, ohne das ganze Formular
    // neu zu rendern (würde Fokus/Cursor im gerade bearbeiteten Feld zurücksetzen) - nur
    // die Vorschau selbst wird ausgetauscht (der Fokus liegt dabei ja im Bezeichnungs-Feld).
    const labelInput = e.target.closest('[data-label-index]');
    if (labelInput && state.habitForm?.labelsEnabled) {
      state.habitForm.labels[Number(labelInput.dataset.labelIndex)] = labelInput.value;
      refreshHabitFormPreview();
    }
  });
  app.addEventListener('input', (e) => {
    const slider = e.target.closest('[data-action="value-slider"], [data-action="preview-slider"]');
    if (!slider) return;
    const habit = sliderHabit(slider);
    if (!habit) return;
    const v = Number(slider.value);
    const pct = ((v - habit.min) / (habit.max - habit.min)) * 100;
    slider.classList.remove('value-slider--unset');
    slider.dataset.dirty = '1'; // siehe pointerup-Listener unten
    slider.style.setProperty('--slider-color', sliderColor(habit, v));
    slider.style.setProperty('--slider-pct', pct + '%');
    slider.setAttribute('aria-valuetext', habitSliderValueText(habit, v));
    const valueEl = document.getElementById('slider-value-' + habit.id);
    if (valueEl) valueEl.textContent = habitSliderValueText(habit, v);
  });
  app.addEventListener('pointerdown', (e) => {
    sliderPointerTarget = e.target.closest('[data-action="value-slider"], [data-action="preview-slider"]');
  });
  document.addEventListener('pointerup', () => {
    const slider = sliderPointerTarget;
    sliderPointerTarget = null;
    if (!slider?.dataset.dirty) return;
    setTimeout(() => {
      if (slider.isConnected) commitSliderValue(slider);
    });
  });
  // Wird aus dem Anfassen ein Scrollen (touch-action: pan-y, siehe CSS), bricht der Browser
  // die Geste ab - einen dabei schon vorläufig angezeigten Wert verwerfen statt speichern.
  document.addEventListener('pointercancel', () => {
    const slider = sliderPointerTarget;
    sliderPointerTarget = null;
    if (!slider?.dataset.dirty || !slider.isConnected) return;
    delete slider.dataset.dirty;
    renderUnlessTyping();
  });
  document.addEventListener('pointercancel', () => { sliderPointerTarget = null; });
  // Merkt sich, wenn einer der "Über Logbuch"-Abschnitte zu-/aufgeklappt wird (siehe
  // isAboutSectionCollapsed, nur für die Dauer des Besuchs) - reines DOM-natives
  // <details>-Verhalten, kein eigener Klick-Handler/Re-Render nötig.
  // capture:true, da der native 'toggle'-Event bei <details> in vielen Browsern noch
  // nicht bubbled (erst seit jüngeren Chrome/Firefox-Versionen standardisiert) - eine
  // normale (bubble-basierte) Delegation auf app hätte hier nie gefeuert. Die
  // Capture-Phase läuft dagegen unabhängig vom bubbles-Flag immer von oben nach unten
  // durch den ganzen Baum, deshalb funktioniert die Delegation so zuverlässig überall.
  app.addEventListener('toggle', (e) => {
    // "Heute nicht geplant": offen/zu übersteht so einen Re-Render (z.B. nach dem
    // Eintragen eines Werts), gilt aber nur für den jeweiligen Tag.
    if (e.target.matches?.('details.unplanned')) {
      state.unplannedOpenFor = e.target.open ? formatKey(state.currentDate) : null;
      return;
    }
    if (e.target.matches?.('details.habit-form-more') && state.habitForm) {
      state.habitForm.moreOpen = e.target.open;
      return;
    }
    if (e.target.matches?.('details.part-more') && state.habitForm) {
      state.habitForm.partMore = { ...state.habitForm.partMore, [e.target.dataset.more]: e.target.open };
      return;
    }
    const details = e.target.closest('details[data-collapse-key]');
    if (!details) return;
    if (details.open) runtime.openAboutSections.add(details.dataset.collapseKey);
    else runtime.openAboutSections.delete(details.dataset.collapseKey);
  }, true);
  // Menü schließen, wenn außerhalb davon geklickt wird.
  document.addEventListener('click', (e) => {
    if (!state.menuOpen) return;
    if (e.target.closest('.menu-panel, .menu-btn')) return;
    state.menuOpen = false;
    render();
  });
  // Dasselbe für das Zeilen-Menü in "Heute" bei Klicks außerhalb von #app (innerhalb
  // greift schon der Light-Dismiss-Capture-Listener, siehe "Zeilen-Menü per Long-Press").
  document.addEventListener('click', (e) => {
    if (!state.rowMenu) return;
    if (e.target.closest('.row-menu, [data-menu]')) return;
    state.rowMenu = null;
    render();
  });
  app.addEventListener('keydown', (e) => {
    if (e.target?.dataset?.action === 'number-input' && e.key === 'Enter') {
      e.preventDefault();
      handleSaveNumber(formatKey(state.currentDate), e.target.dataset.habit, e.target.value);
      return;
    }
    if (e.key === 'Escape' && state.rowMenu) {
      closeRowMenu();
      return;
    }
    if (e.key === 'Escape' && state.menuOpen) {
      state.menuOpen = false;
      render();
      document.querySelector('.menu-btn')?.focus();
      return;
    }
    const modalBox = document.querySelector('.modal-box');
    if (modalBox) {
      if (e.key === 'Escape' && modalBox.classList.contains('step-dialog')) {
        closeStepDialog();
        render();
        if (state.leaveFormConfirm) return; // focusModalIfOpen hat den Fokus schon in der Rückfrage
        (document.getElementById('step-dialog-title') || document.querySelector('[data-action="step-edit-open"]'))?.focus();
        return;
      }
      if (e.key === 'Escape') {
        closeModals();
        render();
        restoreModalFocus();
        return;
      }
      // Fokus-Trap: Tab/Shift+Tab bleibt innerhalb des offenen Modals, statt in die
      // dahinterliegende (verdeckte, aber technisch noch im DOM befindliche) Seite
      // weiterzuwandern.
      if (e.key === 'Tab') {
        const focusable = [...modalBox.querySelectorAll('button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])')]
          .filter((el) => !el.disabled && el.offsetParent !== null);
        if (!focusable.length) return;
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
      return;
    }
    // Generalisierte Tastatur-Aktivierung für per data-action klickbare, aber nicht
    // nativ fokussierbare Elemente (v.a. die Kalenderzellen, die tabindex="0" bekommen
    // haben) — löst denselben echten Klick aus, den die Maus auch auslösen würde, statt
    // die ~60 bestehenden Klick-Aktionen für Tastatur-Nutzung zu duplizieren. Auf
    // tabindex="0" beschränkt, damit z.B. Enter in einem normalen Input (das zufällig in
    // einem [data-action]-Vorfahren sitzt) nicht versehentlich mit-ausgelöst wird.
    if (e.key === 'Enter' || e.key === ' ') {
      const el = e.target.closest('[data-action][tabindex="0"]');
      if (el) {
        e.preventDefault();
        el.click();
      }
    }
  });
  document.addEventListener('keydown', (e) => {
    if (timePicker || e.defaultPrevented || !state.session || !currentDek) return;
    if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
      if (!SWIPEABLE_VIEWS.includes(state.view) || state.loading || isOverlayOpen() || document.querySelector('.modal-box')
        || !app.querySelector('.view-body') || e.target.closest?.('input, textarea, select, [contenteditable="true"]')) return;
      e.preventDefault();
      shiftPeriod(e.key === 'ArrowRight' ? 1 : -1);
      render();
      return;
    }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !document.querySelector('.modal-box')) {
      const btn = CTRL_ENTER_ACTIONS.map((a) => app.querySelector(`[data-action="${a}"]`)).find((b) => b && !b.disabled && b.getClientRects().length);
      if (!btn) return;
      e.preventDefault();
      btn.click();
    }
  });
}
