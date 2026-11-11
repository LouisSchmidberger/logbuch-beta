// Logbuch - Einstieg: trägt die Haken für render-request.js ein, ruft die init…()-Funktionen der
// Module in fester Reihenfolge auf und startet die App. Aufbau der Module: docs/module.md.
import { ARRIVED_VIA_EMAIL_CHANGE, ARRIVED_VIA_SIGNUP_CONFIRM, MAIL_LINK_ERROR, supabase } from './lib/config.js';
import { state } from './state/state.js';
import { applyTextSize, applyTheme, getTextSize, getThemeOverride } from './lib/theme.js';
import { resetIOSZoomOnStandaloneStart } from './data/device.js';
import { initAuthView, isInstallGateSkipped } from './ui/auth-view.js';
import { initMainView, render } from './ui/main-view.js';
import { applyDeepLink, initDeeplinks, parseDeepLink } from './ui/deeplinks.js';
import { initNavigation, syncLayerHistory } from './ui/navigation.js';
import { initFormat } from './lib/format.js';
import { initData } from './data/data.js';
import { initKeys } from './data/keys.js';
import { initSave } from './data/save.js';
import { initEvents } from './ui/events.js';
import { initGestures } from './ui/gestures.js';
import { initSession } from './features/session.js';
import { isMobileDevice, isStandaloneDisplay } from './lib/platform.js';
import { setRenderHooks } from './lib/render-request.js';
import { syncTodayOpenMarkers } from './ui/row-view.js';
import { TUTORIAL_STEP_FIELD } from './state/onboarding-state.js';
import { applyLocale, detectInitialLocale, initI18n, t } from './lib/i18n.js';
import { initNotices } from './ui/notices.js';

// Die echten Funktionen der Oberfläche für render-request.js eintragen, vor allem anderen.
setRenderHooks({ render, syncTodayOpenMarkers, syncLayerHistory });

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
