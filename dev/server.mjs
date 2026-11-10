// Lokaler Vorschau-Server (siehe dev/README.md): baut die App mit Vite im Modus "preview"
// (vite.config.js) nach dev/.preview/ und liefert sie aus - also derselbe gebündelte Code wie
// live, nur mit nachgebautem Supabase (dev/mock-supabase.js) und angehängtem Vorschau-Haken
// (dev/preview-hook.js), unverkleinert. Änderungen unter src/ und an den Vorschau-Dateien baut
// er im Hintergrund neu (Seite neu laden).
// Pfade unter /dev/ (Postfach) kommen direkt aus dem Repo. Auf GitHub Pages gibt es diesen
// Server nicht, dort lässt sich die Vorschau also auch nicht einschalten.
//
// Start: node dev/server.mjs [port]   (Standard 5180, nur auf 127.0.0.1 erreichbar)

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const OUT = join(ROOT, 'dev', '.preview');
const PORT = Number(process.argv[2]) || 5180;

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

// Erster Bau abwarten, danach weiter beobachten.
const watcher = await build({ root: ROOT, mode: 'preview', logLevel: 'warn', build: { watch: {} } });
await new Promise((ok, fail) => {
  watcher.on('event', (e) => {
    if (e.code === 'BUNDLE_END') { e.result?.close?.(); ok(); }
    if (e.code === 'ERROR') { console.error('Vorschau-Build fehlgeschlagen:', e.error?.message); fail(e.error); }
  });
});

createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (path === '/') path = '/logbuch.html';
    const base = path.startsWith('/dev/') ? ROOT : OUT;
    const file = normalize(join(base, path));
    if (file !== base && !file.startsWith(base + sep)) { res.writeHead(403).end(); return; }
    const body = await readFile(file);
    res.writeHead(200, {
      'Content-Type': TYPES[extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store', // jede Änderung sofort sichtbar
    });
    res.end(body);
  } catch (err) {
    res.writeHead(err.code === 'ENOENT' ? 404 : 500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(err.code === 'ENOENT' ? 'Nicht gefunden' : String(err));
  }
}).listen(PORT, '127.0.0.1', () => {
  console.log(`Logbuch-Vorschau: http://localhost:${PORT}/  (nachgebautes Supabase, Daten nur in diesem Browser)`);
  console.log(`Postfach (Bestätigungs-/Reset-Links): http://localhost:${PORT}/dev/postfach.html`);
});
