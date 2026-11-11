// Klick-Aktionen: Felder, Gruppen, Formulare. Schlüssel = data-action; die Event-Delegation in events.js ruft
// handler(el, e, action) auf, nachdem sie eine alte Meldung und ein offenes Zeilen-Menü weggeräumt hat.

import { newMultiOptionId } from '../../domain/fields.js';
import { clampHabitFormSteps, closeHabitForm, convertHabitToCounter, habitFormStepCount, habitFormStepValue, habitToForm, handleHabitSave, newHabitForm, resizeLabels, scheduleToForm, stepEditKey, syncHabitFormFromDom, typeEditKey } from '../../features/field-form.js';
import { openFormHasChanges, openHabitForm } from '../../features/form-baseline.js';
import { REMINDER_TIME_STEP, reminderTimePicked } from '../../features/reminder-input.js';
import { closeSectionForm, deleteSection, handleHabitDelete, openSectionForm, saveSectionForm } from '../../features/section-form.js';
import { applyStepEditPreset, applyTypeEditPreset, commitLayoutOrder, fieldMoveStep, finishStepChangeAction, handleHabitArchive, isTypeChange, runStepChange, startStepChange, startStepChangeUndo, stepEditNothingToDo, stepEditTo, typeChangeBlocker, typeChangeTargets, typeEditFinalMap, typeEditKindChanged, typeEditTo, usedValueRange } from '../../features/type-change.js';
import { announce, app } from '../../lib/html.js';
import { t, tPlain } from '../../lib/i18n.js';
import { TUTORIAL_STEP_DONE, TUTORIAL_STEP_FIELD } from '../../state/onboarding-state.js';
import { runtime, state } from '../../state/state.js';
import { render } from '../main-view.js';
import { effectivePreviewValue, openTimePicker, setPreviewValue } from '../row-view.js';
import { adjustTemplate, createFromTemplate, createStarterPackage, openTemplateFollowUp, packageFormState, readTemplateFromDom, startTemplateConfirm, templateById, undoTemplateMerge } from '../templates.js';
import { stepInput } from '../../lib/stepper.js';

// "type-edit-kind", "type-edit-preset"
const typeEditKindAction = (el, e, action) => {
  syncHabitFormFromDom();
  const f = state.habitForm;
  const h = state.habits.find((x) => x.defId === f.defId);
  if (!h || !f.typeEdit) return;
  if (action === 'type-edit-kind') typeEditKindChanged(h, f.typeEdit, el.dataset.kind);
  else {
    f.typeEdit.preset = el.dataset.preset;
    applyTypeEditPreset(h, f.typeEdit);
  }
  render();
  const attr = action === 'type-edit-kind' ? `data-kind="${el.dataset.kind}"` : `data-preset="${el.dataset.preset}"`;
  document.querySelector(`[data-action="${action}"][${attr}]`)?.focus();
};

// "stepper-inc", "stepper-dec"
const stepperIncAction = (el, e, action) => {
  // Nach Gedrückthalten hat stepperHold schon gezählt und gespeichert - der Klick beim
  // Loslassen darf nicht noch einen Schritt draufsetzen.
  if (runtime.stepperHoldSwallowClick) { runtime.stepperHoldSwallowClick = false; return; }
  const target = document.getElementById(el.dataset.target);
  if (!target) return;
  stepInput(target, action === 'stepper-inc' ? 1 : -1);
  target.dispatchEvent(new Event('change', { bubbles: true }));
  // Der change-Handler rendert neu und ersetzt dabei den Knopf - Fokus zurück, damit man
  // per Tastatur weiterzählen kann.
  document.querySelector(`[data-action="${action}"][data-target="${el.dataset.target}"]`)?.focus({ preventScroll: true });
};

