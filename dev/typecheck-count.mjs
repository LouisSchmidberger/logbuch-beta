// Typprüfung in der CI (docs/umbau.md): die App hat noch Altlasten-Meldungen, deshalb scheitert
// der Schritt nicht an jeder Meldung, sondern erst, wenn es MEHR als bisher werden - neue
// Typfehler fallen so sofort auf. Beim Abbau (Phase 3) MAX auf die neue, kleinere Zahl senken.
import { spawnSync } from 'node:child_process';

const MAX = 257;
const r = spawnSync('npx tsc -p tsconfig.json', { encoding: 'utf8', shell: true });
const out = (r.stdout || '') + (r.stderr || '');
const count = (out.match(/error TS\d+/g) || []).length;
if (r.status !== 0 && count === 0) {
  console.error(out);
  console.error('Typprüfung lief nicht (kein "error TS" in der Ausgabe).');
  process.exit(1);
}
if (count > MAX) {
  console.error(out);
  console.error(`Typprüfung: ${count} Meldungen, erlaubt höchstens ${MAX}. Neue Meldungen beheben.`);
  process.exit(1);
}
console.log(`Typprüfung: ${count} Meldungen (Grenze ${MAX}).${count < MAX ? ' Weniger als die Grenze: MAX in dev/typecheck-count.mjs senken.' : ''}`);
