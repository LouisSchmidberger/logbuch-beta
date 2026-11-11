// --- i18n --------------------------------------------------------------
// Flache Keys ("namespace.element"), DE und EN in schlüsselgleicher Reihenfolge
// zum leichten Diffen. t(key, params) interpoliert {platzhalter} aus params (wird
// dabei automatisch esc()'t) — das Template selbst bleibt unescaped, darf also
// bewusst gesetztes HTML wie <strong> enthalten.
// Die Texte selbst stehen je Sprache in strings-de.js und strings-en.js.
import { STRINGS_DE } from './strings-de.js';
import { STRINGS_EN } from './strings-en.js';

export const STRINGS = { de: STRINGS_DE, en: STRINGS_EN };
