// --- Schalter pro Funktion (feature_flags/user_access, siehe docs/freigabe.md) ---
// Eine neue Funktion geht mit dem normalen Live-Gang raus, sichtbar ist sie erst ab ihrer
// Stufe. Schalter sperren nur den Einstieg (z.B. eine Feld-Art im Formular), nie
// vorhandene Daten: wer ein Feld schon hat, sieht es weiter, auch wenn die Stufe sinkt.
// Unbekannte Schalter und ein Ladefehler gelten als aus.
import { supabase } from './config.js';
let featureStages = {}; // key -> 'off' | 'owner' | 'testers' | 'all'

export let accessGroup = null; // 'owner' | 'tester' | null (eigene Zeile in user_access)

export function featureVisible(stage, group) {
  return stage === 'all' || (stage === 'testers' && (group === 'tester' || group === 'owner')) || (stage === 'owner' && group === 'owner');
}

// Gerade ohne Aufrufer (keine Funktion hinter einem Schalter), bleibt als Schnittstelle für neue
// Schalter (docs/freigabe.md).
// eslint-disable-next-line no-unused-vars
function featureOn(key) { return featureVisible(featureStages[key], accessGroup); }

export async function loadFeatureAccess() {
  const [flags, access] = await Promise.all([
    supabase.from('feature_flags').select('key, stage'),
    supabase.from('user_access').select('access_group').maybeSingle(),
  ]);
  if (flags.error || access.error) console.error('[Logbuch] Schalter nicht geladen', flags.error || access.error);
  featureStages = Object.fromEntries((flags.data || []).map((f) => [f.key, f.stage]));
  accessGroup = access.data?.access_group ?? null;
}

export function clearFeatureAccess() { featureStages = {}; accessGroup = null; }
