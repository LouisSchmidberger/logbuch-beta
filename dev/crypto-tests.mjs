// Prüft, dass der Krypto-Code die festen Testdaten in dev/fixtures/crypto.json weiter liest
// (erzeugt mit dem Code vom Tag vor-umbau). Schlägt er fehl, könnte die App echte, schon
// gespeicherte Einträge nicht mehr entschlüsseln - nie die Testdaten anpassen, sondern den Code.
//
//   node dev/crypto-tests.mjs        (ohne Vorschau-Server, Web Crypto von Node)
//
// Entpacken mit Passwort/Ersatzschlüssel bildet die Schritte aus keys.js nach
// (unwrapDekWithPassword, unwrapDekWithRecoveryKey); ändern die sich, hier nachziehen.
import { readFileSync } from 'node:fs';
import {
  ENCRYPT_PAD_BLOCK, base64ToBuf, bufToHex, decryptData, deriveKek, encryptData, hexToBuf,
  importRecoveryKeyAsCryptoKey, unwrapDek,
} from '../js/crypto.js';

const fx = JSON.parse(readFileSync(new URL('./fixtures/crypto.json', import.meta.url), 'utf8'));
let failed = 0;
async function check(name, fn) {
  try {
    const r = await fn();
    if (r === true) { console.log('ok  ', name); return; }
    failed++; console.log('FAIL', name, r);
  } catch (err) { failed++; console.log('FAIL', name, err.message); }
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b) || `erwartet ${JSON.stringify(b)}, war ${JSON.stringify(a)}`;
const rawHex = async (key) => bufToHex(await crypto.subtle.exportKey('raw', key));

const row = fx.encryptionRow;
await check('Schlüssel mit Passwort entpacken', async () => {
  const kek = await deriveKek(fx.password, base64ToBuf(row.salt), row.kdf_iterations);
  return same(await rawHex(await unwrapDek(row.wrapped_dek, row.wrap_iv, kek)), fx.dekHex);
});
await check('Schlüssel mit Ersatzschlüssel entpacken', async () => {
  const key = await importRecoveryKeyAsCryptoKey(hexToBuf(fx.recoveryKeyHex));
  return same(await rawHex(await unwrapDek(row.wrapped_dek_recovery, row.recovery_wrap_iv, key)), fx.dekHex);
});
await check('falsches Passwort scheitert', async () => {
  const kek = await deriveKek(fx.password + 'x', base64ToBuf(row.salt), row.kdf_iterations);
  try { await unwrapDek(row.wrapped_dek, row.wrap_iv, kek); return 'ließ sich entpacken'; } catch { return true; }
});

const dek = await crypto.subtle.importKey('raw', hexToBuf(fx.dekHex), { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
for (const [i, e] of fx.entries.entries()) {
  await check(`gespeicherter Eintrag ${i + 1} entschlüsseln`, async () => same(await decryptData(dek, e.enc), e.plain));
}
await check('altes Format ohne Auffüllen entschlüsseln', async () => same(await decryptData(dek, fx.legacyUnpadded.enc), fx.legacyUnpadded.plain));

for (const [i, e] of fx.entries.entries()) {
  await check(`neu verschlüsselt ${i + 1}: gleiche Form, aufgefüllt, lesbar`, async () => {
    const enc = await encryptData(dek, e.plain);
    if (JSON.stringify(Object.keys(enc)) !== JSON.stringify(Object.keys(e.enc))) return `Felder ${Object.keys(enc)}`;
    if (base64ToBuf(enc.iv).byteLength !== 12) return 'IV nicht 12 Byte';
    const len = base64ToBuf(enc.ciphertext).byteLength - 16; // 16 Byte GCM-Tag
    if (len % ENCRYPT_PAD_BLOCK !== 0) return `Länge ${len} kein Vielfaches von ${ENCRYPT_PAD_BLOCK}`;
    if (len !== base64ToBuf(e.enc.ciphertext).byteLength - 16) return 'andere Länge als der gespeicherte Eintrag';
    return same(await decryptData(dek, enc), e.plain);
  });
}

console.log(failed ? `\n${failed} fehlgeschlagen` : '\nalle ok');
process.exitCode = failed ? 1 : 0;
