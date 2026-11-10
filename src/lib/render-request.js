// Haken in die Oberfläche, ohne main-view.js/row-view.js/navigation.js zu importieren: main.js
// trägt beim Start die echten Funktionen ein (setRenderHooks). So hängen Module unterhalb der
// Oberfläche nicht an ihr, und es entstehen keine Kreis-Imports. Alle Aufrufe wirken sofort
// (synchron), genau wie ein direkter Aufruf.
import { app } from './html.js';

let hooks = null;
export function setRenderHooks(h) { hooks = h; }
// Neu zeichnen (render() in main-view.js).
export function requestRender() { hooks.render(); }
// Nur die "noch offen"-Punkte und den Stand des Tages nachziehen, ohne neu zu zeichnen
// (syncTodayOpenMarkers in row-view.js).
export function refreshOpenMarkers() { hooks.syncTodayOpenMarkers(); }
// Browser-Verlauf an die Zahl offener Ebenen anpassen (syncLayerHistory in navigation.js), für
// Ebenen außerhalb von render(), z.B. die Uhrzeit-Auswahl.
export function requestLayerSync() { hooks.syncLayerHistory(); }

// Neu zeichnen - außer jemand tippt gerade (Fokus in einem Eingabefeld): render() baut
// die Ansicht neu auf und würde Cursor/Tastatur mitten im Schreiben zurücksetzen. Der
// zusammengeführte Stand erscheint dann beim nächsten regulären Neuzeichnen.
export function renderUnlessTyping() {
  const el = document.activeElement;
  if (el && app.contains(el) && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && el.type !== 'checkbox' && el.type !== 'range'))) {
    refreshOpenMarkers();
    return;
  }
  requestRender();
}
