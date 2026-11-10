// Klick-Aktionen: Tutorial und Einführungskarten. Schlüssel = data-action; die Event-Delegation in events.js ruft
// handler(el, e, action) auf, nachdem sie eine alte Meldung und ein offenes Zeilen-Menü weggeräumt hat.

import { activeHabits } from '../../domain/fields.js';
import { habitToForm, newHabitForm } from '../../features/field-form.js';
import { TUTORIAL_STEP_DONE, TUTORIAL_STEP_FIELD, TUTORIAL_STEP_HELLO, TUTORIAL_STEP_REMINDERS, isGuided, setTodayIntroPending } from '../../state/onboarding-state.js';
import { restoreModalFocus, runtime, state } from '../../state/state.js';
import { render } from '../main-view.js';
import { saveOnboardingCompleted } from '../tutorial.js';

export const tutorialActions = {
  'group-tip-hide': (el, e, action) => {
    try { localStorage.setItem('groupTipDismissed', 'true'); } catch { /* dann eben nur bis zum Neuladen */ }
    render();
    document.querySelector('[data-action="group-new"]')?.focus({ preventScroll: true });
  },
  'today-intro-next': (el, e, action) => {
    // Ohne data-Merkmal für "letzte Karte", damit der Fokus beim Weiterblättern auf dem
    // Knopf bleibt (restoreFocus findet ihn über data-action).
    const lastStep = (isGuided() ? 3 : 1) - 1;
    if ((state.todayIntroStep || 0) >= lastStep) { setTodayIntroPending(false); state.todayIntroStep = 0; }
    else state.todayIntroStep = (state.todayIntroStep || 0) + 1;
    render();
  },
  'tutorial-next': (el, e, action) => {
    state.tutorialStep = Math.min(TUTORIAL_STEP_REMINDERS, state.tutorialStep + 1);
    render();
  },
  'tutorial-back': (el, e, action) => {
    // Gibt neuen Nutzern Vertrauen ("kann ich aus Versehen zu weit geklickt haben?"),
    // obwohl technisch nichts verloren geht — jede Einstellung lässt sich später über
    // Menü/Formular erneut ändern. state.habitForm wird mit geleert, damit beim Zurück
    // von "Geschafft" ein frisches Formular statt des schon gespeicherten erscheint.
    // Schritt 1 hat keinen Zurück-Knopf (davor liegt nichts mehr).
    // Nach "Tutorial überspringen" gibt es noch kein Feld - dann zurück zum Feld-Schritt
    // statt zu "Dein erstes Feld steht". Umgekehrt beim zweiten Feld ("Noch ein Feld
    // anlegen"): zurück zu "Geschafft", wo man herkam, nicht zum Anfang.
    // Von "Geschafft" aus öffnet Zurück das eben angelegte Feld zum Bearbeiten - ein leeres
    // Formular verleitete dazu, das Feld zum "Korrigieren" ein zweites Mal anzulegen.
    const hasField = activeHabits().length > 0;
    const justCreated = state.tutorialStep === TUTORIAL_STEP_DONE
      ? activeHabits().find((h) => h.defId === runtime.tutorialLastFieldDefId) : null;
    state.tutorialStep = state.tutorialStep === TUTORIAL_STEP_REMINDERS && !hasField ? TUTORIAL_STEP_FIELD
      : state.tutorialStep === TUTORIAL_STEP_FIELD && hasField ? TUTORIAL_STEP_DONE
      : Math.max(TUTORIAL_STEP_HELLO, state.tutorialStep - 1);
    state.habitForm = justCreated ? { ...habitToForm(justCreated), revealStage: 3 } : null;
    render();
  },
  'tutorial-add-more': (el, e, action) => {
    state.tutorialStep = TUTORIAL_STEP_FIELD;
    state.habitForm = { ...newHabitForm(), revealStage: 1 };
    render();
    document.getElementById('habit-form-name')?.focus();
  },
  'tutorial-finish': async (el, e, action) => {
    await saveOnboardingCompleted();
  },
  'tutorial-skip-arm': (el, e, action) => {
    runtime.modalTriggerSelector = '[data-action="tutorial-skip-arm"]';
    state.tutorialSkipConfirm = true;
    render();
  },
  'tutorial-skip-cancel': (el, e, action) => {
    state.tutorialSkipConfirm = false;
    render();
    restoreModalFocus();
  },
  'tutorial-skip-confirm': (el, e, action) => {
    // Überspringt nur das Tutorial - die Erinnerungen sind ein eigener Schritt und kommen trotzdem.
    state.tutorialSkipConfirm = false;
    state.habitForm = null; // sonst bliebe das Feld-Formular unsichtbar weiter offen
    state.tutorialStep = TUTORIAL_STEP_REMINDERS;
    render();
  },
};
