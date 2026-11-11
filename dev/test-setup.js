// Vitest (npm test): Umgebung wie der Testbrowser der Rundgänge (dev/lib.mjs) - Sprache de-DE,
// Zeitzone Europe/Berlin (vite.config.js setzt TZ). Die Erwartungen der Tests hängen davon ab
// (Wochentage, Zahlen- und Datumsformate).
const lang = process.env.PREVIEW_LANG || 'de-DE';
Object.defineProperty(navigator, 'language', { get: () => lang, configurable: true });
Object.defineProperty(navigator, 'languages', { get: () => [lang, lang.split('-')[0]], configurable: true });
// jsdom kennt matchMedia nicht; der Testbrowser antwortet "nein" (nicht installiert, hell).
window.matchMedia = (media) => ({
  matches: false, media, onchange: null,
  addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false,
});