export const fieldsActions = {
  'reminder-time-pick': (el, e, action) => {
    const labelId = (el.getAttribute('aria-labelledby') || '').split(' ')[0];
    openTimePicker({
      title: (labelId && document.getElementById(labelId)?.textContent.trim()) || t('time.label'),
      step: REMINDER_TIME_STEP, value: Number(el.dataset.value), triggerId: el.id,
      onPick: (v) => reminderTimePicked(el.id, v),
    });
  },
  'preview-select': (el, e, action) => {
    // Wie in "Heute": derselbe Wert nochmal entfernt ihn wieder.
    const v = JSON.parse(el.dataset.value);
    setPreviewValue(state.habitForm && effectivePreviewValue(state.habitForm) === v ? null : v, `[data-value='${JSON.stringify(v)}']`);
  },
  'preview-clear': (el, e, action) => {
    setPreviewValue(null, '.value-slider');
  },
  'habit-new': (el, e, action) => {
    openHabitForm(newHabitForm());
  },
  'group-new': (el, e, action) => {
    openSectionForm(null);
  },
  'section-edit': (el, e, action) => {
    openSectionForm(el.dataset.id);
  },
  'section-form-save': async (el, e, action) => {
    await saveSectionForm();
  },
  'section-form-cancel': (el, e, action) => {
    closeSectionForm();
    render();
  },
  'habit-edit': (el, e, action) => {
    const h = state.habits.find((x) => x.defId === el.dataset.id);
    if (h) openHabitForm(habitToForm(h));
  },
  'habit-reveal-next': (el, e, action) => {
    syncHabitFormFromDom();
    const f = state.habitForm;
    if (f.revealStage === 1 && !f.name.trim()) {
      state.notice = { type: 'error', text: t('habitForm.error.nameRequired') };
      render();
      document.getElementById('habit-form-name')?.focus();
      return;
    }
    f.revealStage = Math.min(3, f.revealStage + 1);
    render();
    // Zum neu aufgedeckten Teil scrollen und dort den Fokus setzen.
    const target = document.getElementById(f.revealStage === 2 ? 'habit-form-kind-field' : 'habit-form-details');
    target?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    (f.revealStage === 2 ? target?.querySelector('[aria-pressed="true"]') : document.querySelector('#habit-form .form-part[aria-labelledby="habit-form-part-entry"] :is(button, input)'))?.focus({ preventScroll: true });
  },
  'habit-convert-counter': (el, e, action) => {
    syncHabitFormFromDom();
    state.habitForm.convertConfirm = true;
    render();
    document.querySelector('[data-action="habit-convert-cancel"]')?.focus();
  },
  'habit-convert-cancel': (el, e, action) => {
    state.habitForm.convertConfirm = false;
    render();
    document.querySelector('[data-action="habit-convert-counter"]')?.focus();
  },
  'habit-convert-confirm': async (el, e, action) => {
    await convertHabitToCounter(state.habitForm.defId);
  },
  'step-edit-open': (el, e, action) => {
    syncHabitFormFromDom();
    const f = state.habitForm;
    const h = state.habits.find((x) => x.defId === f.defId);
    if (!h) return;
    f.stepEdit = { steps: h.max - h.min + 1, labels: h.labels ? [...h.labels] : null, preset: 'spread', map: {}, confirm: false };
    applyStepEditPreset(h, f.stepEdit);
    f.stepEdit.initial = stepEditKey(f.stepEdit);
    render();
    // Auf die Überschrift, nicht ins Zahlenfeld - dort ginge auf dem Handy sofort die Tastatur auf.
    document.getElementById('step-dialog-title')?.focus();
  },
  'type-edit-open': (el, e, action) => {
    const f = state.habitForm;
    const h = state.habits.find((x) => x.defId === f.defId);
    if (!h || !typeChangeTargets(h).length || typeChangeBlocker(h)) return;
    // Nach der Umwandlung wird das Formular neu aus dem Feld aufgebaut - andere Eingaben gingen verloren.
    if (openFormHasChanges()) {
      state.notice = { type: 'error', text: t('typeEdit.error.dirty') };
      render();
      return;
    }
    f.typeEdit = { kind: null, steps: 5, preset: 'round', unit: '', map: {}, confirm: false };
    typeEditKindChanged(h, f.typeEdit, typeChangeTargets(h)[0]);
    f.typeEdit.initial = typeEditKey(f.typeEdit);
    render();
    document.getElementById('step-dialog-title')?.focus();
  },
  'type-edit-kind': typeEditKindAction,
  'type-edit-preset': typeEditKindAction,
  'type-edit-apply': (el, e, action) => {
    syncHabitFormFromDom();
    const te = state.habitForm.typeEdit;
    if (!te) return;
    const { error } = typeEditFinalMap(te);
    if (error) state.notice = { type: 'error', text: t(error) };
    else te.confirm = true;
    render();
    document.querySelector(te.confirm ? '[data-action="type-edit-confirm-cancel"]' : '[data-action="type-edit-apply"]')?.focus();
  },
  'type-edit-confirm-cancel': (el, e, action) => {
    state.habitForm.typeEdit.confirm = false;
    render();
    document.querySelector('[data-action="type-edit-apply"]')?.focus();
  },
  'type-edit-confirm': async (el, e, action) => {
    const f = state.habitForm;
    const h = state.habits.find((x) => x.defId === f.defId);
    if (!h || !f.typeEdit?.confirm) return; // zweiter Tipp
    const te = f.typeEdit;
    const { map } = typeEditFinalMap(te);
    const to = typeEditTo(h, te);
    const extra = te.kind === 'scale' ? { preset: te.preset === 'custom' ? 'round' : te.preset, range: usedValueRange(h) } : {};
    f.typeEdit = null;
    f.typeRunning = true;
    finishStepChangeAction(f, await startStepChange(h.defId, to, map, extra), 'typeEdit.done', true);
  },
  'step-edit-cancel': (el, e, action) => {
    syncHabitFormFromDom();
    const wasType = !!state.habitForm.typeEdit;
    state.habitForm.stepEdit = null;
    state.habitForm.typeEdit = null;
    render();
    document.querySelector(wasType ? '[data-action="type-edit-open"]' : '[data-action="step-edit-open"]')?.focus();
  },
  'step-edit-preset': (el, e, action) => {
    syncHabitFormFromDom();
    const f = state.habitForm;
    const h = state.habits.find((x) => x.defId === f.defId);
    if (!h || !f.stepEdit) return;
    f.stepEdit.preset = el.dataset.preset;
    applyStepEditPreset(h, f.stepEdit);
    render();
    document.querySelector(`[data-action="step-edit-preset"][data-preset="${el.dataset.preset}"]`)?.focus();
  },
  'step-edit-apply': (el, e, action) => {
    syncHabitFormFromDom();
    const f = state.habitForm;
    const h = state.habits.find((x) => x.defId === f.defId);
    if (!h || !f.stepEdit) return;
    const se = f.stepEdit;
    if (se.labels && se.labels.some((l) => !l.trim())) {
      state.notice = { type: 'error', text: t('habitForm.error.fillAllLabels') };
    } else if (stepEditNothingToDo(h, se)) {
      state.notice = { type: 'error', text: t('stepEdit.error.nothing') };
    } else {
      se.confirm = true;
    }
    render();
    document.querySelector(se.confirm ? '[data-action="step-edit-confirm-cancel"]' : '[data-action="step-edit-apply"]')?.focus();
  },
  'step-edit-confirm-cancel': (el, e, action) => {
    state.habitForm.stepEdit.confirm = false;
    render();
    document.querySelector('[data-action="step-edit-apply"]')?.focus();
  },
  'step-edit-confirm': async (el, e, action) => {
    syncHabitFormFromDom();
    const f = state.habitForm;
    const h = state.habits.find((x) => x.defId === f.defId);
    if (!h || !f.stepEdit) return;
    const to = stepEditTo(h, f.stepEdit);
    const map = { ...f.stepEdit.map };
    f.stepEdit = null;
    finishStepChangeAction(f, await startStepChange(h.defId, to, map), 'stepEdit.done');
  },
  'step-edit-resume': async (el, e, action) => {
    syncHabitFormFromDom();
    const f = state.habitForm;
    const sc = state.habits.find((x) => x.defId === f.defId)?.stepChange;
    const type = !!sc && isTypeChange(sc);
    if (type) f.typeRunning = true;
    const doneKey = sc?.state === 'undo' ? (type ? 'typeEdit.undoDone' : 'stepEdit.undoDone') : (type ? 'typeEdit.done' : 'stepEdit.done');
    finishStepChangeAction(f, await runStepChange(f.defId), doneKey, type);
  },
  'step-undo': (el, e, action) => {
    syncHabitFormFromDom();
    state.habitForm.stepUndoConfirm = true;
    render();
    document.querySelector('[data-action="step-undo-cancel"]')?.focus();
  },
  'step-undo-cancel': (el, e, action) => {
    state.habitForm.stepUndoConfirm = false;
    render();
    document.querySelector('[data-action="step-undo"]')?.focus();
  },
  'step-undo-confirm': async (el, e, action) => {
    syncHabitFormFromDom();
    const f = state.habitForm;
    if (!f.stepUndoConfirm) return; // zweiter Tipp
    f.stepUndoConfirm = false;
    const sc = state.habits.find((x) => x.defId === f.defId)?.stepChange;
    const type = !!sc && isTypeChange(sc);
    if (type) f.typeRunning = true;
    finishStepChangeAction(f, await startStepChangeUndo(f.defId), type ? 'typeEdit.undoDone' : 'stepEdit.undoDone', type);
  },
  'habit-cancel': (el, e, action) => {
    closeHabitForm();
    render();
  },
  'habit-kind': (el, e, action) => {
    syncHabitFormFromDom();
    state.habitForm.kind = el.dataset.kind;
    render();
  },
  'section-delete-arm': (el, e, action) => {
    state.sectionDeleteConfirm = el.dataset.id;
    render();
  },
  'section-delete-cancel': (el, e, action) => {
    state.sectionDeleteConfirm = null;
    render();
  },
  'section-delete': async (el, e, action) => {
    await deleteSection(el.dataset.id);
  },
  'computed-type': (el, e, action) => {
    syncHabitFormFromDom();
    const f = state.habitForm;
    if (f.computedType !== el.dataset.type) {
      f.computedType = el.dataset.type;
      // Mitglieder der anderen Art passen nicht mehr - raus damit.
      f.members = f.members.filter((key) => {
        const h = state.habits.find((x) => x.id === key);
        // "Dauer" wählt seine zwei Felder über eigene Auswahllisten (durationFrom/To).
        return h && f.computedType !== 'duration' && f.computedType !== 'since' && (f.computedType === 'number' ? h.kind === 'number' : h.kind === 'scale');
      });
    }
    render();
    document.querySelector(`[data-action="computed-type"][data-type="${el.dataset.type}"]`)?.focus();
  },
  'multi-option-add': (el, e, action) => {
    syncHabitFormFromDom();
    const option = { id: newMultiOptionId(), label: '' };
    state.habitForm.multiOptions.push(option);
    render();
    document.getElementById(`habit-form-multi-option-${option.id}`)?.focus();
  },
  'multi-option-remove': (el, e, action) => {
    syncHabitFormFromDom();
    state.habitForm.multiOptions = state.habitForm.multiOptions.filter((o) => o.id !== el.dataset.option);
    render();
    app.querySelector('[data-action="multi-option-add"]')?.focus();
  },
  'multi-option-hide': (el, e, action) => {
    syncHabitFormFromDom();
    const option = state.habitForm.multiOptions.find((o) => o.id === el.dataset.option);
    if (option) option.hidden = !option.hidden;
    render();
  },
  'tpl-pick': (el, e, action) => {
    startTemplateConfirm(state.habitForm, el.dataset.template);
    if (templateById(el.dataset.template).direct) {
      adjustTemplate(state.habitForm);
      render();
      window.scrollTo(0, 0);
      document.getElementById('habit-form-name')?.focus();
      return;
    }
    render();
    window.scrollTo(0, 0);
    document.getElementById(`tpl-name-${templateById(el.dataset.template).slots[0].slot}`)?.focus({ preventScroll: true });
  },
  'tpl-good': (el, e, action) => {
    readTemplateFromDom(state.habitForm);
    state.habitForm.template.answers.good = el.dataset.good || null;
    render();
  },
  'pkg-single': (el, e, action) => {
    state.habitForm.template = { stage: 'pick' };
    render();
    window.scrollTo(0, 0);
  },
  'tpl-package': (el, e, action) => {
    if (state.habitForm.packageChosen) state.habitForm.template = { stage: 'package' };
    else Object.assign(state.habitForm, packageFormState());
    render();
    window.scrollTo(0, 0);
  },
  'pkg-create': async (el, e, action) => {
    if (state.habitFormSaving) return;
    state.habitFormSaving = true;
    render();
    let result;
    try { result = await createStarterPackage(state.habitForm.packageChosen); } finally { state.habitFormSaving = false; }
    if (result.notice) state.notice = result.notice;
    else {
      closeHabitForm();
      if (state.tutorialStep === TUTORIAL_STEP_FIELD) {
        runtime.tutorialLastFieldDefId = result.habits[0]?.defId ?? null;
        state.tutorialStep = TUTORIAL_STEP_DONE;
      } else {
        state.notice = { type: 'ok', text: tPlain(result.habits.length === 1 ? 'pkg.createdOne' : 'pkg.created', { count: result.habits.length }) };
      }
    }
    render();
  },
  'tpl-custom': (el, e, action) => {
    delete state.habitForm.template;
    render();
    window.scrollTo(0, 0);
    document.getElementById('habit-form-name')?.focus();
  },
  'tpl-back': (el, e, action) => {
    state.habitForm.template = { stage: 'pick' };
    render();
    window.scrollTo(0, 0);
  },
  'tpl-adjust': (el, e, action) => {
    adjustTemplate(state.habitForm);
    render();
    window.scrollTo(0, 0);
  },
  'tpl-create': async (el, e, action) => {
    if (state.habitFormSaving) return;
    readTemplateFromDom(state.habitForm);
    state.habitFormSaving = true;
    render();
    let result;
    try { result = await createFromTemplate(state.habitForm); } finally { state.habitFormSaving = false; }
    if (result.notice) state.notice = result.notice;
    else if (result.followUp) {
      closeHabitForm();
      openTemplateFollowUp(result.followUp);
    } else if (result.merged) {
      closeHabitForm();
      const m = result.merged;
      state.notice = {
        type: m.notArchived ? 'error' : 'ok',
        text: m.notArchived
          ? tPlain('tpl.error.mergeArchive', { fields: m.notArchived.join(', ') })
          : tPlain('tpl.merged', { names: result.habits.map((h) => h.name).join(', '), fields: m.names.join(', ') }),
        action: {
          label: t('notice.undo'),
          run: async () => {
            await undoTemplateMerge(m);
            state.notice = { type: 'ok', text: tPlain('tpl.mergeUndone') };
            render();
          },
        },
      };
    } else {
      closeHabitForm();
      state.notice = { type: 'ok', text: tPlain('tpl.created', { names: result.habits.map((h) => h.name).join(', ') }) };
      if (state.tutorialStep === TUTORIAL_STEP_FIELD) {
        // "Zurück" von "Geschafft" öffnet das erste angelegte Feld, nicht ein berechnetes am Ende.
        runtime.tutorialLastFieldDefId = result.habits[0].defId;
        state.tutorialStep = TUTORIAL_STEP_DONE;
      }
    }
    render();
  },
  'since-value': (el, e, action) => {
    syncHabitFormFromDom();
    const f = state.habitForm;
    const v = Number(el.dataset.value);
    f.sinceValues = f.sinceValues.includes(v) ? f.sinceValues.filter((x) => x !== v) : [...f.sinceValues, v].sort((a, b) => a - b);
    render();
    document.querySelector(`[data-action="since-value"][data-value="${v}"]`)?.focus();
  },
  'since-mode': (el, e, action) => {
    syncHabitFormFromDom();
    state.habitForm.sinceMode = el.dataset.mode === 'start' ? 'start' : 'last';
    render();
    document.querySelector(`[data-action="since-mode"][data-mode="${el.dataset.mode}"]`)?.focus();
  },
  'habit-reminder-add': (el, e, action) => {
    syncHabitFormFromDom();
    const f = state.habitForm;
    // Neue Zeit: eine Stunde nach der letzten; geht das nicht (spät abends), die erste volle
    // Stunde, die noch frei ist - nie eine schon vorhandene Zeit.
    const last = f.reminderTimes[f.reminderTimes.length - 1];
    const next = last + 60 <= 1425 && !f.reminderTimes.includes(last + 60) ? last + 60
      : Array.from({ length: 24 }, (_, h) => h * 60).find((m) => !f.reminderTimes.includes(m));
    f.reminderTimes = [...f.reminderTimes, next];
    // Bedingung der neuen Zeit: wie die letzte (alle oder keine brauchen eine Zahl).
    f.reminderBelow = [...f.reminderBelow, f.reminderBelow[f.reminderBelow.length - 1] ?? ''];
    render();
    const i = f.reminderTimes.length - 1;
    document.getElementById(`habit-form-reminder-time-${i}`)?.focus();
  },
  'habit-reminder-remove': (el, e, action) => {
    syncHabitFormFromDom();
    const f = state.habitForm;
    const i = Number(el.dataset.index);
    f.reminderTimes = f.reminderTimes.filter((_, j) => j !== i);
    f.reminderBelow = f.reminderBelow.filter((_, j) => j !== i);
    render();
    // Fokus nicht ins Leere: auf die Zeile, die jetzt an dieser Stelle steht (sonst die letzte).
    // Ohne Zeiten mehr: auf "+ Weitere Zeit".
    const rest = document.getElementById(`habit-form-reminder-time-${Math.min(i, f.reminderTimes.length - 1)}`);
    (rest || document.querySelector('[data-action="habit-reminder-add"]'))?.focus();
  },
  'habit-schedule-mode': (el, e, action) => {
    syncHabitFormFromDom();
    state.habitForm.schedule.mode = el.dataset.mode;
    render();
    document.querySelector(`[data-action="habit-schedule-mode"][data-mode="${el.dataset.mode}"]`)?.focus();
  },
  'habit-schedule-day': (el, e, action) => {
    syncHabitFormFromDom();
    const sch = state.habitForm.schedule;
    const day = Number(el.dataset.day);
    sch.days = sch.days.includes(day) ? sch.days.filter((d) => d !== day) : [...sch.days, day];
    render();
    // render() baut das Formular neu auf - Fokus zurück auf denselben Button, sonst
    // landet man per Tastatur nach jedem Umschalten wieder am Seitenanfang.
    document.querySelector(`[data-action="habit-schedule-day"][data-day="${el.dataset.day}"]`)?.focus();
  },
  'habit-good': (el, e, action) => {
    syncHabitFormFromDom();
    state.habitForm.good = el.dataset.good || null;
    render();
  },
  'habit-entry-mode': (el, e, action) => {
    syncHabitFormFromDom();
    state.habitForm.kind = el.dataset.kind;
    render();
  },
  'habit-summary': (el, e, action) => {
    syncHabitFormFromDom();
    state.habitForm.summary = el.dataset.summary === 'sum' ? 'sum' : 'avg';
    render();
    document.querySelector(`[data-action="habit-summary"][data-summary="${state.habitForm.summary}"]`)?.focus();
  },
  'habit-numgoal': (el, e, action) => {
    syncHabitFormFromDom();
    state.habitForm.numberGoalDir = el.dataset.dir || null;
    render();
    if (state.habitForm.numberGoalDir) document.getElementById('habit-form-numgoal-value')?.focus();
  },
  'habit-numgoal-scope': (el, e, action) => {
    syncHabitFormFromDom();
    state.habitForm.numberGoalScope = el.dataset.scope === 'week' ? 'week' : 'day';
    render();
    document.querySelector(`[data-action="habit-numgoal-scope"][data-scope="${state.habitForm.numberGoalScope}"]`)?.focus();
  },
  'habit-period': (el, e, action) => {
    syncHabitFormFromDom();
    const f = state.habitForm;
    f.period = el.dataset.period;
    f.periodReminderDay = null; // Standardtag des neuen Zeitraums
    if (f.period !== 'day') { f.sectionId = null; f.schedule = scheduleToForm(null); }
    render();
  },
  'habit-start': (el, e, action) => {
    syncHabitFormFromDom();
    const f = state.habitForm;
    const steps = habitFormStepCount(f);
    f.min = Number(el.dataset.start) === 0 ? 0 : 1;
    f.max = f.min + steps - 1;
    render();
  },
  'habit-display-style': (el, e, action) => {
    syncHabitFormFromDom();
    const f = state.habitForm;
    f.displayStyle = el.dataset.style;
    clampHabitFormSteps(f);
    f.labels = resizeLabels(f.labels, habitFormStepCount(f), f.labelsEnabled ? (i) => String(habitFormStepValue(f, i)) : undefined);
    render();
  },
  'habit-steps-to-slider': (el, e, action) => {
    // Am Deckel für gezielt wählbare Stufen (siehe atChoiceCap in renderHabitForm):
    // Schieberegler ohne Bezeichnungen, danach direkt weiter hochzählen können. Die
    // Bezeichnungs-Texte bleiben im Formular-Zustand erhalten (resizeLabels), falls man
    // zurückwechselt.
    syncHabitFormFromDom();
    const f = state.habitForm;
    f.displayStyle = 'slider';
    f.labelsEnabled = false;
    render();
    document.getElementById('habit-form-steps')?.focus();
  },
  'stepper-inc': stepperIncAction,
  'stepper-dec': stepperIncAction,
  'habit-save': async (el, e, action) => {
    await handleHabitSave();
  },
  'habit-archive': async (el, e, action) => {
    await handleHabitArchive(el.dataset.id, true);
  },
  'habit-reactivate': async (el, e, action) => {
    await handleHabitArchive(el.dataset.id, false);
  },
  'habit-delete-arm': (el, e, action) => {
    state.habitDeleteConfirm = el.dataset.id;
    render();
  },
  'habit-delete-cancel': (el, e, action) => {
    state.habitDeleteConfirm = null;
    render();
  },
  'habit-delete': async (el, e, action) => {
    state.habitDeleteConfirm = null;
    await handleHabitDelete(el.dataset.id);
  },
  'habit-move': async (el, e, action) => {
    if (el.closest('.manage-item')?.dataset.orderType === 'habit') {
      // Tastatur-/Klick-Alternative zum Ziehen für ein Feld, auch in/aus Gruppen
      // (fieldMoveStep); speichert über denselben Pfad wie das Ziehen (commitLayoutOrder).
      const defId = el.closest('.manage-item').dataset.orderId;
      const before = state.habits.find((h) => h.defId === defId)?.sectionId ?? null;
      const step = fieldMoveStep(defId, el.dataset.dir);
      if (!step) return;
      await commitLayoutOrder(step.items);
      // Fokus auf denselben Button am neuen Platz (render() hat das DOM ersetzt); ist er dort
      // gesperrt (ganz oben/unten), auf den anderen.
      const btn = (dir) => document.querySelector(`.manage-item[data-order-id="${defId}"] [data-action="habit-move"][data-dir="${dir}"]`);
      const target = btn(el.dataset.dir);
      (target && !target.disabled ? target : btn(el.dataset.dir === 'up' ? 'down' : 'up'))?.focus();
      // Wechsel des Behälters ansagen - sonst merkt man ohne Blick nicht, dass das Feld jetzt
      // in einer Gruppe steht bzw. sie verlassen hat.
      if (step.sectionId !== before) {
        const sec = state.sections.find((x) => x.id === step.sectionId);
        announce(sec ? tPlain('manage.movedIntoGroup', { name: sec.name }) : tPlain('manage.movedOutOfGroup'));
      }
    } else {
      // Gruppen-Block: nur auf der obersten Ebene. Liest wie der Drag-Handler die aktuellen
      // Geschwister direkt aus dem DOM, damit beide Wege exakt dieselbe Reihenfolge berechnen
      // und über commitLayoutOrder() denselben Persistenz-Pfad nutzen.
      const rowEl = el.closest('.manage-item');
      const rows = [...rowEl.parentElement.children].filter((r) => r.classList.contains('manage-item'));
      const fromIndex = rows.indexOf(rowEl);
      const toIndex = el.dataset.dir === 'up' ? fromIndex - 1 : fromIndex + 1;
      if (toIndex < 0 || toIndex >= rows.length) return;
      const reordered = [...rows];
      const [movedEl] = reordered.splice(fromIndex, 1);
      reordered.splice(toIndex, 0, movedEl);
      await commitLayoutOrder(reordered.map((r) => ({ type: r.dataset.orderType, id: r.dataset.orderId })));
      // Fokus auf denselben Button am neuen Platz (render() hat das DOM ersetzt).
      document.querySelector(`.manage-item[data-order-id="${rowEl.dataset.orderId}"] [data-action="habit-move"][data-dir="${el.dataset.dir}"]`)?.focus();
    }
  },
};
