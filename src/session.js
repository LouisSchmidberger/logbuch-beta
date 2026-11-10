import { supabase } from './config.js';
import { currentDek, currentDekUserId, rememberSignedInHere, runtime, setCurrentDek, state } from './state.js';
import { t } from './i18n.js';
import { loadEntries, loadHabits, loadSections, loadUserSettings, presetWeekStartForNewAccount, repadOldEntries, resumeWeekStartChange } from './data.js';
import { clearLoadedAccountState, fetchEncryptionRow, maybeShowSpareKey, unlockEncryption, usableCachedDek } from './keys.js';
import { resumeStepChanges } from './type-change.js';
import { checkPushStatus } from './device.js';
import { loadFeatureAccess } from './feature-access.js';
import { saveFieldNamesForPush } from './push-device.js';
import { requestRender } from './render-request.js';

// --- Auth-Status & Start ---------------------------------------------------
export async function completeAuthFlow(userId, password, { verifyPassword = false } = {}) {
  runtime.accountGoneHandled = false;
  await unlockEncryption(userId, password, { verifyPassword });
  state.loading = true;
  requestRender();
  await Promise.all([loadEntries(), loadHabits(), loadUserSettings(), loadSections(), loadFeatureAccess()]);
  state.loading = false;
  saveFieldNamesForPush(); // erst nach loadUserSettings - die Textvorlage hängt an der Sprache
  repadOldEntries();
  resumeStepChanges();
  resumeWeekStartChange();
  presetWeekStartForNewAccount();
  checkPushStatus().then(requestRender);
  requestRender();
  maybeShowSpareKey();
}

// Was beim Start einmal laufen muss (Event-Listener u.ä.). Nicht beim Laden des Moduls, sondern
// vom Einstieg (main.js) aufgerufen, in fester Reihenfolge, wenn alle Module geladen sind.
export function initSession() {
  supabase.auth.onAuthStateChange(async (event, session) => {
    state.session = session;
    if (session) rememberSignedInHere();
    state.authError = null;
    if (event === 'PASSWORD_RECOVERY') {
      state.passwordRecovery = true;
      requestRender();
      return;
    }
    if (runtime.authFlowInFlight) { requestRender(); return; }
    if (session) {
      // Schon entsperrt und dasselbe Konto: z.B. die stündliche Token-Erneuerung oder die
      // Rückkehr in die App - sichtbar ändert sich nichts. Bewusst KEIN render(): der würde
      // die ganze Ansicht neu aufbauen und dabei Getipptes, aber noch nicht Gespeichertes
      // (z.B. den Namen im Feld-Formular) verwerfen.
      if (currentDek && currentDekUserId === session.user.id) return;
      // Schlüssel eines ANDEREN Kontos geladen (z.B. in einem anderen Tab umgemeldet):
      // alles davon verwerfen, sonst würde mit fremdem Schlüssel unter diesem Konto
      // gespeichert.
      if (currentDek) clearLoadedAccountState();
      // Kein Passwort verfügbar (Session-Wiederherstellung, z.B. Browser-Reload) - nur
      // der lokale Cache kann hier helfen, sonst muss renderUnlockPrompt() greifen.
      state.loading = true;
      runtime.sessionRestoreInFlight = true;
      requestRender();
      // Ohne Verbindung lässt sich der Cache nicht gegen die aktuelle Kennung prüfen -
      // dann lieber das Passwort abfragen als womöglich mit einem veralteten Schlüssel
      // zu speichern (laden ließe sich ohne Verbindung ohnehin nichts).
      let cached = null;
      let row = null;
      try {
        try {
          row = await fetchEncryptionRow(session.user.id);
          const result = await usableCachedDek(session.user.id, row);
          cached = result.dek;
          if (result.stale) state.unlockError = t('unlock.keyChanged');
        } catch { /* -> renderUnlockPrompt */ }
        if (cached) {
          setCurrentDek(cached, row.dek_id, session.user.id);
          runtime.spareKeyPending = !row.recovery_key_confirmed;
          await Promise.all([loadEntries(), loadHabits(), loadUserSettings(), loadSections(), loadFeatureAccess()]);
          saveFieldNamesForPush(); // siehe completeAuthFlow
          repadOldEntries();
          resumeStepChanges();
          resumeWeekStartChange();
          presetWeekStartForNewAccount();
          checkPushStatus().then(requestRender);
        }
      } finally {
        // Auch bei einem unerwarteten Fehler, sonst bliebe der Startbildschirm für immer stehen.
        state.loading = false;
        runtime.sessionRestoreInFlight = false;
      }
      maybeShowSpareKey();
    } else {
      clearLoadedAccountState();
    }
    requestRender();
  });
}
