import { currentLocale, t, tPlain } from './i18n.js';
import { esc } from './html.js';

// --- Datum/Zeit: locale-abhängige Formatierung -----------------------------
// Ersetzt frühere feste WEEKDAYS/MONTHS-Arrays + manuelles DD.MM.YYYY-Bauen.
// Die Montag-zuerst-Wochentag-Reihenfolge ((d.getDay()+6)%7) bleibt an den
// jeweiligen Aufrufstellen unverändert — reine Tages-Erzeugungslogik, keine
// Formatierungsfrage, dafür hat Intl kein verlässliches Grid-Primitiv.
function localeTag() {
  return currentLocale === 'en' ? 'en-US' : 'de-DE';
}
const dtfCache = new Map();
// Sprache der App + Region des Geräts ("en" + "GB" -> en-GB): Datums-Schreibweise und 12 oder
// 24 Stunden hängen an der Region, nicht an der Sprache - in England 30/10/2026 statt der
// US-Schreibweise, ein englisch eingestelltes Handy in Deutschland zeigt 24 Stunden. Ohne
// erkennbare Region wie localeTag().
function regionTag() {
  try {
    const region = new Intl.Locale(navigator.language).maximize().region;
    if (region) return `${currentLocale}-${region}`;
  } catch { /* alter Browser */ }
  return localeTag();
}
const clock12hCache = new Map();
export function clockUses12h() {
  const tag = regionTag();
  if (!clock12hCache.has(tag)) {
    let twelve = false;
    try {
      // Die Gewohnheit der Region (getHourCycles); DateTimeFormat allein nähme die der
      // Sprache ("de-US" ergäbe 24 Stunden).
      const loc = new Intl.Locale(tag);
      const hc = (loc.getHourCycles?.() || loc.hourCycles)?.[0]
        || new Intl.DateTimeFormat(tag, { hour: 'numeric' }).resolvedOptions().hourCycle;
      twelve = hc === 'h11' || hc === 'h12';
    } catch { /* dann 24 Stunden */ }
    clock12hCache.set(tag, twelve);
  }
  return clock12hCache.get(tag);
}
export function dtf(options) {
  const tag = regionTag();
  const key = tag + JSON.stringify(options);
  if (!dtfCache.has(key)) dtfCache.set(key, new Intl.DateTimeFormat(tag, options));
  return dtfCache.get(key);
}
export function weekdayShort(date) { return dtf({ weekday: 'short' }).format(date); }
export function weekdayLong(date) { return dtf({ weekday: 'long' }).format(date); }
export function monthName(date) { return dtf({ month: 'long' }).format(date); }
export function monthShort(date) { return dtf({ month: 'short' }).format(date); }
// 2024-01-01 ist ein Montag – fester Referenzpunkt, um Montag-zuerst-Kurznamen
// unabhängig vom aktuellen Datum aus Intl zu erzeugen (reine Label-Erzeugung, hat
// nichts mit der eigentlichen Tages-Reihenfolge-Logik an den Aufrufstellen zu tun).
export function mondayFirstWeekdayShortNames() {
  return Array.from({ length: 7 }, (_, i) => weekdayShort(new Date(2024, 0, 1 + i)));
}
export function longDate(date) { return dtf({ day: 'numeric', month: 'long', year: 'numeric' }).format(date); }
export function formatDMY(dateKeyOrDate) {
  const d = typeof dateKeyOrDate === 'string' ? new Date(dateKeyOrDate + 'T00:00:00') : dateKeyOrDate;
  return dtf({ year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

// Einzige Quelle für die client-seitig angezeigte Mindestlänge (Browser-Validierung
// via minlength-Attribut). Muss mit dem serverseitigen Supabase-Wert
// (auth.minimum_password_length in supabase/config.toml, Dashboard-verwaltet)
// übereinstimmen, ist aber rein kosmetisch — Supabase lehnt zu kurze Passwörter
// ohnehin serverseitig ab, unabhängig von diesem Attribut.
export const AUTH_MIN_PASSWORD_LENGTH = 10;

// Supabase liefert Auth-Fehlermeldungen nur auf Englisch. "Invalid login credentials"
// bleibt bewusst unspezifisch (verrät nicht, ob die E-Mail existiert oder nur das
// Passwort falsch ist — sonst ließe sich der Nutzerbestand durchscannen), wird aber
// zumindest übersetzt. Unbekannte Meldungen kommen unverändert durch.
const AUTH_ERROR_TRANSLATIONS = {
  de: {
    'Invalid login credentials': 'E-Mail oder Passwort falsch.',
    'User already registered': 'Für diese E-Mail gibt es schon ein Konto.',
    'Email not confirmed': 'Bitte bestätige zuerst deine E-Mail-Adresse über den Link, den wir dir geschickt haben.',
  },
  en: {
    'Invalid login credentials': 'Email or password incorrect.',
    'User already registered': 'An account already exists for this email address.',
    'Email not confirmed': 'Please confirm your email address first via the link we sent you.',
  },
};
export function translateAuthError(message) {
  // "Password should be at least N characters" trägt die serverseitig konfigurierte
  // Mindestlänge direkt in der Zahl — fest übersetzte Strings würden bei jeder
  // künftigen Policy-Änderung wieder auseinanderlaufen (genau das ist hier passiert,
  // als minimum_password_length von 6 auf 10 erhöht wurde).
  const shortMatch = /^Password should be at least (\d+) characters?/.exec(message);
  if (shortMatch) return tPlain('auth.error.passwordTooShort', { min: shortMatch[1] });
  return (AUTH_ERROR_TRANSLATIONS[currentLocale] || AUTH_ERROR_TRANSLATIONS.de)[message] || message;
}

// Text-/Passwort-Eingabe mit optionalem "×"-Button zum Leeren (nur wenn nicht leer)
// und optionalem Sichtbar/Verbergen-Umschalter fürs Passwort — beides eigene kleine
// Buttons statt nativer Browser-Mechanismen, damit es plattformübergreifend gleich
// aussieht/funktioniert.
export function clearableInputHtml(id, type, value, opts = {}) {
  const { autocomplete = '', required = true, minlength, showVisibilityToggle = false, visible = false } = opts;
  const inputType = showVisibilityToggle ? (visible ? 'text' : 'password') : type;
  return `
    <div class="input-clear-wrap">
      <input type="${inputType}" id="${id}" value="${esc(value)}" ${required ? 'required' : ''}
        ${autocomplete ? `autocomplete="${autocomplete}"` : ''} ${minlength ? `minlength="${minlength}"` : ''} />
      ${value ? `<button type="button" class="input-clear-btn" data-action="clear-input" data-target="${id}" tabindex="-1" aria-label="${esc(t('ariaLabel.clearInput'))}">×</button>` : ''}
    </div>
  `;
}

// "?" mit Erklärung für alles, was nicht dauernd dastehen muss. Öffnet eine schwebende
// Sprechblase am "?" (openInfoTip), über dem Inhalt - nichts verschiebt sich (Nutzer, Hub 1.1:
// vorher klappte ein kleiner blasser Text auf, schob das Formular weg und ging trotzdem unter).
export function infoTip(text) {
  return `<button type="button" class="info-tip" data-tip="${esc(text)}" aria-expanded="false" aria-label="${esc(t('ariaLabel.explain'))}">?</button>`;
}
export let infoPop = null; // { btn, el }
export function closeInfoTip(focusBack = false) {
  if (!infoPop) return;
  const { btn, el } = infoPop;
  infoPop = null;
  el.remove();
  btn.setAttribute('aria-expanded', 'false');
  btn.removeAttribute('aria-controls');
  if (focusBack && btn.isConnected) btn.focus();
}
// Im Dokument verankert (scrollt mit der Seite), unter dem "?" bzw. darüber, wenn unten kein
// Platz ist; waagerecht innerhalb des Bildschirms.
function openInfoTip(btn) {
  closeInfoTip();
  const el = document.createElement('div');
  el.className = 'info-pop';
  el.id = 'info-pop';
  el.setAttribute('role', 'note');
  el.tabIndex = -1;
  el.innerHTML = `<p>${esc(btn.dataset.tip)}</p><button type="button" class="info-pop-close" aria-label="${esc(t('common.close'))}">×</button>`;
  document.body.append(el);
  const b = btn.getBoundingClientRect();
  const w = el.offsetWidth, h = el.offsetHeight;
  const margin = 16, gap = 10;
  const left = Math.min(Math.max(margin, b.left + b.width / 2 - w / 2), window.innerWidth - margin - w);
  const above = b.bottom + gap + h > window.innerHeight - margin && b.top - gap - h > margin;
  el.classList.toggle('info-pop--above', above);
  el.style.left = `${left + window.scrollX}px`;
  el.style.top = `${(above ? b.top - gap - h : b.bottom + gap) + window.scrollY}px`;
  el.style.setProperty('--arrow-x', `${b.left + b.width / 2 - left}px`);
  btn.setAttribute('aria-expanded', 'true');
  btn.setAttribute('aria-controls', 'info-pop');
  infoPop = { btn, el };
  el.focus({ preventScroll: true }); // Screenreader lesen die Erklärung gleich vor
}

// Handgezeichneter Inline-SVG-Linienverlauf für ein Zahlenwert-Feld über eine Menge von
// Datums-Keys — bewusst ohne Chart-Library (keine Abhängigkeit für ein paar Linien).
export function round1(n) { return Math.round(n * 10) / 10; }

// Was beim Start einmal laufen muss (Event-Listener u.ä.). Nicht beim Laden des Moduls, sondern
// vom Einstieg (main.js) aufgerufen, in fester Reihenfolge, wenn alle Module geladen sind.
export function initFormat() {
  // Scrollt ein Bereich innerhalb der Seite (z. B. ein Dialog), stimmt die Lage nicht mehr: zu.
  document.addEventListener('scroll', (e) => {
    if (infoPop && e.target !== document && !infoPop.el.contains(e.target)) closeInfoTip();
  }, true);
  window.addEventListener('resize', () => closeInfoTip());
  // Vor allen anderen Klick-Handlern (Erfassungsphase): "?" öffnet/schließt, Antippen woanders
  // schließt die Blase (ohne den Tipp selbst zu schlucken).
  document.addEventListener('click', (e) => {
    const tip = e.target.closest?.('.info-tip');
    if (tip) {
      e.preventDefault();
      e.stopPropagation();
      if (infoPop?.btn === tip) closeInfoTip();
      else openInfoTip(tip);
      return;
    }
    if (e.target.closest?.('.info-pop-close')) { closeInfoTip(true); return; }
    if (infoPop && !e.target.closest?.('.info-pop')) closeInfoTip();
  }, true);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && infoPop) {
      e.preventDefault();
      e.stopImmediatePropagation();
      closeInfoTip(true);
    }
  }, true);
}
