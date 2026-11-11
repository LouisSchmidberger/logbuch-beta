# Umbau: Build, TypeScript, Struktur

Plan für den schrittweisen Umbau über mehrere Sessions: Build-Schritt (Vite), TypeScript,
klare Schichten, Supabase hinter einem Modul, am Ende optional React. Grundlage war ein Review
von außen (2026-11-10); dieser Stand ist an das Repo angepasst. Wo die Datei dem Repo
widerspricht, gilt das Repo: Abweichung melden, nicht raten.

**Grundsatz: Der Umbau ändert kein Verhalten.** Nach jeder Phase läuft die App wie vorher und
darf dort stehen bleiben. Kein "alles oder nichts".

## Ausgangslage

Schon erledigt: Code in ES-Module unter `src/` aufgeteilt (docs/module.md, mit `runtime` und
`init…()`), ESLint, CI mit Tests, Rundgängen, Abgleich JS ↔ SQL und `deno check` der Functions,
feste Paketversionen in den Edge Functions, Phase 0 und 1 (unten). Die Module sind in Schichten
ohne Kreis-Imports geordnet (docs/module.md).

## Grundregeln (jede Phase)

1. **Nie auf `main` arbeiten.** Pro Phase ein Branch `umbau/phase-<n>-<thema>`, pro Schritt ein
   Commit. Neue Funktionen auf eigenen Branches, nie vermischt mit Umbau-Commits.
2. **Verschieben ist nicht Verbessern.** In einem Verschiebe-Commit keine Fehlerkorrektur,
   Umbenennung oder Umformatierung. Ein gefundener Fehler wird gemeldet und getrennt behoben.
3. **Kleine Schritte**, nach jedem Commit alles grün (Fertig-Kriterium).
4. **Der Nutzer entscheidet vor dem Start der Phase**: Deploy-Pipeline und Pages-Einstellungen,
   jede neue Laufzeit-Abhängigkeit (Paket, das im Bundle landet), eine State-Bibliothek, ob
   Phase 5 (React) kommt.
5. Umbau-Schritte gehören nicht ins `CHANGELOG`.
6. **Doku im selben Commit**: Stack und Konventionen in `CLAUDE.md`, `docs/module.md`,
   `dev/README.md`, `docs/freigabe.md` werden mit jeder Phase falsch, wenn sie nicht mitgehen.

### Unantastbar (nur auf ausdrückliche Anweisung)

- **Datenformat und Kryptografie**: Algorithmen, Auffüllung (`ENCRYPT_PAD_BLOCK`), IV,
  Schlüsselableitung, Aufbau von `habit_entries.data`, Byte für Byte. Live und Beta teilen
  **eine Datenbank**; die alte Live-Version muss lesen können, was die neue schreibt.
- Schutz in `loadEntries`/`saveDay`: Verwerfen bei gewechseltem `currentDek`,
  `keepLocalChanges`, nicht entschlüsselbare Tage nie überschreiben.
- `currentDek` nur über `setCurrentDek`/`clearCurrentDek`.
- `fetchWithJwtFutureRetry` (PGRST303); `authFlowInFlight` **vor** dem Auth-Aufruf;
  `fetchAllRows` (PostgREST kappt bei 1000 Zeilen).
- Zeitplan-Regeln in JS und SQL synchron (`dev/sync-tests.mjs`).
- CSP (`script-src 'self'`, `connect-src` nur eigenes Supabase), keine Drittanbieter zur
  Laufzeit (kein CDN, keine Google Fonts).
- `STRINGS`: `de` und `en` mit gleichen Keys in gleicher Reihenfolge.
- Vertrag App ↔ Service Worker: IndexedDB `logbuch-push`, Store `meta`
  (`saveFieldNamesForPush` ↔ `sw.js`).

### Fertig-Kriterium je Schritt

- `npm run lint`, `npm run build`, `npm test`, `node dev/rundgang.mjs alle` ohne Fehler;
  `npm run typecheck` nicht schlechter als vorher (Zahl der Meldungen).
- Rundgang-Bilder gegen die Baseline aus Phase 0: in den Phasen 1–4 **kein Pixel** anders
  (außer Datum und zufälligem Ersatzschlüssel).
- Neue Tabelle/Spalte/Supabase-Aufruf → `dev/mock-supabase.js` nachziehen.

## Git und Beta

- Vor Phase 1: `git tag vor-umbau` auf `main`.
- Ein Merge pro Phase; `main` bleibt immer deploybar, kein Force-Push auf `main`.
- Beta-Test eines Umbau-Branches (Nutzer-Entscheidung 2026-11-10: nach grünen lokalen Prüfungen
  ohne Rückfrage; Beta = Alltagskonto, Datenbank mit Live geteilt): `git push beta
  umbau/phase-…:main`, zurück mit `git push --force-with-lease beta main:main`.
