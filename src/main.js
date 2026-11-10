// Logbuch - Einstieg. Die App-Logik liegt in Modulen unter src/, eins je Bereich (Übersicht:
// docs/module.md). Die Module werden hier in der Reihenfolge des früheren Gesamtskripts
// geladen, damit Code, der beim Laden läuft (Event-Listener, Theme), wie vorher nacheinander läuft.
import './lib/config.js';
import './lib/crypto.js';
import './domain/fields.js';
import './domain/dates.js';
import './state/state.js';
import './ui/navigation.js';
import './lib/strings.js';
import './lib/i18n.js';
import './lib/theme.js';
import './lib/format.js';
import './data/notices.js';
import './data/data.js';
import './data/keys.js';
import './features/field-form.js';
import './features/type-change.js';
import './features/section-form.js';
import './data/save.js';
import './data/device.js';
import './data/account.js';
import './ui/auth-view.js';
import './ui/row-view.js';
import './ui/stats-view.js';
import './ui/about-view.js';
import './ui/templates.js';
import './ui/fields-view.js';
import './ui/tutorial.js';
import './ui/main-view.js';
import './ui/events.js';
import './ui/gestures.js';
import './ui/deeplinks.js';
import './features/session.js';
import { ARRIVED_VIA_EMAIL_CHANGE, ARRIVED_VIA_SIGNUP_CONFIRM, MAIL_LINK_ERROR, supabase } from './lib/config.js';
import { state } from './state/state.js';
import { applyTextSize, applyTheme, getTextSize, getThemeOverride } from './lib/theme.js';
import { resetIOSZoomOnStandaloneStart } from './data/device.js';
import { initAuthView, isInstallGateSkipped } from './ui/auth-view.js';
import { initMainView, render } from './ui/main-view.js';
import { applyDeepLink, initDeeplinks, parseDeepLink } from './ui/deeplinks.js';
import { initNavigation, syncLayerHistory } from './ui/navigation.js';
import { initFormat } from './lib/format.js';
import { initNotices } from './data/notices.js';
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
