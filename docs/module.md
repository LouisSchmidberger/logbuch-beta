# Module (Aufbau des Frontend-Codes)

Die App-Logik liegt in ES-Modulen unter `src/<schicht>/`, eins je Bereich; `src/main.js` ist nur
der Einstieg. Vite bündelt sie beim Build zu einer Datei (docs/freigabe.md). Gestaltung in
`src/logbuch.css`. Nächste Schritte (Vitest, TypeScript): docs/umbau.md.

Entstanden 2026-11-10 durch Aufteilen der früheren Einzeldatei (15.000 Zeilen) an ihren
Abschnitts-Überschriften; 2026-11-11 in Schichten ohne Kreis-Imports und Ordner je Schicht
geordnet. Beides mit unverändertem Verhalten (alle Rundgang-Bilder vorher/nachher gleich).

## Schichten

Ein Modul importiert nur aus seiner eigenen oder einer tieferen Schicht, nie im Kreis. Der
Linter prüft beides (`import/no-restricted-paths` je Ordner, `import/no-cycle`). Kreise machen
die Lade-Reihenfolge vom Zufall des Import-Netzes abhängig und verwischen, was wovon abhängt.

| Schicht (Ordner) | Module | Inhalt |
|---|---|---|
| Grundlagen (`lib/`) | `strings`, `i18n`, `config`, `crypto`, `theme`, `platform`, `html`, `format`, `calendar`, `feature-access`, `render-request` | Texte und `t()`; Supabase-Client; Verschlüsselung; Dark Mode/Textgröße; Geräteerkennung; `esc`, `app` (das `#app`-Element), Icons, Screenreader-Ansagen; Datums-/Zahlenformate; reine Datumsrechnung; Schalter (`featureOn`); Haken in die Oberfläche (unten) |
| Zustand (`state/`) | `state`, `onboarding-state` | `state`, `runtime`, aktueller Schlüssel; Onboarding-/Tutorial-Stand |
| Fachlogik (`domain/`) | `dates`, `fields`, `scores` | Zeitpläne, Zeiträume, Farben; Feld-Definitionen, Gruppen-Anordnung, berechnete Felder, Ziele; Bewertungen und Kennzahlen |
| Daten (`data/`) | `errors`, `push-device`, `data`, `save`, `changelog`, `keys`, `account`, `device`, `notices` | Fehlertexte (mit Zwangs-Abmeldung); Push dieses Geräts; Laden; Speichern und Notizen; "Was ist neu"; Schlüssel-Ablauf; Export/Löschen; Installation und Push; Meldungen |
| Abläufe (`features/`) | `session`, `field-form`, `form-baseline`, `type-change`, `section-form`, `reminder-input` | Anmeldung; Feld-Formular; Rückfrage bei ungespeicherten Änderungen; Stufen/Typ ändern; Gruppen-Formular; Eingabe der Erinnerungszeit |
| Oberfläche (`ui/`) | `*-view`, `templates`, `tutorial`, `navigation`, `gestures`, `deeplinks`, `events`, `actions/*` | Bildschirme; Vorlagen; Tutorial; Ebenen und Android-Zurück; Wischen/Ziehen; Deep-Links; Event-Delegation; Klick-Aktionen je Bereich |
| Start (`src/main.js`) | `main` | Startreihenfolge |

## Regeln

- **Nach oben nur über `render-request.js`.** `requestRender()` statt `render()`,
  `refreshOpenMarkers()`, `requestLayerSync()`: `main.js` trägt die echten Funktionen der
  Oberfläche beim Start ein (`setRenderHooks`). Nur `events.js` und `ui/actions/` (nur von
  `events.js` importiert) rufen `render()` direkt. Braucht ein tieferes Modul etwas Neues von oben, zuerst prüfen, ob
  es nicht nach unten gehört (die meisten Kreise lagen an Helfern im falschen Modul).
- **Beim Laden eines Moduls läuft nichts außer Deklarationen.** Event-Listener und anderer
  Start-Code stehen in `init<Modul>()` am Modulende; `main.js` ruft alle in fester
  Reihenfolge auf. Grund: die Reihenfolge, in der der Browser Module auswertet, folgt dem
  Import-Netz, nicht der Dateiliste - Code beim Laden griffe sonst auf Konstanten anderer
  Module zu, die noch nicht ausgewertet sind ("Cannot access … before initialization").
  Dasselbe gilt für Startwerte von Konstanten: aus einem anderen Modul nur
  Funktionen aufrufen, keine Konstanten lesen (Beispiel `timePickerMax` in `row-view`).
- **Variablen, die mehrere Module setzen, stehen in `runtime`** (`state.js`). ES-Module
  können eine importierte Variable nicht neu zuweisen, eine Eigenschaft eines geteilten
  Objekts schon. `state` bleibt für das, was gerendert wird; `runtime` sind Merker für Abläufe.
  Eine Variable, die nur ihr eigenes Modul setzt, bleibt dort als `let`.
- **Neue Klick-Aktion** = neuer Eintrag in der passenden Tabelle in `src/ui/actions/`
  (`'aktion': (el, e, action) => { … }`), nicht im Verteiler.
- **Was die Tests prüfen, muss exportiert sein** (`src/logic.test.js` importiert direkt,
  `dev/sync-tests.mjs` über die Vorschau, die alle Exporte durchreicht).
- Der Linter (`npm run lint`) meldet nicht importierte Namen und Kreise - nach dem
  Verschieben von Code zwischen Modulen zuerst laufen lassen.
