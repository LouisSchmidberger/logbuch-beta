// Zahlen-Eingabe mit +/- daneben (Feld-Formular, Stufen/Typ ändern); das Gedrückthalten steuert
// ui/notices.js (initNotices).
import { esc } from './html.js';
import { t } from './i18n.js';

// Zahlen-Eingabe mit +/- Buttons daneben, für kurze/eingeschränkte Wertebereiche
// (z.B. Anzahl Stufen) — spart das Eintippen. Ändert direkt das Input-Element und
// feuert ein 'change'-Event (siehe stepper-inc/-dec im Klick-Handler), damit ein
// evtl. daran hängender bestehender Change-Listener (z.B. für die Label-Stufenzahl)
// weiterhin greift.
export function stepperInput(id, value, min, max, disabled, extraAttrs = '') {
  return `
    <div class="stepper-row">
      <button type="button" class="stepper-btn" data-action="stepper-dec" data-target="${id}" ${disabled ? 'disabled' : ''} aria-label="${esc(t('ariaLabel.decrease'))}">−</button>
      <input type="number" id="${id}" min="${min}" max="${max}" value="${value}" ${extraAttrs} ${disabled ? 'disabled' : ''} />
      <button type="button" class="stepper-btn" data-action="stepper-inc" data-target="${id}" ${disabled ? 'disabled' : ''} aria-label="${esc(t('ariaLabel.increase'))}">+</button>
    </div>
  `;
}

// Einen Schritt am Zahlenfeld eines Steppers, begrenzt auf dessen min/max. Rückgabe: ob
// sich der Wert geändert hat.
export function stepInput(target, delta) {
  const min = target.min !== '' ? Number(target.min) : -Infinity;
  const max = target.max !== '' ? Number(target.max) : Infinity;
  const before = Math.round(Number(target.value));
  const n = Math.max(min, Math.min(max, before + delta));
  target.value = n;
  return n !== before;
}