- **Rückweg seit Phase 1**: veröffentlicht wird nur noch über den CI-Job `deploy`. Ein Stand
  ohne diesen Job (z.B. `vor-umbau`) veröffentlicht nichts, die Seite bliebe beim neuen Stand.
  Deshalb zurück immer vorwärts: `git revert` der Umbau-Commits, die `ci.yml` mit `deploy`
  bleibt. Notfalls Pages-Quelle wieder auf "Deploy from a branch" (main, Stamm) und den alten
  Stand pushen.
- Der Übergangs-Teil in `ci.yml` ("Stand vor dem Build … behalten") ist nach dem ersten
  Live-Deploy mit Vite überflüssig; in Phase 2 entfernen.
- Live wie in `CLAUDE.md` "Deployment": gesammelt, auf Okay des Nutzers.

## Phasen

### Phase 0: Absicherung (erledigt 2026-11-10)

- Tag `vor-umbau` auf dem Stand davor.
- Baseline-Bilder in `dev/screenshots/baseline/` (nicht im Git): `node dev/rundgang.mjs alle`
  für `handy`, `schmal`, `pc`, dazu `--theme=dark` und `--size=xlarge`. Gehen sie verloren:
  `git checkout vor-umbau`, neu erzeugen, zurück.
- Feste Krypto-Testdaten `dev/fixtures/crypto.json` mit `dev/crypto-tests.mjs` (läuft in der CI).
  Zieht der Krypto-Code nach `src/`, nur den Import-Pfad im Test anpassen.

### Phase 1: Build mit Vite und Typprüfung (erledigt 2026-11-10)

Grund: TypeScript kann Imports mit `?v=…` nicht auflösen (TS2307, gemessen); mit Vite
übernehmen Hash-Dateinamen das Cache-Busting. Stand:

- `vite.config.js`, Quellcode in `src/`, `public/` unverändert ins Ergebnis, Einstieg bleibt
  `logbuch.html`, `base: './'`. `supabase-js` 2.117.2 aus npm, `vendor/` entfällt.
- Vorschau = Vite-Build im Modus "preview" (Supabase-Nachbau per Alias, Vorschau-Haken an
  `main.js`), also derselbe gebündelte Code wie live. Die CI prüft, dass `dist/` keinen
  Vorschau-Code enthält; `dev/` wird nicht mehr veröffentlicht.
- Veröffentlichen über den CI-Job `deploy`, nur wenn alles grün ist; Skript und CSS des vorigen
  Stands bleiben eine Runde online (docs/freigabe.md).
- `npm run typecheck` (`checkJs`, nicht streng) läuft in der CI nur als Hinweis: 257 Meldungen
  zum Start, fast alle "Eigenschaft unbekannt" (`event.target.dataset` u. ä.), kein echter
  Fehler darunter gefunden. Abbau in Phase 3.
- Browser-Ziel wie vor dem Build (Safari 14, Chrome 87 usw., `vite.config.js`), damit CSS und JS
  auf älteren Geräten gleich bleiben. Unabhängiges Review vor dem Merge, Befunde behoben.
- Bildvergleich: alle Rundgang-Bilder gleich der Baseline außer dem zufälligen Ersatzschlüssel.
  Die Beispieldaten der Vorschau sind seitdem unabhängig von der Uhrzeit des Laufs.

### Phase 2: Struktur

- **Schichten ohne Kreis-Imports** (erledigt 2026-11-11): Grundlagen → Zustand → Fachlogik →
  Daten → Abläufe → Oberfläche → Start, nach oben nur über `render-request.js`; ESLint
  `import/no-cycle` als Fehler (docs/module.md). Pixelgleich gegen eine am selben Tag neu
  erzeugte Baseline (die Demo-Daten hängen vom Datum ab).
- **Ordner pro Schicht** (erledigt 2026-11-11): `src/lib`, `state`, `domain`, `data`, `features`,
  `ui`; der Linter verbietet Importe aus höheren Ordnern. Unterordner je Bereich
  (`src/ui/<name>/`) erst, wenn ein Bereich aus mehreren Dateien besteht.
- **Event-Registry** (erledigt 2026-11-11, Klicks): Tabellen `{ action: handler }` je Bereich in
  `src/ui/actions/`, die gemeinsame Vorarbeit bleibt im Verteiler in `events.js`. Alle 152
  Zweige maschinell als wörtlich übernommen geprüft. Die übrigen Listener (`change`, `input`,
  `keydown`) sind klein genug und bleiben vorerst Ketten.
