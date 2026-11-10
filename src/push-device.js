// Lokale Namensliste für Erinnerungen (siehe sw.js): der Server schickt nur Feld- bzw.
// Gruppen-IDs, der Service Worker setzt daraus auf dem Gerät die Namen ein. Liegt nur auf diesem
// Gerät (wie der DEK-Cache), wird bei jeder Änderung der Felder oder der Sprache neu
// geschrieben (auch der Gruppen) und bei der Konto-Löschung entfernt.
import { supabase } from './config.js';
import { t } from './i18n.js';
import { state } from './state.js';
function openPushDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('logbuch-push', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('meta');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveFieldNamesForPush() {
  try {
    const names = Object.fromEntries(state.habits.filter((h) => h.kind !== 'computed').map((h) => [h.defId, h.name]));
    const sectionNames = Object.fromEntries(state.sections.map((sec) => [sec.id, sec.name]));
    const db = await openPushDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction('meta', 'readwrite');
      tx.objectStore('meta').put({
        names, template: t('push.customReminder'), counterTemplate: t('push.counterReminder'),
        sectionNames, sectionTemplate: t('push.sectionReminder'),
      }, 'fieldNames');
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch { /* IndexedDB nicht verfügbar - Erinnerungen bleiben dann beim allgemeinen Text */ }
}

export async function clearFieldNamesForPush() {
  try {
    const db = await openPushDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction('meta', 'readwrite');
      tx.objectStore('meta').delete('fieldNames');
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch { /* egal, nur lokaler Cache */ }
}

// Beendet die Erinnerungen dieses Geräts für das angemeldete Konto - beim Abmelden und
// beim Löschen des Kontos: Server-Zeile löschen (solange die Session noch gilt), das Abo
// im Browser kündigen und die lokale Namensliste leeren. Sonst kämen die Erinnerungen
// des alten Kontos samt Feldnamen weiter auf das Gerät, auch wenn sich danach jemand
// anders anmeldet. getRegistration statt serviceWorker.ready: ready wartet ohne
// registrierten Service Worker für immer. Best effort, darf das Abmelden nie blockieren.
export async function endPushForThisDevice({ deleteServerRow = true } = {}) {
  try {
    const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : null;
    const sub = reg?.pushManager ? await reg.pushManager.getSubscription() : null;
    if (sub) {
      if (deleteServerRow) await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
      await sub.unsubscribe();
    }
  } catch { /* best effort */ }
  await clearFieldNamesForPush();
  if (state.pushStatus !== 'unsupported') state.pushStatus = 'off';
}

// Ohne Abo: 'blocked', wenn Mitteilungen für Logbuch verboten sind (einmal "Blockieren"
// gedrückt - der Browser fragt dann nie wieder, nur eine Anleitung hilft weiter), sonst 'off'.
export function pushOffStatus() {
  return typeof Notification !== 'undefined' && Notification.permission === 'denied' ? 'blocked' : 'off';
}
