// Klick-Aktionen: Anmelden, Onboarding, Ersatzschlüssel. Schlüssel = data-action; die Event-Delegation in events.js ruft
// handler(el, e, action) auf, nachdem sie eine alte Meldung und ein offenes Zeilen-Menü weggeräumt hat.

import { confirmSpareKey, regenerateRecoveryKey } from '../../data/keys.js';
import { supabase } from '../../lib/config.js';
import { formatRecoveryKey } from '../../lib/crypto.js';
import { t } from '../../lib/i18n.js';
import { setOnbInProgress, setOnbMode } from '../../state/onboarding-state.js';
import { restoreModalFocus, runtime, state } from '../../state/state.js';
import { rememberOnbIncludesInstall, resendConfirmEmail } from '../auth-view.js';
import { render } from '../main-view.js';

export const authActions = {
  'onb-mode': (el, e, action) => {
    setOnbMode(el.dataset.mode);
    setOnbInProgress(true);
    rememberOnbIncludesInstall();
    // Von der Einstiegsfrage aus erst die persönliche Nachricht; in der frisch installierten
    // App (iPhone) kam sie schon im Browser, dort direkt weiter.
    state.authMode = state.authMode === 'mode' ? 'intro' : 'signup';
    render();
    document.querySelector('.auth-box h1, .auth-box .sub')?.focus({ preventScroll: true });
  },
  'check-mail-done': (el, e, action) => {
    // Die Hilfe beim Anmelden erscheint wieder, falls die Adresse doch noch nicht bestätigt ist.
    state.confirmEmailFor = null;
    state.confirmResend = null;
    state.authMode = 'signin';
    render();
    document.querySelector('.auth-box .sub')?.focus({ preventScroll: true });
  },
  'auth-choose': (el, e, action) => {
    // Wer "Ich habe schon ein Konto" wählt, richtet kein neues Konto ein.
    if (el.dataset.mode === 'signin' && ['welcome', 'installed'].includes(state.authMode)) setOnbInProgress(false);
    state.authMode = el.dataset.mode;
    state.authError = null;
    state.notice = null;
    render();
    // Neue Seite: Fokus auf ihren Titel (nicht ins E-Mail-Feld - das öffnete auf dem Handy
    // sofort die Tastatur).
    document.querySelector(['welcome', 'mode', 'intro', 'overview', 'installed'].includes(state.authMode) ? '.auth-box h1' : '.auth-box .sub')?.focus({ preventScroll: true });
  },
  'resend-confirm': (el, e, action) => {
    if (state.confirmEmailFor && state.confirmResend !== 'sending') resendConfirmEmail();
  },
  'start-forgot': (el, e, action) => {
    state.authMode = 'forgot';
    state.authError = null;
    render();
  },
  'cancel-forgot': (el, e, action) => {
    state.authMode = 'signin';
    state.authError = null;
    render();
  },
  'toggle-recovery-fallback': (el, e, action) => {
    state.recoveryFallbackConfirm = !state.recoveryFallbackConfirm;
    state.authError = null;
    render();
  },
  'spare-key-method': async (el, e, action) => {
    const shown = state.recoveryKeyToShow;
    if (!shown) return;
    shown.method = el.dataset.method;
    shown.used = true;
    shown.ask = false;
    if (shown.method === 'copy') {
      try {
        await navigator.clipboard.writeText(formatRecoveryKey(shown.hex));
      } catch {
        state.notice = { type: 'error', text: t('recoveryDisplay.copyFailed') };
      }
    } else if (shown.method === 'file') {
      const blob = new Blob(
        [`${t('recoveryDisplay.fileTitle')}\n${formatRecoveryKey(shown.hex)}\n\n${t('recoveryDisplay.fileBody')}\n`],
        { type: 'text/plain' }
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = t('recoveryDisplay.fileName');
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 60_000); // siehe handleExportData
    }
    render();
  },
  'spare-key-done': async (el, e, action) => {
    const shown = state.recoveryKeyToShow;
    if (!shown) return;
    // Ohne benutzten Weg - oder nach "Aufschreiben", wo die App nicht sehen kann, ob es
    // passiert ist - einmal freundlich nachfragen.
    if (!shown.used || shown.method === 'write') {
      shown.ask = true;
      render();
      document.querySelector('.spare-key-ask .auth-submit')?.focus();
      return;
    }
    await confirmSpareKey();
  },
  'spare-key-ask-back': (el, e, action) => {
    if (state.recoveryKeyToShow) state.recoveryKeyToShow.ask = false;
    render();
  },
  'spare-key-finish': async (el, e, action) => {
    await confirmSpareKey();
  },
  'regenerate-recovery-key': (el, e, action) => {
    runtime.modalTriggerSelector = '[data-action="regenerate-recovery-key"]';
    state.regenKeyConfirm = true;
    state.menuOpen = false;
    render();
  },
  'regen-key-cancel': (el, e, action) => {
    state.regenKeyConfirm = false;
    render();
    restoreModalFocus();
  },
  'regen-key-confirm': async (el, e, action) => {
    state.regenKeyConfirm = false;
    runtime.modalTriggerSelector = null; // danach kommt die Anzeige des neuen Schlüssels
    await regenerateRecoveryKey();
  },
  'dismiss-install-hint': (el, e, action) => {
    try { localStorage.setItem('installHintDismissed', 'true'); } catch { /* egal, blendet dann halt nicht dauerhaft aus */ }
    render();
  },
  'onb-display-toggle': (el, e, action) => {
    state.onbDisplayOpen = !state.onbDisplayOpen;
    render();
  },
  'install-prompt': async (el, e, action) => {
    // Android/Chrome: echter Installations-Dialog statt Anleitung (beforeinstallprompt).
    if (!runtime.deferredInstallPrompt) return;
    runtime.deferredInstallPrompt.prompt();
    const { outcome } = await runtime.deferredInstallPrompt.userChoice;
    runtime.deferredInstallPrompt = null;
    if (outcome === 'accepted') runtime.appJustInstalled = true;
    render();
  },
  'install-gate-skip': (el, e, action) => {
    try { localStorage.setItem('installGateSkipped', 'true'); } catch { /* dann eben nur für diesen Besuch */ }
    runtime.installGateSkippedThisVisit = true;
    render();
  },
  'spam-feedback': (el, e, action) => {
    // Ohne render(): auf der Passwort-Seite ginge sonst ein schon getipptes Passwort verloren.
    runtime.spamFeedbackAnswered = true;
    const box = el.closest('.spam-feedback');
    box.innerHTML = `<p class="spam-feedback-q" role="status" tabindex="-1">${t('spamFeedback.thanks')}</p>`;
    box.querySelector('[role="status"]').focus();
    supabase.rpc('record_signup_mail_feedback', { p_in_spam: el.dataset.inSpam === 'true' })
      .then(() => {}, () => {}); // best effort - eine fehlende Rückmeldung ist kein Problem für den Nutzer
  },
  'confirm-landing-continue': (el, e, action) => {
    state.confirmLanding = false;
    render();
  },
  'clear-input': (el, e, action) => {
    const id = el.dataset.target;
    if (id === 'email') state.authEmail = '';
    if (id === 'password') state.authPassword = '';
    render();
    document.getElementById(id)?.focus();
  },
  'toggle-password-visibility': (el, e, action) => {
    state.authPasswordVisible = !state.authPasswordVisible;
    render();
    const input = document.getElementById('password');
    if (input) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
  },
};
