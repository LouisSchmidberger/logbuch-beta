// Klick-Aktionen: "Heute" und Übersichten. Schlüssel = data-action; die Event-Delegation in events.js ruft
// handler(el, e, action) auf, nachdem sie eine alte Meldung und ein offenes Zeilen-Menü weggeräumt hat.

import { closeNoteEditor, flushDaySave, handleClearValue, handleCounterStep, handleMultiToggle, handleReset, handleSelect, handleSetValue, openNoteEditor } from '../../data/save.js';
import { expandSection, setSectionCollapsed, timeValueOn } from '../../domain/fields.js';
import { habitToForm, newHabitForm } from '../../features/field-form.js';
import { openHabitForm } from '../../features/form-baseline.js';
import { openSectionForm } from '../../features/section-form.js';
import { handleHabitArchive } from '../../features/type-change.js';
import { addDays, formatKey, startOfDay } from '../../lib/calendar.js';
import { t } from '../../lib/i18n.js';
import { restoreModalFocus, runtime, state } from '../../state/state.js';
import { shiftPeriod } from '../gestures.js';
import { render } from '../main-view.js';
import { enterSubpage } from '../navigation.js';
import { DAY_MENU_KEY, closeRowMenu, openRowMenu, openTimePicker } from '../row-view.js';
import { packageFormState } from '../templates.js';

// "nav-day", "nav-week", "nav-month", "nav-year"
const navDayAction = (el, e, action) => {
  shiftPeriod(Number(el.dataset.dir));
  render();
  // render() ersetzt den Pfeil - Fokus zurück, damit man per Tastatur weiterblättern kann.
  document.querySelector(`[data-action="${action}"][data-dir="${el.dataset.dir}"]`)?.focus({ preventScroll: true });
};

// "multi-toggle", "multi-none"
const multiToggleAction = (el, e, action) => {
  handleMultiToggle(formatKey(state.currentDate), el.dataset.habit, action === 'multi-none' ? null : el.dataset.option);
};

export const todayActions = {
  'avg-info': (el, e, action) => {
    state.notice = { type: 'ok', text: el.dataset.text };
    render();
  },
  'set-view': (el, e, action) => {
    state.view = el.dataset.view;
    render();
  },
  'nav-day': navDayAction,
  'nav-week': navDayAction,
  'nav-month': navDayAction,
  'nav-year': navDayAction,
  'jump-today': (el, e, action) => {
    const today = startOfDay(new Date());
    runtime.pendingPeriodSlide = today > state.currentDate ? 1 : -1;
    state.currentDate = today;
    render();
  },
  'select': (el, e, action) => {
    const dateKey = formatKey(state.currentDate);
    const value = JSON.parse(el.dataset.value);
    handleSelect(dateKey, el.dataset.habit, value);
  },
  'multi-toggle': multiToggleAction,
  'multi-none': multiToggleAction,
  'reset-day-arm': (el, e, action) => {
    // Das Menü ist nach dem Dialog zu - der Fokus kehrt deshalb auf dessen ⋮ zurück.
    runtime.modalTriggerSelector = `.row-menu-trigger[data-menu="${DAY_MENU_KEY}"]`;
    state.resetConfirm = formatKey(state.currentDate);
    render();
  },
  'reset-day-cancel': (el, e, action) => {
    state.resetConfirm = null;
    render();
    restoreModalFocus();
  },
  'reset-day-confirm': (el, e, action) => {
    const dateKey = state.resetConfirm;
    state.resetConfirm = null;
    handleReset(dateKey);
    restoreModalFocus();
  },
  'note-edit': (el, e, action) => {
    openNoteEditor(el.dataset.note);
  },
  'note-save': (el, e, action) => {
    closeNoteEditor(true);
  },
  'note-cancel': (el, e, action) => {
    closeNoteEditor(false);
  },
  'counter-step': (el, e, action) => {
    handleCounterStep(formatKey(state.currentDate), el.dataset.habit, Number(el.dataset.dir));
  },
  'time-pick': (el, e, action) => {
    // Leer startet die Auswahl bei "jetzt" - heute und gestern (nach Mitternacht am Vortag =
    // heute Nacht); an älteren Tagen ergäbe "jetzt" keinen Sinn, dort nur die Uhrzeit.
    const dateKey = formatKey(state.currentDate);
    const h = state.habits.find((x) => x.id === el.dataset.habit);
    if (!h) return;
    const now = new Date();
    const yesterday = dateKey === formatKey(addDays(startOfDay(now), -1));
    const nowAllowed = yesterday || dateKey === formatKey(now);
    const old = state.entries[dateKey]?.[h.id];
    const has = typeof old === 'number';
    openTimePicker({
      title: h.name, dateKey, step: 1, nowAllowed, triggerId: el.id,
      value: has ? old : nowAllowed ? timeValueOn(dateKey, now) : now.getHours() * 60 + now.getMinutes(),
      onPick: (v) => handleSetValue(dateKey, h.id, v),
      onClear: has ? () => { handleClearValue(dateKey, h.id); flushDaySave(dateKey); } : null,
    });
  },
  'clear-value': (el, e, action) => {
    handleClearValue(formatKey(state.currentDate), el.dataset.habit);
  },
  'today-new-field': (el, e, action) => {
    enterSubpage('manage');
    openHabitForm({ ...newHabitForm(), returnToTab: true });
  },
  'today-starter-package': (el, e, action) => {
    enterSubpage('manage');
    openHabitForm({ ...newHabitForm(), ...packageFormState(), returnToTab: true });
  },
  'row-menu': (el, e, action) => {
    if (state.rowMenu === el.dataset.menu) closeRowMenu();
    else openRowMenu(el.dataset.menu);
  },
  'section-menu-edit': (el, e, action) => {
    enterSubpage('manage');
    openSectionForm(el.dataset.id, { returnToTab: true });
  },
  'row-menu-edit': (el, e, action) => {
    // Gleiches Muster wie der "+ Neues Feld"-Shortcut: returnToTab führt nach
    // Speichern/Abbrechen zurück nach "Heute" statt in der Verwaltung zu bleiben.
    const h = state.habits.find((x) => x.defId === el.dataset.id);
    if (h) {
      enterSubpage('manage');
      openHabitForm({ ...habitToForm(h), returnToTab: true });
    }
  },
  'row-menu-archive': async (el, e, action) => {
    // Anders als in der Verwaltung verschwindet das Feld hier einfach aus der Liste -
    // die Meldung sagt, wo es wieder zu finden ist.
    if (await handleHabitArchive(el.dataset.id, true)) {
      state.notice = { type: 'ok', text: t('notice.fieldArchived') };
      render();
    }
  },
  'section-toggle': (el, e, action) => {
    const { section, scope } = el.dataset;
    if (el.getAttribute('aria-expanded') === 'false') expandSection(scope, section);
    else setSectionCollapsed(scope, section, true);
    render();
    document.querySelector(`[data-action="section-toggle"][data-section="${section}"][data-scope="${scope}"]`)?.focus();
  },
};
