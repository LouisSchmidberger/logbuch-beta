// Logbuch - Einstieg. Die App-Logik liegt in Modulen unter src/, eins je Bereich (Übersicht:
// docs/module.md). Die Module werden hier in der Reihenfolge des früheren Gesamtskripts
// geladen, damit Code, der beim Laden läuft (Event-Listener, Theme), wie vorher nacheinander läuft.
import './config.js';
import './crypto.js';
import './fields.js';
import './dates.js';
import './state.js';
import './navigation.js';
import './strings.js';
import './i18n.js';
import './theme.js';
import './format.js';
import './notices.js';
import './data.js';
import './keys.js';
import './field-form.js';
import './type-change.js';
import './section-form.js';
import './save.js';
import './device.js';
import './account.js';
import './auth-view.js';
import './row-view.js';
import './stats-view.js';
import './about-view.js';
import './templates.js';
import './fields-view.js';
import './tutorial.js';
import './main-view.js';
import './events.js';
import './gestures.js';
import './deeplinks.js';
import './session.js';
import { ARRIVED_VIA_EMAIL_CHANGE, ARRIVED_VIA_SIGNUP_CONFIRM, MAIL_LINK_ERROR, supabase } from './config.js';
import { state } from './state.js';
import { applyLocale, detectInitialLocale, t } from './i18n.js';
import { applyTextSize, applyTheme, getTextSize, getThemeOverride } from './theme.js';
import { isMobileDevice, isStandaloneDisplay, resetIOSZoomOnStandaloneStart } from './device.js';
import { isInstallGateSkipped } from './auth-view.js';
import { TUTORIAL_STEP_FIELD } from './tutorial.js';
import { render } from './main-view.js';
import { applyDeepLink, parseDeepLink } from './deeplinks.js';
import { initNavigation } from './navigation.js';
import { initI18n } from './i18n.js';
import { initFormat } from './format.js';
import { initNotices } from './notices.js';
import { initData } from './data.js';
import { initKeys } from './keys.js';
import { initSave } from './save.js';
import { initAuthView } from './auth-view.js';
import { initMainView } from './main-view.js';
import { initEvents } from './events.js';
import { initGestures } from './gestures.js';
import { initDeeplinks } from './deeplinks.js';
import { initSession } from './session.js';

// Start-Code der Module, in der Reihenfolge des früheren Gesamtskripts.
initNavigation();
initI18n();
initFormat();
initNotices();
initData();
initKeys();
initSave();
initAuthView();
initMainView();
initEvents();
initGestures();
initDeeplinks();
initSession();

// Verhindert versehentliches Verlassen/Reload mitten im geführten Feld-Anlegen
// (Tutorial mit offenem Formular, siehe docs/onboarding.md).
window.addEventListener('beforeunload', (e) => {
  if (state.tutorialStep === TUTORIAL_STEP_FIELD && state.habitForm) { e.preventDefault(); e.returnValue = ''; }
});

resetIOSZoomOnStandaloneStart();
state.confirmLanding = ARRIVED_VIA_SIGNUP_CONFIRM && isMobileDevice() && !isStandaloneDisplay() && !isInstallGateSkipped();
applyLocale(detectInitialLocale());
applyTheme(getThemeOverride());
if (ARRIVED_VIA_EMAIL_CHANGE) state.notice = { type: 'ok', text: t('emailChange.landedDone') };
if (MAIL_LINK_ERROR) {
  state.notice = { type: 'error', text: t(MAIL_LINK_ERROR === 'otp_expired' ? 'mailLink.expired' : 'mailLink.failed') };
  // Sonst käme die Meldung bei jedem Neuladen wieder.
  history.replaceState(history.state, '', location.pathname + location.search);
}
applyTextSize(getTextSize());
try {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (!getThemeOverride()) applyTheme(null); // nur relevant, wenn "System" aktiv ist
  });
} catch { /* z.B. sehr alter Browser ohne addEventListener auf MediaQueryList */ }

const initialDeepLink = parseDeepLink(location.search);
if (initialDeepLink) {
  applyDeepLink(initialDeepLink);
  // Parameter wieder entfernen, sonst spränge ein späteres Neuladen erneut dorthin.
  history.replaceState(history.state, '', location.pathname + location.hash);
}

const { data: { session } } = await supabase.auth.getSession();
state.session = session;
state.loading = false;
render();
