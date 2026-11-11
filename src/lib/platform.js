// --- "Zum Homescreen hinzufügen"-Hinweis --------------------------------
// Auf iOS funktioniert Web-Push NUR, wenn die Seite zum Home-Bildschirm hinzugefügt
// wurde (harte Plattform-Einschränkung seit iOS 16.4, kein normaler Safari-Tab-Push
// möglich) - auf Android/Desktop ist das "nice to have", kein Muss. Deshalb früh und
// deutlich darauf hinweisen, mit iOS-spezifischer Anleitung.
export function isStandaloneDisplay() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

export function isIOSDevice() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

export function isMobileDevice() {
  return isIOSDevice() || /Android/.test(navigator.userAgent);
}
