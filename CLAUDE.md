# Logbuch – Projektkontext

Habit-Tracker mit frei anlegbaren Feldern (Skala, Zahl, Text, berechnete Werte), standalone
(unabhängig von Claude.ai). Mehrere Nutzer, jeder verwaltet seine eigenen Felder;
Registrierung offen (kein Invite-System). Zero-Access-Verschlüsselung: der Betreiber kann
weder Werte noch Feldnamen lesen.

**Kern** (Nutzer, 2026-10-30): Logbuch trägt viele Dinge des Alltags zusammen – Befinden und
Einflüsse nebeneinander –, damit Zusammenhänge sichtbar und verständlich werden; der Nutzen
entsteht aus genug Daten, nicht aus einem einzeln protokollierten Symptom. Viele Felder sind
gewollt (Eintragen bleibt schnell: der Nutzer braucht für viele Felder unter einer Minute).
Anlegen, Vorlagen und Auswertung richten sich danach.

**Zielbild**: langfristig breite Öffentlichkeit + eingeschränkt kommerzielle Nutzung.
Rechtlicher/geschäftlicher Rahmen (Impressum, Datenschutzerklärung, AGB, Gewerbe) klärt der
Nutzer außerhalb dieses Repos – hier nur die technischen Vorbereitungen (Sicherheit/
Datenschutz zuerst). Bis die Rechtstexte stehen, nur informelles Testen mit bekannten
Personen.

## Pflichtlektüre vor Änderungen

Bevor du an einem dieser Bereiche etwas änderst, lies die zugehörige Datei:

| Bereich | Datei |
|---|---|
| Tabellen, Spalten, RLS, Speichern eines Tages, Notiz-Format, Wiederholung | [docs/datenmodell.md](docs/datenmodell.md) |
| Feldtypen, Skalen/Farben/Scores, berechnete Felder, Gruppen, Feld-Formular, Auswertung | [docs/felder.md](docs/felder.md) |
| Alles mit DEK/Passwort/Ersatzschlüssel, Entsperren, Login/Logout-Ablauf | [docs/verschluesselung.md](docs/verschluesselung.md) |
| Push, `send-notifications`, `get_due_notifications`, Erinnerungszeiten, Deep-Links, Zeitzone | [docs/erinnerungen.md](docs/erinnerungen.md) |
| UI, Navigation, Menü/Einstellungen, "Heute", Notizen, Meldungen, Fokus, Theme, Textgröße (enthält Fallen: iOS-Zoom, `history.go()`, `<select>`-Fokus, Schraffur) | [docs/design-bedienung.md](docs/design-bedienung.md) |
| Startseite, Installation, Registrieren, Tutorial, Ersatzschlüssel-Seite, Erklär-Karten | [docs/onboarding.md](docs/onboarding.md) |
| Texte/`STRINGS`/`t()`, Sprache, Datumsformate | [docs/i18n.md](docs/i18n.md) |
| Konto löschen, Export, Feedback, Auth/Passwort, E-Mail-Versand, Secrets, Kennzahlen (`ops-stats`) | [docs/datenschutz-sicherheit.md](docs/datenschutz-sicherheit.md) |
| Aufbau des Codes in Module, `runtime`, `init…()`, neue Module/Imports | [docs/module.md](docs/module.md) |
| Umbau (Vite, TypeScript, Schichten, Supabase-Kapselung, React), Branch-Regeln dafür | [docs/umbau.md](docs/umbau.md) |
| Lokale Vorschau, Screenshots, automatische Tests, CI, `dev/` (nachgebautes Supabase) | [dev/README.md](dev/README.md) |
| Neue Funktion freigeben, Schalter (`featureOn`), Tester, Premium | [docs/freigabe.md](docs/freigabe.md) |

## Stack und Hosting

- **Frontend**: `logbuch.html` (Einstieg), ES-Module unter `src/<schicht>/` (`main.js` startet, sonst eins
  je Bereich, docs/module.md), `src/logbuch.css`, Vanilla JS, kein Framework. **Build mit Vite**
  (`npm run build` → `dist/`, Hash im Dateinamen statt Cache-Busting von Hand); `public/` geht
  unverändert mit (`sw.js`, Manifest, Icons, Schriften). Umbau-Plan (TypeScript usw.):
  docs/umbau.md. Keine Inline-Skripte, damit die Content-Security-Policy (`<meta>` in
  `logbuch.html`) sie komplett verbieten kann (`script-src 'self'`): eingeschleuster Code liefe nicht, und `connect-src` lässt
  Daten nur zum eigenen Supabase-Projekt. **Neue externe Quellen müssen in die CSP.**
