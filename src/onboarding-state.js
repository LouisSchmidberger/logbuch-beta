// --- Onboarding-Gerüst (seit 2026-10-01) ------------------------------------------
// Einstiegsfrage "Wie möchtest du starten?": Schritt für Schritt (mehr Erklärung offen)
// oder Kurz und knapp. EIN Ablauf für beide - Faustregel: klarer formulieren gilt für
// alle, mehr erklären bekommt nur, wer Schritt für Schritt gewählt hat (aufklappbare
// Erklärungen sind dann von Anfang an offen, siehe whyBox). Gemerkt nur auf dem Gerät.
// iPhone: Safari und die installierte App teilen keinen Speicher - die frisch installierte
// App fragt deshalb noch einmal (authMode 'installed').
import { t } from './i18n.js';
import { runtime } from './state.js';
export function getOnbMode() {
  try { return localStorage.getItem('onboardingMode'); } catch { return null; } // 'guided' | 'short' | null
}

export function setOnbMode(mode) {
  try { localStorage.setItem('onboardingMode', mode); } catch { /* dann eben nur bis zum Neuladen */ }
  runtime.onbModeThisVisit = mode;
}

export function isGuided() { return (getOnbMode() || runtime.onbModeThisVisit) === 'guided'; }

// Läuft gerade das Einrichten eines neuen Kontos (von "Ich bin neu hier" bis zum gesicherten
// Ersatzschlüssel)? Steuert die Fortschrittsleiste auf den Seiten davor und danach.
export function isOnbInProgress() {
  try { return localStorage.getItem('onboardingInProgress') === 'true'; } catch { return runtime.onbInProgressThisVisit; }
}

export function setOnbInProgress(on) {
  runtime.onbInProgressThisVisit = on;
  try { if (on) localStorage.setItem('onboardingInProgress', 'true'); else localStorage.removeItem('onboardingInProgress'); } catch { /* s.o. */ }
}

// Bausteine der Tutorial-Bildschirme (Neufassung 2026-09-29): ein Bildschirm, ein
// Thema - Symbol, kurze Überschrift, der eine wichtige Satz fett, Begründungen im
// wiedererkennbaren "Warum?"-Kasten (Leitlinie des Nutzers: nie nur sagen, dass etwas so
// ist, sondern warum; locker statt förmlich, die App als Freund). Fortschritt über die
// Leiste des ganzen Einrichtens (onbProgress), das Tutorial ist darin Etappe "kennenlernen".
// Die Erinnerungen kommen erst nach dem ersten Feld (Nutzer-Entscheidung 2026-10-12): dann
// weiß man, woran erinnert wird, und die Frage kann das Feld nennen.
export const TUTORIAL_STEP_HELLO = 1;

export const TUTORIAL_STEP_FIELD = 2;

export const TUTORIAL_STEP_DONE = 3;

export const TUTORIAL_STEP_REMINDERS = 4; // eigene Etappe, nicht Teil des Tutoexport rials

export const TUTORIAL_STEPS = 3; // Unterschritte der Etappe "kennenlernen"

// "Warum?"/"Genauer erklären": aufklappbar - bei "Schritt für Schritt" von Anfang an offen.
export function whyBox(titleKey, bodyKey) {
  return `<details class="why-box" ${isGuided() ? 'open' : ''}><summary class="why-box-title">${t(titleKey)}</summary><p>${t(bodyKey)}</p></details>`;
}

// Einmalige Karte(n) oben in "Heute" direkt nach dem Einrichten eines neuen Kontos (nicht
// für Bestandsnutzer): Kurz und knapp eine Karte, Schritt für Schritt drei nacheinander.
// Erklärungen gehören dorthin, wo man sie braucht - vorher standen sie nur in "Über Logexport buch".
export function isTodayIntroPending() {
  try { return localStorage.getItem('todayIntroPending') === 'true'; } catch { return false; }
}

export function setTodayIntroPending(on) {
  try { if (on) localStorage.setItem('todayIntroPending', 'true'); else localStorage.removeItem('todayIntroPending'); } catch { /* dann eben ohne Karte */ }
}
