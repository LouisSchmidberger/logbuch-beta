// Rauchtest des echten Produktions-Builds (dist/, verkleinert, echtes supabase-js): liefert ihn
// unter einem Unterpfad aus wie GitHub Pages (/logbuch-beta/) und öffnet die Startseite.
// Scheitert bei einem Fehler in der Seite, einer fehlgeschlagenen Anfrage an eigene Dateien oder
// wenn die Startseite nicht erscheint. Ergänzt die Rundgänge, die auf der unverkleinerten
// Vorschau laufen (gleicher Quellcode, gleiche Bündelung, aber ohne Verkleinerung).
//
//   npm run build && node dev/dist-check.mjs
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch } from './lib.mjs';

const DIST = fileURLToPath(new URL('../dist/', import.meta.url));
const PREFIX = '/logbuch-beta/';
const PORT = 5191;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.txt': 'text/plain' };

const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = normalize(join(DIST, path.startsWith(PREFIX) ? path.slice(PREFIX.length) : '\0'));
  try {
    if (!file.startsWith(DIST.replace(/[\\/]$/, '') + sep)) throw new Error();
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' }).end(body);
  } catch { res.writeHead(404).end(); }
}).listen(PORT, '127.0.0.1');

const { browser, page, problems } = await launch({ device: 'handy' });
const own = `http://localhost:${PORT}/`;
page.on('requestfailed', (r) => { if (r.url().startsWith(own)) problems.push('Anfrage fehlgeschlagen: ' + r.url()); });
page.on('response', (r) => { if (r.url().startsWith(own) && r.status() >= 400) problems.push(`${r.status()}: ${r.url()}`); });
let ok = false;
try {
  await page.goto(`${own}${PREFIX.slice(1)}logbuch.html`, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => document.body.innerText.includes('Ich bin neu hier'), { timeout: 15000 });
  const fonts = await page.evaluate(async () => { await document.fonts.ready; return [...document.fonts].filter((f) => f.status === 'loaded').length; });
  if (!fonts) problems.push('keine Schrift geladen');
  ok = !problems.length;
} catch (err) {
  problems.push(err.message);
} finally {
  await browser.close();
  server.close();
}
console.log(ok ? '✓ Produktions-Build startet unter ' + PREFIX : '✗ Produktions-Build:\n' + problems.join('\n'));
process.exitCode = ok ? 0 : 1;