- **Keine Drittanbieter zur Laufzeit**: `supabase-js` kommt in exakt festgelegter Version aus
  npm (`package-lock.json`) ins eigene Bündel (nicht vom CDN – wer das CDN kontrolliert,
  könnte Passwort und Schlüssel mitlesen); Lizenzen in `public/LICENSES-supabase-js.txt`. Die
  Schriften (Fraunces, IBM Plex Sans, SIL OFL) liegen unter `public/fonts/` (nicht Google
  Fonts – übermittelte bei jedem Öffnen die IP an Google).
- **Service Worker** `public/sw.js`: nur Web-Push-Empfang/-Klick, kein Offline-Caching.
- **Backend**: Supabase (Projekt-Ref `qdadoqcnqmrauhshvcts`, Region Europe) – Postgres,
  Auth (E-Mail/Passwort), Edge Functions `send-notifications`, `delete-account`,
  `submit-feedback`, `ops-stats` (Kennzahlen für den Hub); pg_cron für Erinnerungen und Aufräum-Jobs. Resend als SMTP und für
  Feedback-Mails.
- **Hosting**: GitHub Pages, statisch. Veröffentlicht wird nur `dist/`, und nur von der CI
  (`.github/workflows/deploy.yml`): live erst, wenn alle Prüfungen grün sind, die Beta schon nach
  den schnellen (docs/freigabe.md).

## Konventionen

- Rendering per Template-Strings + Event-Delegation auf `#app` (`data-action`; Klick-Aktionen als
  Tabelle je Bereich in `src/ui/actions/`), kein
  virtuelles DOM (bewusst einfach). `render()` ersetzt das ganze `#app` und stellt den Fokus
  wieder her – **neue klickbare Elemente brauchen stabile, eindeutige `data-*`-Merkmale bzw.
  eine id**.
- Begriffe: "Gruppe" in der App = `section` im Code/in der DB; Feldtyp "Berechnet" =
  `kind='computed'`; "Ersatzschlüssel" = `recoveryKey`.
- `state.entries` enthält immer entschlüsselte Objekte. Zum Speichern `state.entries`
  ändern und dann nur `saveDay(dateKey)` aufrufen. `currentDek` nur über
  `setCurrentDek`/`clearCurrentDek` setzen/leeren, nie in `state`.
- Schlüssel in einem Tages-Eintrag, die mit `_` beginnen, sind nie Feldwerte (`_notes`,
  `_prev` = Sicherung von "Stufen ändern"/"Typ ändern").
- Alle UI-Texte über `STRINGS`/`t()`; Meldungen sind reiner Text (mit Parametern
  `tPlain()`); Fehler immer über `errorNotice(key, rawMessage)`, nie roher Fehler im Satz.
- CSS-Größen immer in `rem`, nie in px (Textgröße-Einstellung skaliert über `<html>`).
- Gerätespezifische Einstellungen (Theme, Textgröße, Streifenmuster, Stand des Tages, Vibration,
  Onboarding-Zustand) in `localStorage`, kontoweite (Sprache, Erinnerungszeiten) in
  `user_settings`.
- Button-Paare: **Abbrechen links, Aktion rechts**, auch in der Code-Reihenfolge
  (Screenreader lesen in DOM-Reihenfolge; Anfangsfokus in Dialogen landet so auf
  "Abbrechen"). Untereinander gestapelte Buttons (Tutorial, Anmelden): Hauptaktion oben.
- Optik: Ledger-Ästhetik beibehalten (siehe docs/design-bedienung.md), keine generische
  Tailwind-/Card-Optik.

## Bekannte Fallstricke

- **Pfade in `logbuch.html`/CSS auf `public/` mit `/` beginnen** (`/icon-192.png`,
  `url(/fonts/…)`): Vite macht daraus relative Pfade (`base: './'`, läuft unter `/logbuch/`
  und `/logbuch-beta/`). Linter vor jedem Commit über `.githooks/pre-commit`, pro Klon einmal
  `git config core.hooksPath .githooks`.
- **"JWT issued at future" (PGRST303)** fängt `fetchWithJwtFutureRetry` ab – nicht entfernen
  (Hintergrund: docs/datenschutz-sicherheit.md, Anmeldung).
