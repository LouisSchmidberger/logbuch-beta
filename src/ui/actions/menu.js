// Klick-Aktionen: Menü, Einstellungen, Konto. Schlüssel = data-action; die Event-Delegation in events.js ruft
// handler(el, e, action) auf, nachdem sie eine alte Meldung und ein offenes Zeilen-Menü weggeräumt hat.

import { handleDeleteAccount, handleExportData } from '../../data/account.js';
import { closeWhatsNew } from '../../data/changelog.js';
import { disablePush, enablePush } from '../../data/device.js';
import { endPushForThisDevice } from '../../data/push-device.js';
import { flushAllDaySaves } from '../../data/save.js';
import { isFutureKey, parseDateKey } from '../../lib/calendar.js';
import { supabase } from '../../lib/config.js';
import { setTextSize, setThemeOverride } from '../../lib/theme.js';
import { clearCurrentDek, restoreModalFocus, runtime, state } from '../../state/state.js';
import { handleFeedbackSubmit } from '../about-view.js';
import { focusSettingsTarget, render } from '../main-view.js';
import { closeModals, enterSubpage, leaveFormGuarded, subpageBack } from '../navigation.js';
import { focusTodayField } from '../row-view.js';

// "open-settings", "open-about", "open-feedback", "open-install"
const openSettingsAction = (el, e, action) => {
  // Aus einem geänderten Feld-/Gruppen-Formular heraus erst nachfragen (enterSubpage schließt es).
  const view = action.slice('open-'.length);
  leaveFormGuarded(() => enterSubpage(view));
  render();
};

export const menuActions = {
  'logout-arm': (el, e, action) => {
    runtime.modalTriggerSelector = '[data-action="logout-arm"]';
    state.logoutConfirm = true;
    state.menuOpen = false;
    render();
  },
  'logout-cancel': (el, e, action) => {
    state.logoutConfirm = false;
    render();
    restoreModalFocus();
  },
  'logout': async (el, e, action) => {
    state.logoutConfirm = false;
    runtime.modalTriggerSelector = null;
    flushAllDaySaves(); // ausstehende Text-Feld-Speicherungen noch mit dem Schlüssel verschicken
    await endPushForThisDevice();
    clearCurrentDek();
    state.authEmail = '';
    state.authPassword = '';
    state.authPasswordVisible = false;
    await supabase.auth.signOut();
  },
  'toggle-menu': (el, e, action) => {
    state.menuOpen = !state.menuOpen;
    render();
  },
  'text-size-set': (el, e, action) => {
    setTextSize(el.dataset.size);
    render();
  },
  'theme-set': (el, e, action) => {
    setThemeOverride(el.dataset.theme || null);
    render();
  },
  'open-manage': (el, e, action) => {
    enterSubpage('manage');
    render();
  },
  'leave-form-stay': (el, e, action) => {
    closeModals();
    render();
    restoreModalFocus();
  },
  'leave-form-discard': (el, e, action) => {
    const proceed = runtime.pendingFormLeave;
    closeModals();
    runtime.modalTriggerSelector = null; // die Ebene darunter ist gleich weg, render() fokussiert neu
    proceed?.();
    render();
  },
  'open-settings': openSettingsAction,
  'open-about': openSettingsAction,
  'open-feedback': openSettingsAction,
  'open-install': openSettingsAction,
  'open-settings-at': (el, e, action) => {
    enterSubpage('settings');
    render();
    focusSettingsTarget(el.dataset.target);
  },
  'whats-new-close': (el, e, action) => {
    closeWhatsNew();
    render();
  },
  'whats-new-all': (el, e, action) => {
    closeWhatsNew();
    enterSubpage('about');
    runtime.openAboutSections.add('aboutNewsCollapsed');
    render();
    requestAnimationFrame(() => document.getElementById('about-news')?.scrollIntoView({ block: 'start' }));
  },
  'feedback-submit': async (el, e, action) => {
    await handleFeedbackSubmit();
  },
  'subpage-back': (el, e, action) => {
    subpageBack();
    render();
  },
  'export-data': async (el, e, action) => {
    await handleExportData();
  },
  'open-password-change': (el, e, action) => {
    runtime.modalTriggerSelector = '[data-action="open-password-change"]';
    state.passwordChange = { current: '', next: '', visible: false, busy: false, error: null };
    state.menuOpen = false;
    render();
  },
  'password-change-cancel': (el, e, action) => {
    state.passwordChange = null;
    render();
    restoreModalFocus();
  },
  'password-change-visibility': (el, e, action) => {
    state.passwordChange.visible = !state.passwordChange.visible;
    render();
    document.querySelector('[data-action="password-change-visibility"]')?.focus();
  },
  'open-email-change': (el, e, action) => {
    runtime.modalTriggerSelector = '[data-action="open-email-change"]';
    state.emailChange = { value: '', password: '', busy: false, error: null, sentTo: null };
    state.menuOpen = false;
    render();
  },
  'email-change-close': (el, e, action) => {
    state.emailChange = null;
    render();
    restoreModalFocus();
  },
  'open-spare-key-check': (el, e, action) => {
    runtime.modalTriggerSelector = '[data-action="open-spare-key-check"]';
    state.spareKeyCheck = { value: '', busy: false, result: null, errorText: '' };
    state.menuOpen = false;
    render();
  },
  'spare-key-check-close': (el, e, action) => {
    state.spareKeyCheck = null;
    render();
    restoreModalFocus();
  },
  'open-delete-confirm': (el, e, action) => {
    runtime.modalTriggerSelector = '[data-action="open-delete-confirm"]';
    state.deleteConfirm = { busy: false };
    state.menuOpen = false;
    render();
  },
  'delete-confirm-cancel': (el, e, action) => {
    state.deleteConfirm = null;
    render();
    restoreModalFocus();
  },
  'delete-confirm-submit': async (el, e, action) => {
    await handleDeleteAccount();
  },
  'open-day': (el, e, action) => {
    if (isFutureKey(el.dataset.date)) return;
    state.currentDate = parseDateKey(el.dataset.date);
    state.view = 'today';
    render();
    if (el.dataset.focusHabit) focusTodayField(el.dataset.focusHabit);
  },
  'enable-push': (el, e, action) => {
    enablePush();
  },
  'disable-push': (el, e, action) => {
    disablePush();
  },
};
