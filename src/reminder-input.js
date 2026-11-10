import { saveDefaultReminderMinute } from './data.js';
import { syncHabitFormFromDom } from './field-form.js';
import { formatClock } from './fields.js';
import { esc } from './html.js';
import { t } from './i18n.js';
import { state } from './state.js';
import { requestRender } from './render-request.js';
export const REMINDER_TIME_STEP = 15; // Minuten — muss zum Cron-Intervall in send-notifications passen
// Uhrzeit als Knopf, der die eigene Uhrzeit-Auswahl öffnet (openTimePicker), Minuten nur
// 00/15/30/45 - so oft läuft der Versand. dataAction sagt, was nach der Auswahl passiert
// (reminderTimePicked). Wert lesen über readTimeInput(id).
export function reminderTimeInputHtml(id, minutes, dataAction, disabled, describedBy, labelledBy) {
  const label = labelledBy ? `aria-labelledby="${labelledBy} ${id}"` : `aria-label="${esc(t('time.label'))}: ${esc(formatClock(minutes))}"`;
  return `<button type="button" class="time-pick" id="${id}" data-time-input data-action="reminder-time-pick" data-then="${dataAction || ''}" data-value="${minutes}" ${disabled ? 'disabled' : ''} ${describedBy ? `aria-describedby="${describedBy}"` : ''} ${label}>${esc(formatClock(minutes))}</button>`;
}

// Nach der Auswahl: Knopf nachziehen, dann je nach Stelle speichern bzw. ins Formular übernehmen.
export function reminderTimePicked(id, v) {
  const el = document.getElementById(id);
  if (!el) return;
  el.dataset.value = String(v);
  el.textContent = formatClock(v);
  if (el.hasAttribute('aria-label')) el.setAttribute('aria-label', `${t('time.label')}: ${formatClock(v)}`);
  if (el.dataset.then === 'menu-default-time') saveDefaultReminderMinute(v);
  else if (el.dataset.then === 'habit-reminder-time-changed' && state.habitForm) { syncHabitFormFromDom(); requestRender(); }
  else if (state.sectionForm && id === 'section-form-reminder-time') state.sectionForm.reminderMinute = v;
}
