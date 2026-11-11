// Linter (npm run lint): findet Fehler, die beim Lesen untergehen - nicht definierte Namen
// (Tippfehler, nach dem Verschieben in ein anderes Modul nicht importiert), unbenutzte
// Variablen, versehentliche Zuweisungen. Formatierung prüft er bewusst nicht.
import js from '@eslint/js';
import globals from 'globals';
import importPlugin from 'eslint-plugin-import';

// Je Schicht ein Verbot: aus allen höheren Ordnern (und dem Einstieg main.js) nichts importieren.
const layerZones = (layers) => layers.slice(0, -1).map((layer, i) => ({
  target: `./src/${layer}`,
  from: [...layers.slice(i + 1).map((l) => `./src/${l}`), './src/main.js'],
  message: `Schicht "${layer}" importiert nicht von oben (docs/module.md, nach oben über render-request.js).`,
}));

export default [
  { ignores: ['node_modules/**', 'supabase/**', 'dist/**', 'dev/.preview/**', 'dev/screenshots/**'] },
  js.configs.recommended,
  {
    // App im Browser (ES-Module). Keine Kreis-Imports (docs/module.md): sie machen die
    // Lade-Reihenfolge zufällig ("Cannot access … before initialization") und verwischen die
    // Schichten; nach oben geht es über render-request.js.
    files: ['src/**/*.js'],
    plugins: { import: importPlugin },
    languageOptions: { ecmaVersion: 2024, sourceType: 'module', globals: { ...globals.browser } },
    rules: {
      'import/no-cycle': 'error',
      'import/no-unresolved': 'error',
      // Schichten (docs/module.md): ein Ordner importiert nie aus einem höheren.
      'import/no-restricted-paths': ['error', { zones: layerZones(['lib', 'state', 'domain', 'data', 'features', 'ui']) }],
    },
  },
  {
    // Lange Dateien als Hinweis (docs/umbau.md): ab 500 Zeilen Code aufteilen erwägen. Texte und
    // "Was ist neu" sind reine Daten und zählen nicht.
    files: ['src/**/*.js'],
    ignores: ['src/lib/strings-*.js', 'src/data/changelog.js', 'src/**/*.test.js'],
    rules: { 'max-lines': ['warn', { max: 500, skipBlankLines: true, skipComments: true }] },
  },
  {
    files: ['public/sw.js'],
    languageOptions: { sourceType: 'script', globals: { ...globals.serviceworker } },
  },
  {
    // Vorschau/Tests: Node-Skripte, die teils Code im Browser ausführen (page.evaluate)
    files: ['dev/**/*.{js,mjs}', '*.js'],
    languageOptions: { ecmaVersion: 2024, sourceType: 'module', globals: { ...globals.node, ...globals.browser } },
  },
  {
    rules: {
      'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none', ignoreRestSiblings: true }],
    },
  },
];