- **Tests mit Vitest** (erledigt 2026-11-11): alle 86 Fälle 1:1 in `src/logic.test.js` (jsdom,
  ohne Browser); `dev/tests.mjs` entfällt. `internals` bleibt für `dev/sync-tests.mjs` (braucht
  die Datenbank). Aufteilen je Modul mit dem Umbenennen nach `.ts` (Phase 3). Rundgänge bleiben
  Puppeteer.
- `STRINGS` je Sprache (`src/lib/strings-de.js`/`-en.js`), `CHANGELOG` in `src/data/changelog.js`
  (erledigt 2026-11-11; `.ts` in Phase 3).
- ESLint `max-lines` 500 als Warnung, ohne Texte, `CHANGELOG` und Tests (erledigt 2026-11-11). Stand:
  8 Dateien darüber (Feld-Formular, Typ ändern, Feld-Aktionen, Anmelde-, Feld-, Haupt- und
  Zeilen-Ansicht, Vorlagen); Aufteilen bei Gelegenheit, ohne Eile.

### Phase 3: TypeScript

1. Von den Blättern her nach `.ts` umbenennen (`lib` → `crypto` → `domain` → `data` →
   `features` → `ui`), Umbenennen und Typisieren in getrennten Commits.
2. Strenge stufenweise: `noImplicitAny`, `strictNullChecks`, dann `strict`. Kein `any` ohne
   Begründung, kein `@ts-ignore`, höchstens `@ts-expect-error` mit Grund.
3. Gemeinsame Typen in `src/types/`; Datenbanktypen aus dem Schema erzeugen
   (`supabase gen types`), nicht abschreiben.
4. **Krypto**: Base64-String, `ArrayBuffer`, `Uint8Array` und Schlüssel als getrennte Typen
   (Brand-Typen), damit sie nicht vertauscht werden können.
5. **i18n**: `type StringKey = keyof typeof de`, `en` mit `satisfies Record<StringKey, string>`,
   dynamische Keys über Template-Literal-Typen. Die Reihenfolge-Regel bleibt ein Test.

### Phase 4: Supabase hinter einem Modul

Die Supabase-Aufrufe (rund 75) sind über viele Bereiche verteilt; das ist die eigentliche
Kopplung an den Anbieter.

- **Nur `src/data/supabaseClient.ts` importiert `@supabase/supabase-js`** (ESLint
  `no-restricted-imports`); Vorschau und Tests tauschen genau dieses Modul.
- Darum Funktionen nach Fachlichkeit (`fetchEntries()`, `saveDayRow(…)`), nicht nach der
  Supabase-API. Zuerst nur die Abfrage herausziehen und `{ data, error }` wie bisher
  zurückgeben; Entschlüsseln, `state` und Meldungen bleiben, wo sie sind.
- Neue Funktionen nutzen nur Postgres und Auth; kein Storage, kein Realtime, keine neue Edge
  Function ohne Absprache, keine Logik in SQL/RLS, die im Client oder einer Function geht.

### Phase 5: React (nur nach ausdrücklichem Okay)

Ein Neubau der Oberfläche, kein Verschieben: rund 90 `render…`-Funktionen, die ganze
Event-Delegation und viel von Hand gebaute Fokus-, Scroll- und History-Logik. Deshalb eine
Ansicht nach der anderen, jede für sich auslieferbar. Vor dem Start schriftlich festlegen:

- **Brücke**: React-Wurzel in einem eigenen Container, den `render()` nicht überschreibt.
- **Zustand**: ohne neue Abhängigkeit (`useSyncExternalStore` über `state`); eine Bibliothek
  nur auf Anweisung.
- **Reihenfolge** einfach → schwierig: Anmelden → Über Logbuch → Auswertung → Felder verwalten
  → Vorlagen → "Heute" zuletzt (Long-Press, Wischen, Ziehen).

Regeln: eine Komponente pro Datei; Logik als reine Funktionen getrennt (mit Tests), keine
Supabase- oder Krypto-Aufrufe in Komponenten; ein Hook pro Datei; kein
`dangerouslySetInnerHTML` (die Texte mit `<strong>` u. ä. über eine kleine Komponente, die nur
die vorkommenden Tags übersetzt); Gestaltung bleibt (Ledger-Optik, `rem`, kein Tailwind, kein
UI-Kit). Erhalten bleiben muss, was React nicht von selbst liefert (vor jeder Ansicht
docs/design-bedienung.md lesen): Fokus nach Aktionen, Scroll-Wiederherstellung,
Android-Zurück und `history.go()`-Falle, `<select>`-Fokus, iOS-Zoom, Button-Reihenfolge im DOM,
Eingaben über Neuzeichnen hinweg, stabile Knopftexte (die Rundgänge tippen auf Texte).
