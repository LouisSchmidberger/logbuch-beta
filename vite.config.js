// Build (npm run build -> dist/): bündelt src/ zu Dateien mit Hash im Namen (Cache-Busting),
// kopiert public/ unverändert dazu. Einstieg bleibt logbuch.html (Manifest, Service Worker,
// Push-Links und installierte Apps zeigen darauf). base './': derselbe Build läuft unter
// /logbuch/ und /logbuch-beta/.
//
// Modus "preview" (nur dev/server.mjs, nie veröffentlicht): Supabase durch das Nachbau-Modul
// dev/mock-supabase.js ersetzt, und an src/main.js hängt der Vorschau-Haken (dev/preview-hook.js),
// der alle Exporte der Module an die Tests durchreicht. Ausgabe nach dev/.preview/.
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const root = fileURLToPath(new URL('.', import.meta.url));
const BROWSERS = ['es2020', 'chrome87', 'edge88', 'firefox78', 'safari14'];

function previewHook() {
  const mods = readdirSync(`${root}src`).filter((f) => f.endsWith('.js') && f !== 'main.js').sort();
  const code = `
${mods.map((f, i) => `import * as __m${i} from './${f}';`).join('\n')}
import { install as __install } from '../dev/preview-hook.js';
const __mods = [${mods.map((_, i) => '__m' + i).join(', ')}];
const __get = (n) => { for (const m of __mods) if (n in m) return m[n]; return undefined; };
__install({
  state: __get('state'), render: __get('render'), saveDayNow: __get('saveDayNow'), encryptData: __get('encryptData'),
  DEF_PLAINTEXT_CLEARED: __get('DEF_PLAINTEXT_CLEARED'), supabase: __get('supabase'), dek: () => __get('currentDek'),
  internals: new Proxy({}, { get: (_, n) => __get(n) }), // für dev/tests.mjs und dev/sync-tests.mjs
});
`;
  return {
    name: 'logbuch-preview-hook',
    transform(src, id) {
      if (id.replace(/\\/g, '/').endsWith('/src/main.js')) return { code: src + code, map: null };
    },
  };
}

export default defineConfig(({ mode }) => {
  const preview = mode === 'preview';
  return {
    base: './',
    publicDir: 'public',
    resolve: preview ? { alias: { '@supabase/supabase-js': `${root}dev/mock-supabase.js` } } : {},
    plugins: preview ? [previewHook()] : [],
    build: {
      outDir: preview ? 'dev/.preview' : 'dist',
      emptyOutDir: true,
      rolldownOptions: { input: 'logbuch.html' },
      // Ältere Browser-Ziele als Vites Standard (Safari 16.4): vor dem Build lief der Code
      // unverändert, auch auf älteren iPhones; so bleiben z.B. -webkit-appearance-Regeln erhalten.
      target: BROWSERS,
      cssTarget: BROWSERS,
      // Vorschau unverkleinert: Fehlermeldungen in den Tests zeigen lesbare Namen.
      minify: !preview,
    },
  };
});