- **Zeitplan-Regeln doppelt**: `isScheduledOn`/`isPlannedOn` (JS) und
  `public.habit_scheduled_on` (SQL) müssen synchron bleiben.
- **`get_due_notifications` läuft über alle Nutzer in einem Rutsch**: neue vom Nutzer
  schreibbare Spalten, die sie liest, brauchen eine DB-Prüfung (CHECK/Trigger), sonst kann
  ein einzelner Wert den ganzen Lauf abbrechen.
- **Neue Tabellen** brauchen explizite GRANTs in ihrer Migration (`authenticated` +
  `service_role`, kein `anon`).
- **PostgREST kappt bei 1000 Zeilen** – Listen seitenweise laden (`fetchAllRows`, Keyset).
- **`authFlowInFlight`** muss VOR dem Supabase-Auth-Aufruf gesetzt werden (Race mit
  `onAuthStateChange`).

## Pflichten bei Änderungen

- **Sichtbare Änderungen vorher ansehen**: mit der lokalen Vorschau (`dev/`, siehe
  dev/README.md) Screenshots machen, bevor live geht. Neue Tabelle/Spalte/Supabase-Aufruf →
  `dev/mock-supabase.js` nachziehen.
- **Rechenlogik geändert** → `npm test` vor dem Commit, neue Logik bekommt einen Fall in
  `src/logic.test.js`. Regel, die es in JS und SQL gibt → Fälle in `dev/sync-tests.mjs`. Verschlüsselung
  angefasst → `node dev/crypto-tests.mjs` (Testdaten nie anpassen). Nach jedem Push die CI
  ansehen (`gh run list`); rot = vor allem anderen beheben. **Neue Funktion für Nutzer** → ob sie einen Schalter
  bekommt und auf welcher Stufe sie startet, entscheidet der Nutzer pro Funktion – beim Klären
  der Aufgabe fragen (Nutzer-Entscheidung 2026-11-10; docs/freigabe.md).
- **Mobil zuerst**: die Nutzer sind mit großem Abstand auf Handy und Tablet (Android/iOS).
  Jede Gestaltungs-/Bedienentscheidung geht von Mobilgeräten und deren Konventionen aus; der
  PC muss funktionieren, gibt aber nicht die Richtung vor.
- **Texte in beiden Sprachen**: neue Strings immer über `STRINGS`/`t()` in `de` UND `en`,
  in identischer Key-Reihenfolge.
- **`CHANGELOG`** in `src/data/changelog.js` ("Was ist neu"): ein Eintrag pro Live-Gang für
  Neues, das Nutzer kennen sollten. Vor dem Schreiben docs/freigabe.md "Was ist neu" lesen
  (zwei Stufen, Wortwahl, was nicht hineingehört).
- **Datenschutz-Text in "Über Logbuch"** (`renderPrivacySection`, `about.privacy.*`) sagt
  konkret, was der Betreiber sehen kann und was nicht. Jede Änderung, die daran etwas
  verschiebt (neue unverschlüsselte Spalte, zusätzliches Log, serverseitige Auswertung,
  neuer Drittanbieter o.ä.), passt ihn im selben Zug an; bei Reviews gegen den Stand prüfen.
  Nicht hinein: Selbstverständlichkeiten (dass der Betreiber Feedback lesen kann) und
  Details ohne Aussagekraft (ob/seit wann ein Feld archiviert ist).
- **Tipps in "Über Logbuch"** mit Ortsangabe bekommen einen Link dorthin (`renderTip`).

## Deployment

**Erst Beta, dann live** (Nutzer-Entscheidungen 2026-10-11/-14): `git push beta main` → CI
veröffentlicht nach den schnellen Prüfungen die Beta (Rest danach rot = sofort beheben), die der Nutzer täglich mit echtem Konto nutzt. Live (`git push
origin main`) nur gesammelt am Sitzungsende, auf sein Okay, mit einem `CHANGELOG`-Eintrag.
**Datenbank und Edge Functions teilen beide**: Migrationen/Deploys wirken sofort live, also so
bauen, dass die alte Live-Version weiterläuft. Schritte und Schalter: **docs/freigabe.md**.

## Hub

Hub-Projekt: habit (Projektdatei hub/projekt-habit-tracker.md, Handoff hub/handoff/habit-tracker.md)
