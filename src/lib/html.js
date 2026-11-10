export function esc(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export const app = document.getElementById('app');

// Symbole an Menüpunkten, Seitenköpfen und Abschnitts-Überschriften - alle an EINER Stelle,
// damit der geplante Wechsel von Emojis zu eigenen, gezeichneten Symbolen (Gestaltungs-
// Durchgang) nur hier passiert. Dekorativ (aria-hidden), der Text daneben sagt dasselbe.
// Symbole (Nutzer-Entscheidung 2026-10-29: eigene, gezeichnete statt Emojis, Stil "Feder +
// Moos-Fläche"): einfarbige Linie in Textfarbe, Flächen (class "f") leicht in Moos - passt sich
// so Dunkelmodus und Textgröße an und sieht auf jedem Gerät gleich aus (Emojis nicht). Raster
// 24x24, Strich/Farbe per CSS (.icon). Alle Symbole stehen hier; neue im selben Stil zeichnen.
const PEN = '<path class="f" d="M4.5 19.5l1-4.2L15.8 5a1.8 1.8 0 0 1 2.6 0l.6.6a1.8 1.8 0 0 1 0 2.6L8.7 18.5z"/><path d="M14 7l3 3"/>';

const BELL = '<path class="f" d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>';

const PALETTE = '<path class="f" d="M12 3.5a8.5 8.5 0 1 0 0 17c1.4 0 2-1 1.6-2.1-.5-1.3.3-2.4 1.7-2.4H18a2.5 2.5 0 0 0 2.5-2.5c0-5.5-3.8-10-8.5-10z"/><circle cx="8" cy="11" r="1"/><circle cx="11" cy="7.5" r="1"/><circle cx="15.5" cy="8.5" r="1"/>';

const SPARKLE = '<path class="f" d="M12 3.5l1.8 5.2 5.2 1.8-5.2 1.8L12 17.5l-1.8-5.2L5 10.5l5.2-1.8z"/><path d="M18.5 16v4M16.5 18h4"/>';

const ICONS = {
  manage: PEN, newField: PEN, fields: PEN, write: PEN,
  settings: '<path class="f" d="M12.0 4.8L13.9 2.7L15.6 3.2L16.0 6.0L17.1 6.9L19.9 6.7L20.8 8.4L19.1 10.6L19.2 12.0L21.3 13.9L20.8 15.6L18.0 16.0L17.1 17.1L17.3 19.9L15.6 20.8L13.4 19.1L12.0 19.2L10.1 21.3L8.4 20.8L8.0 18.0L6.9 17.1L4.1 17.3L3.2 15.6L4.9 13.4L4.8 12.0L2.7 10.1L3.2 8.4L6.0 8.0L6.9 6.9L6.7 4.1L8.4 3.2L10.6 4.9Z"/><circle cx="12" cy="12" r="3"/>',
  about: '<path class="f" d="M12 6.5C10 5 7 4.5 4 5v13c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5V5c-3-.5-6 0-8 1.5z"/><path d="M12 6.5v13"/>',
  feedback: '<path class="f" d="M4 5.5h16v10.5H10.5L6.5 20v-4H4z"/>',
  newGroup: '<path class="f" d="M3.5 6.5v12a1 1 0 0 0 1 1h15a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1h-8l-2-2.5h-5a1 1 0 0 0-1 1z"/>',
  reminders: BELL,
  remindersOff: BELL + '<path d="M4 4l16 16"/>',
  display: PALETTE, appearance: PALETTE,
  account: '<circle class="f" cx="12" cy="8" r="3.5"/><path class="f" d="M5 20c.5-3.8 3.3-6 7-6s6.5 2.2 7 6z"/>',
  a11y: '<circle cx="12" cy="4.5" r="1.5"/><path d="M5 8.5l7 1.5 7-1.5M12 10v4.5M12 14.5l-3 6M12 14.5l3 6"/>',
  mentalHealth: '<path class="f" d="M12 20s-7.5-4.6-7.5-10A4.2 4.2 0 0 1 12 7.6 4.2 4.2 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/>',
  privacy: '<rect class="f" x="5" y="11" width="14" height="9.5" rx="1.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3M12 14.5v2.5"/>',
  usage: '<circle cx="12" cy="12" r="8"/><circle class="f" cx="12" cy="12" r="3.5"/>',
  news: SPARKLE,
  install: '<rect class="f" x="7" y="3" width="10" height="18" rx="2"/><path d="M11 18h2"/>',
  hello: '<path class="f" d="M6 17a6 6 0 0 1 12 0z"/><path d="M3.5 17h17M12 5.5V8M5.5 9l1.7 1.7M18.5 9l-1.7 1.7M8 20.5h8"/>',
  calendar: '<rect class="f" x="4" y="5.5" width="16" height="14.5" rx="1.5"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
  mail: '<rect class="f" x="3.5" y="6" width="17" height="12.5" rx="1.5"/><path d="M4 7l8 6 8-6"/>',
  key: '<circle class="f" cx="8" cy="15" r="4"/><path d="M11 12l8.5-8.5M16.5 6.5L19 9M14 9l2 2"/>',
  tip: '<path class="f" d="M8.6 14.2a5.5 5.5 0 1 1 6.8 0c-.8.7-1.2 1.6-1.3 2.8H9.9c-.1-1.2-.5-2.1-1.3-2.8z"/><path d="M10 20h4"/>',
  celebrate: '<path class="f" d="M4 20l4.5-11 6.5 6.5z"/><path d="M14 4.5v2M19.5 10h-2M17 6l1.5-1.5M12 8.5c1-1 1-2.5 0-3.5M15.5 12c1-1 2.5-1 3.5 0"/>',
  sprout: '<path d="M12 21v-8.5"/><path class="f" d="M12 12.5C12 8.5 9 6 4.5 6c0 4.2 3 6.5 7.5 6.5z"/><path class="f" d="M12 14.5c0-3.2 2.4-5.5 6.5-5.5 0 3.3-2.4 5.5-6.5 5.5z"/>',
  photo: '<path class="f" d="M4 8.5h3.5L9 6h6l1.5 2.5H20V19H4z"/><circle cx="12" cy="13.5" r="3.2"/>',
  file: '<path d="M12 4v9.5M8.5 10l3.5 3.5 3.5-3.5"/><path class="f" d="M4 15.5h4l1 2h6l1-2h4v4H4z"/>',
  copy: '<rect class="f" x="5.5" y="5" width="13" height="16" rx="1.5"/><path d="M9 5V3.5h6V5M9 11h6M9 15h4"/>',
  done: '<circle class="f" cx="12" cy="12" r="8.5"/><path d="M8 12.5l2.7 2.7L16 9.5"/>',
  stats: '<path d="M4 20h16"/><rect class="f" x="5.5" y="12" width="3" height="6"/><rect class="f" x="10.5" y="7" width="3" height="11"/><rect class="f" x="15.5" y="10" width="3" height="8"/>',
};

export function iconSvg(name) {
  return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONS[name]}</svg>`;
}

export function icon(name) {
  return `<span class="item-icon" aria-hidden="true">${iconSvg(name)}</span>`;
}

export function announce(text) {
  const el = document.getElementById('sr-announcer');
  if (!el || !text) return;
  el.textContent = '';
  setTimeout(() => { el.textContent = text; }, 50); // leeren + neu setzen: auch Gleiches wird erneut angesagt
}

export function announceAlert(text) {
  const el = document.getElementById('sr-alert');
  if (!el || !text) return;
  el.textContent = '';
  setTimeout(() => { el.textContent = text; }, 50);
}
