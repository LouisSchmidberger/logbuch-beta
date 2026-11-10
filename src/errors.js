// Best effort, ausgelöst aus translateDbError: lokale Session sofort verwerfen
// (scope: 'local' statt des Standard-Aufrufs, da der Server bei einem bereits
// gelöschten Account ohnehin keinen gültigen Refresh-Token mehr kennt - der
// Server-Roundtrip darf das lokale Ausloggen nicht blockieren). runtime.accountGoneHandled
// verhindert, dass mehrere gleichzeitig fehlschlagende Requests das mehrfach anstoßen.
import { supabase } from './config.js';
import { t } from './i18n.js';
import { clearCurrentDek, runtime } from './state.js';
import { endPushForThisDevice } from './push-device.js';
async function forceLogoutAccountGone() {
  if (runtime.accountGoneHandled) return;
  runtime.accountGoneHandled = true;
  clearCurrentDek();
  endPushForThisDevice({ deleteServerRow: false }); // Server-Zeilen sind mit dem Konto schon weg
  try { await supabase.auth.signOut({ scope: 'local' }); } catch { /* egal, wir wollen nur lokal raus */ }
}

// Übersetzt/vereinfacht technische Postgres-/Netzwerk-Fehlermeldungen (z.B. aus
// Datenbank-Operationen wie Feld anlegen/speichern) für Laien – die rohen
// Postgres-Meldungen (Constraint-Namen, Fachjargon) sind für Nicht-Techniker kaum
// verständlich. Unbekannte Meldungen kommen unverändert durch (wie
// translateAuthError), damit trotzdem etwas Nützliches angezeigt wird statt nichts.
export function translateDbError(message) {
  if (/duplicate key value violates unique constraint "habit_definitions_user_id_slug_key"/.test(message)) {
    return t('error.db.duplicateSlug');
  }
  if (/duplicate key value violates unique constraint/.test(message)) {
    return t('error.db.duplicateGeneric');
  }
  if (/violates not-null constraint/.test(message)) {
    return t('error.db.notNull');
  }
  if (/push subscription limit reached/.test(message)) {
    return t('error.db.pushLimit');
  }
  if (/violates check constraint/.test(message)) {
    return t('error.db.check');
  }
  if (/violates foreign key constraint "\w+_user_id_fkey"/.test(message)) {
    // Der referenzierte Account existiert serverseitig nicht mehr - z.B. von einem
    // anderen Gerät aus gelöscht, während dieses Gerät noch einen gültigen, aber
    // inzwischen verwaisten Access-Token hatte (Supabase kann bereits ausgestellte
    // Access-Token nicht vorzeitig entziehen, siehe docs/datenschutz-sicherheit.md). Statt des kryptischen FK-Fehlers hier lokal ausloggen.
    forceLogoutAccountGone();
    return t('error.db.accountGone');
  }
  if (/violates foreign key constraint/.test(message)) {
    return t('error.db.foreignKey');
  }
  if (/Failed to fetch|NetworkError|network error/i.test(message)) {
    return t('error.db.network');
  }
  if (/JWT expired|invalid JWT|refresh_token_not_found/i.test(message)) {
    return t('error.db.sessionExpired');
  }
  return message;
}

// Zentrale Stelle für state.notice → DOM: state.notice wird an vielen Stellen im
// Code gesetzt, aber nur hier gerendert — role/aria-live sorgen dafür, dass
// Screenreader neue Fehler-/Erfolgsmeldungen automatisch mitbekommen, ohne dass
// der Nutzer erst zur Meldung navigieren muss. Fehler unterbrechen sofort
// (assertive/alert), Erfolgsmeldungen kündigen sich nur höflich an (polite/status).
// state.notice.text ist reiner Text (wird hier escaped) - Meldungen mit Parametern
// deshalb mit tPlain(), nicht t() bauen.
// Fehlermeldung aus einem Fehler: verständlicher Satz vorn; bekannte Fehler übersetzt
// translateDbError in Klartext (Verbindung weg, Konto gelöscht …), alles andere kommt als
// "Bitte versuch es nochmal" plus aufklappbare technische Details (für Feedback an mich) -
// vorher stand der rohe Datenbank-Fehler direkt im Satz.
export function errorNotice(key, rawMessage) {
  const raw = String(rawMessage ?? '');
  const friendly = translateDbError(raw);
  const known = friendly !== raw;
  return { type: 'error', text: `${t(key)} ${known ? friendly : t('notice.tryAgain')}`, detail: known || !raw ? null : raw };
}
