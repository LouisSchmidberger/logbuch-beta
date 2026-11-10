// Linter (npm run lint): findet Fehler, die beim Lesen untergehen - nicht definierte Namen
// (Tippfehler, nach dem Verschieben in ein anderes Modul nicht importiert), unbenutzte
// Variablen, versehentliche Zuweisungen. Formatierung prüft er bewusst nicht.
import js from '@eslint/js';
import globals from 'globals';
import importPlugin from 'eslint-plugin-import';

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
    rules: { 'import/no-cycle': 'error' },
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
