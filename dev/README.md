# Lokale Vorschau

Logbuch lokal ansehen und per Skript fotografieren, ohne Konto, ohne Netz und ohne live zu
gehen: auch eingeloggte Seiten und das Onboarding. Das echte Gerät bleibt die letzte Instanz.

## Wie es funktioniert

`server.mjs` baut die App mit Vite im Modus "preview" (`vite.config.js`) nach `dev/.preview/`
und liefert diesen Stand aus: derselbe Quellcode in derselben Bündelung wie live, nur
unverkleinert und mit zwei Unterschieden, die es nur in diesem Build gibt (Änderungen unter `src/`
und an den Vorschau-Dateien baut er im Hintergrund neu, dann Seite neu laden):

- `@supabase/supabase-js` → `mock-supabase.js`: nachgebautes Supabase (Anmeldung,
  Tabellen mit Standardwerten/Schlüsseln/"nur eigene Zeilen", die zwei Edge Functions),
  gespeichert in localStorage von `localhost`. Mails landen im Vorschau-Postfach
  (`/dev/postfach.html`).
- An `src/main.js` hängen ein paar Zeilen, die alle Module unter `src/` laden und ihre
  Exporte an `preview-hook.js` reichen (`window.__logbuchPreview`). Darüber legen die Beispieldaten
  denselben Weg zurück wie echte Eingaben, mit gleicher Verschlüsselung und gleichem Format.

Den verkleinerten Produktions-Build (`dist/`, echtes supabase-js) prüft `node dev/dist-check.mjs`
nach `npm run build` einmal im Browser unter `/logbuch-beta/` (auch in der CI).

Diese Trennung ist eine bewusste Entscheidung: Testcode gehört nicht in die Live-App. Der
veröffentlichte Build enthält nichts davon (die CI prüft, dass `__logbuchPreview` in `dist/`
nicht vorkommt), und `dev/` wird nicht veröffentlicht. Ein Vorschau-Schalter in der App selbst
wurde verworfen, weil damit Testcode in der Live-App läge.

**Wenn die App eine neue Tabelle, Spalte mit Standardwert, einen neuen Abfrage-Baustein
oder einen neuen Auth-Aufruf bekommt:** in `mock-supabase.js` nachziehen. Sonst weicht die
Vorschau still ab oder bricht mit "nicht nachgebaut" ab.

## Benutzen

Einmalig im Projektstamm: `npm install` (Entwicklungswerkzeuge aus `package.json`: ESLint,
`puppeteer-core` - nutzt das installierte Edge/Chrome; die App selbst braucht nichts davon).

```
node dev/server.mjs                 # Vorschau auf http://localhost:5180/ (läuft weiter)
node dev/rundgang.mjs onboarding    # bzw. onboarding-kurz, app, alle
node dev/rundgang.mjs app --device=schmal --theme=dark --size=xlarge
```

Die Bilder landen in `dev/screenshots/<rundgang>-<gerät>[-dark][-<größe>]/` (nicht im Git);
jeder Lauf leert seinen Ordner vorher.

**Aufräumen:** Vergleichsbilder für eine Gestaltungsfrage kommen nach
`dev/screenshots/vergleich/` und werden am Ende der Sitzung gelöscht (nicht schon nach der
Entscheidung - man will oft nochmal zurückschauen; die Entscheidung steht in docs/). Ebenso die
losen Einzelbilder, die `shoot.mjs` direkt in `dev/screenshots/` ablegt (sie häufen sich sonst an,
anders als die Rundgang-Ordner). Mit `--keep` angelegte Browser-Profile (`dev/.profile-*`)
nach dem Test löschen. Alles unter `dev/screenshots/` lässt sich jederzeit neu erzeugen.
Geräte: `handy` (390 px), `schmal` (360 px), `opera` (wie `handy`, als Opera), `iphone`, `pc`. Größen wie die Einstellung
Textgröße: `small`, `large`, `xlarge`.

Eigene Abläufe ohne neues Skript: `node dev/shoot.mjs <Schritte>`, zum Beispiel
`seeded "tap:Menü" "tap:Einstellungen" shot:einstellungen` (alle Schritte im Dateikopf).
`buttons` listet, was gerade antippbar ist.

**Automatische Tests** der Rechenlogik (Tage seit, Dauer, Zeitpläne, Schalter …):
`node dev/tests.mjs` bei laufendem Server, Ausgabe je Fall `ok`/`FEHLER`, Exit-Code 1 bei
Fehlern. Sie laufen im echten App-Code: `internals` im Vorschau-Haken (`dev/server.mjs`)
liefert jeden Export der Module unter `src/` - eine neue getestete Funktion muss in ihrem Modul
exportiert sein.

**Verschlüsselung** (`node dev/crypto-tests.mjs`, ohne Server): entschlüsselt die festen
Testdaten in `dev/fixtures/crypto.json` (Schlüssel mit Passwort und Ersatzschlüssel entpacken,
gespeicherte Einträge, altes Format ohne Auffüllen) und prüft, dass neu Verschlüsseltes dieselbe
Form hat. Die Testdaten nie neu erzeugen oder anpassen: sie stehen für schon gespeicherte echte
Einträge. Schlägt der Test fehl, ist der Code falsch.

**Abgleich JS <-> SQL** (`node dev/sync-tests.mjs`): rechnet Regeln, die es in der App und in
der Datenbank gibt (Zeitplan, Zeitraum-Start), für Hunderte Fälle auf beiden Seiten und meldet
jeden Unterschied. Braucht den Vorschau-Server und eine lokale Datenbank aus allen Migrationen
(`npx supabase db start`, braucht Docker Desktop). Neue doppelte Regel -> dort Fälle ergänzen.

**CI** (`.github/workflows/ci.yml`): bei jedem Push auf GitHub laufen Linter, Krypto-Test,
Build mit Rauchtest im Browser, Typprüfung (vorerst nur als Hinweis), Tests, Rundgänge, eine Wegwerf-Datenbank aus allen
Migrationen, der Abgleich und die Typprüfung der Edge Functions; nur wenn alles grün ist,
veröffentlicht der Job `deploy` (docs/freigabe.md). Ergebnis im Reiter "Actions" des Repos;
ein Fehler kommt zusätzlich per Mail. Lokal: `npm run lint` (auch im pre-commit-Hook),
`npm run build`, `npm run typecheck`.

Von Hand im Browser: Server starten, `http://localhost:5180/` öffnen. In der Konsole
`await __logbuchPreview.resetAll()` (alles frisch) oder nach dem Anmelden
`await __logbuchPreview.seedDemo()` (Beispieldaten), danach neu laden.
Langsames Netz nachstellen: `localStorage.setItem('logbuchPreviewDelayMs', '2000')`
(Verzögerung pro Supabase-Aufruf, Standard 30 ms).

## Grenzen

Push, echter Mailversand und die Serverlogik der Erinnerungen fehlen. Die Installation als App
lässt sich headless nicht auslösen, deshalb gehen die Rundgänge über "Ich bleib erst mal im
Browser". Die Rundgänge tippen über sichtbare Knopftexte. Ändert sich ein Text, bricht der
Rundgang mit einer Liste dessen ab, was sichtbar war, und legt ein `FEHLER`-Bild ab.
