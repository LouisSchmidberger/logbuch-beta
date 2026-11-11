// Die Tabellen werden in events.js zu einer zusammengeführt ({ ...a, ...b }): ein Name in zwei
// Tabellen überschriebe still den früheren. Hier fällt das auf.
import { expect, test } from 'vitest';
import { authActions } from './auth.js';
import { fieldsActions } from './fields.js';
import { menuActions } from './menu.js';
import { todayActions } from './today.js';
import { tutorialActions } from './tutorial.js';

test('Klick-Aktionen: jeder Name nur in einer Tabelle', () => {
  const seen = {};
  const dupes = [];
  for (const [table, actions] of Object.entries({ authActions, tutorialActions, menuActions, todayActions, fieldsActions })) {
    for (const name of Object.keys(actions)) {
      if (seen[name]) dupes.push(`${name} (${seen[name]}, ${table})`);
      seen[name] = table;
    }
  }
  expect(dupes).toEqual([]);
  expect(Object.keys(seen).length).toBeGreaterThan(150);
});
