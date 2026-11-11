// Von Hand hochgezählt bei größeren Änderungen - ein Datum genügt hier als Rückverfolgbarkeit
// (keine echte Versionsnummer nötig, solange es keine Release-Branches gibt).
// "Was ist neu" (Nutzer-Entscheidung 2026-10-11): neueste zuerst, Kennung = Datum des
// Live-Gangs (zweiter am selben Tag: "2026-10-11b" - sonst gälte er als schon gesehen). Nur,
// was Nutzer weiterbringt (neue Möglichkeiten), keine Interna; de + en, kurz, ohne
// Fachbegriffe. **Ein schon live gegangener Eintrag wird nie mehr erweitert** (wer ihn
// geschlossen hat, sähe die Ergänzung nie) - stattdessen ein neuer; wer mehrere verpasst hat,
// sieht alle gestapelt (das Fenster scrollt). Siehe CLAUDE.md. Nach einem Update zeigt die App die noch nicht gesehenen Einträge einmal als
// Fenster (renderWhatsNew), gesehen gilt pro Konto (user_settings.last_seen_changelog);
// "Über Logbuch" zeigt alle.
// Zwei Stufen (Nutzer-Entscheidung 2026-10-29): short = eine Zeile pro Neuerung fürs Fenster,
// verständlich auch ohne die App gut zu kennen; de/en = ausführlicher für "Über Logbuch".
// Ältere Einträge ohne short zeigen im Fenster die ausführliche Fassung.
import { supabase } from '../lib/config.js';
import { state } from '../state/state.js';
export const CHANGELOG = [
  {
    id: '2026-11-10',
    short: {
      de: [
        'Neu unter „Neues Feld“: das Startpaket, viele bewährte Felder auf einmal, die du an- und abwählst.',
        'Ziele können jetzt ein Bereich sein (z. B. 7 bis 9 Stunden Schlaf) oder für die ganze Woche gelten (z. B. 150 Minuten Bewegung).',
        'In den Einstellungen legst du fest, an welchem Tag deine Woche beginnt.',
      ],
      en: [
        'New under “New field”: the starter set, many proven fields at once that you tick on and off.',
        'Goals can now be a range (e.g. 7 to 9 hours of sleep) or apply to the whole week (e.g. 150 minutes of exercise).',
        'In Settings you choose which day your week starts on.',
      ],
    },
    de: [
      'Wenn du ein neues Feld anlegst, findest du bei den Vorlagen jetzt das Startpaket: viele bewährte Felder auf einmal, z. B. zu Schlaf, Stimmung und Einflüssen wie Sport oder Wasser, die du an- und abwählst. Hast du noch keine Felder, findest du es direkt in „Heute“.',
      'Ziele für Zahlen, Zähler und berechnete Felder können jetzt ein Bereich sein, z. B. 7 bis 9 Stunden Schlaf: Darin ist der Tag grün, je weiter darunter oder darüber, desto röter. Oder ein Ziel gilt für die ganze Woche, z. B. mindestens 150 Minuten Bewegung: In „Heute“ siehst du, wie weit du in dieser Woche bist, bewertet wird eine Woche erst, wenn sie vorbei ist.',
      'In den Einstellungen legst du fest, ob deine Woche am Montag, Sonntag oder Samstag beginnt. Das gilt für die Wochenansicht, den Monatskalender, Felder „einmal pro Woche“ und die Wochenübersicht. Was du schon in Wochen-Felder eingetragen hast, zieht mit um.',
    ],
    en: [
      'When you create a new field, you’ll now find the starter set among the templates: many proven fields at once, e.g. on sleep, mood and influences like exercise or water, that you tick on and off. If you have no fields yet, you’ll find it right in “Today”.',
      'Goals for numbers, counters and calculated fields can now be a range, e.g. 7 to 9 hours of sleep: within it the day is green, the further below or above, the redder. Or a goal applies to the whole week, e.g. at least 150 minutes of exercise: “Today” shows how far along you are this week, and a week is only rated once it’s over.',
      'In Settings you choose whether your week starts on Monday, Sunday or Saturday. This applies to the week view, the month calendar, “once a week” fields and the weekly summary. Anything you’ve already entered in weekly fields moves along.',
    ],
  },
  {
    id: '2026-10-30',
    short: {
      de: [
        'Neues Feld: Such dir eine Vorlage aus – fertige Felder oder Bausteine wie „Ja oder Nein“.',
        'Felder, die du schon hast, kannst du in eine Vorlage übernehmen – deine Einträge bleiben.',
        'Neue Feld-Arten: Uhrzeit (z. B. ins Bett und aufgestanden, mit Schlafdauer daraus) und „Mehrere ankreuzen“.',
        'Berechnete Felder zählen jetzt auch die Tage seit etwas, z. B. seit dem letzten Sport.',
        'Felder, in die du schon etwas eingetragen hast, kannst du jetzt umbauen – z. B. einer Skala mehr Stufen geben.',
        'Beim Anlegen und Bearbeiten steht Seltenes jetzt unter „Mehr“, Erklärungen hinter dem „?“.',
      ],
      en: [
        'New field: pick a template – ready-made fields or building blocks like “Yes or No”.',
        'Fields you already have can be taken into a template – your entries stay.',
        'New field types: time (e.g. went to bed and got up, with how long you slept) and “Tick several”.',
        'Calculated fields can now count the days since something, e.g. since your last workout.',
        'You can now rework fields you’ve already filled in – e.g. give a scale more steps.',
        'When you create or edit a field, rarely used settings are now under “More”, explanations behind the “?”.',
      ],
    },
    de: [
      'Wenn du ein neues Feld anlegst, suchst du dir jetzt zuerst eine Vorlage aus: fertige Felder wie Stimmung, Schlaf oder Zyklus, oder Bausteine wie „Ja oder Nein“ oder „Wie stark?“, denen du selbst einen Namen gibst. Alles lässt sich danach wie jedes andere Feld ändern; „Eigenes Feld“ gibt es weiterhin.',
      'Hast du schon ein passendes Feld, kannst du es in die Vorlage übernehmen: Es bekommt ihre Einstellungen, deine Einträge bleiben. Oder du ersetzt es – dann wird das alte archiviert und bleibt in der Auswertung sichtbar. Ja/Nein-Felder kannst du in „Was war heute?“ zusammenführen: Jedes wird eine Option, deine Einträge kommen mit.',
      'Neue Feld-Art Uhrzeit, z. B. für „ins Bett“ und „aufgestanden“. Ein berechnetes Feld macht daraus die Dauer, auch über Mitternacht. Die Uhrzeit wählst du mit Drehrädern, mit „+5 min“ kommst du schnell etwas später an.',
      'Neue Feld-Art „Mehrere ankreuzen“: Du tippst alles an, was heute war, oder „nichts davon“. In der Auswertung bekommt jede Option eine eigene Zeile.',
      'Berechnete Felder können jetzt die Tage seit etwas zählen: seit dem letzten Mal (z. B. Tage seit dem letzten Sport) oder seit Beginn (z. B. der Zyklustag).',
      'Felder, in die du schon etwas eingetragen hast, kannst du jetzt umbauen: einer Skala mehr oder weniger Stufen geben („Stufen ändern“) oder den Typ wechseln, z. B. von Skala zu Zahl („Typ ändern“). Beides findest du, wenn du das Feld bearbeitest. Du legst selbst fest, was aus deinen bisherigen Einträgen wird, und kannst es wieder rückgängig machen.',
      'Wenn du ein Feld anlegst oder bearbeitest, steht Seltenes jetzt zugeklappt unter „Mehr“ – z. B. der Schieberegler oder ein Ziel. Längere Erklärungen öffnest du mit dem „?“.',
    ],
    en: [
      'When you create a new field, you now pick a template first: ready-made fields like Mood, Sleep or Cycle, or building blocks like “Yes or No” or “How strong?” that you name yourself. Afterwards you can change everything like with any other field; “Your own field” is still there.',
      'If you already have a matching field, you can take it into the template: it gets the template’s settings and your entries stay. Or you replace it – then the old one is archived and stays visible in the stats. Yes/no fields can be merged into “What happened today?”: each becomes an option, and your entries come along.',
      'New field type time, e.g. for “went to bed” and “got up”. A calculated field turns them into a duration, even across midnight. You pick the time with scroll wheels, and “+5 min” quickly moves it a bit later.',
      'New field type “Tick several”: you tap everything that happened today, or “none of these”. In the stats each option gets its own row.',
      'Calculated fields can now count the days since something: since the last time (e.g. days since your last workout) or since the start (e.g. your cycle day).',
      'You can now rework fields you’ve already filled in: give a scale more or fewer steps (“Change steps”) or switch its type, e.g. from scale to number (“Change type”). You’ll find both when you edit the field. You decide what happens to your previous entries, and you can undo it.',
      'When you create or edit a field, rarely used settings are now folded away under “More” – e.g. the slider or a goal. Longer explanations open with the “?”.',
    ],
  },
  {
    id: '2026-10-28',
    short: {
      de: [
        'Mehrere Erinnerungen pro Feld, auch für Zähler.',
        'Felder können jetzt auch alle paar Tage dran sein.',
        'Tipp in „Heute“ aufs Datum, um direkt einen Tag auszuwählen.',
        'In Woche, Monat, Jahr und Gesamt: Tipp auf den Namen eines Felds, um es zu bearbeiten.',
      ],
      en: [
        'Several reminders per field, counters included.',
        'Fields can now also be due every few days.',
        'Tap the date in “Today” to pick a day directly.',
        'In Week, Month, Year and Overall: tap a field’s name to edit it.',
      ],
    },
    de: [
      'Ein Feld kann jetzt bis zu vier Erinnerungszeiten haben, z. B. morgens und abends. Auch Zähler erinnern dich jetzt – auf Wunsch nur, wenn sie zu der Zeit unter einer Zahl liegen, die du festlegst.',
      'Ein Feld kann jetzt auch alle paar Tage dran sein, z. B. alle 3 Tage – wenn du ein Feld anlegst, unter „An welchen Tagen?“.',
      'Tippst du in „Heute“ auf das Datum, kannst du direkt einen Tag auswählen.',
      'In Woche, Monat, Jahr und Gesamt kannst du ein Feld bearbeiten, indem du auf seinen Namen tippst.',
    ],
    en: [
      'A field can now have up to four reminder times, e.g. morning and evening. Counters can remind you now too – if you like, only when they’re below a number you choose at that time.',
      'A field can now also be due every few days, e.g. every 3 days – when you create a field, under “On which days?”.',
      'Tap the date in “Today” to pick a day directly.',
      'In Week, Month, Year and Overall you can edit a field by tapping its name.',
    ],
  },
  {
    id: '2026-10-14',
    de: [
      'Woche, Monat, Jahr und Gesamt sind jetzt besser lesbar.',
      'Menüs und Fenster erscheinen sanfter, Knöpfe reagieren sichtbar, wenn du sie antippst.',
      'Hat eine Zahl ein Ziel, steht es in „Heute“ direkt daneben, zum Beispiel „1 / 2“ – und die Zahl wird grüner, je näher du dran bist.',
      'Den Tag siehst du in „Heute“ jetzt beim Scrollen immer oben, darunter steht, wenn alles eingetragen ist. Wer mag, lässt dort auch den Stand anzeigen, z. B. „3 von 7“ – in den Einstellungen unter Anzeige.',
    ],
    en: [
      'Week, Month, Year and Overall are now easier to read.',
      'Menus and windows appear more smoothly, and buttons respond visibly when you tap them.',
      'If a number has a goal, “Today” shows it right next to it, e.g. “1 / 2” – and the number turns greener the closer you get.',
      'In “Today” the day now always stays at the top while you scroll, with a note once everything is filled in. If you like, it can also show your progress, e.g. “3 of 7” – in the settings under Display.',
    ],
  },
  {
    id: '2026-10-12',
    de: [
      'Wenn du ein Feld anlegst oder änderst, ist alles übersichtlicher geordnet, mit einer Vorschau, wie es später aussieht.',
      'Zahlen kannst du in Woche, Monat und Jahr jetzt auch als Summe sehen statt als Durchschnitt, etwa bei Arbeitszeit – einstellbar im Feld unter „Auswertung“.',
      'Feste Tage stellst du jetzt einfach über die Wochentage ein, alle sind vorausgewählt.',
    ],
    en: [
      'When you create or change a field, everything is laid out more clearly, with a preview of how it will look.',
      'Numbers can now show a total instead of an average in week, month and year, e.g. for working hours – set it in the field under “Statistics”.',
      'Fixed days are now set simply via the weekdays, all of which are preselected.',
    ],
  },
  {
    id: '2026-10-11',
    de: [
      'Felder können jetzt wöchentlich, monatlich oder jährlich sein, zum Beispiel „Diese Woche geputzt?“ – du findest sie in „Heute“ ganz unten.',
      'Zahlen kannst du jetzt auch mit „+“ hochzählen, etwa Zigaretten oder Gläser Wasser – und ihnen ein Ziel geben wie „mindestens 8“ oder „höchstens 3“.',
      'Gruppen sind als Block hervorgehoben und klappen zu, sobald alles eingetragen ist (einstellbar pro Gruppe).',
      'Ziele und Auswertung in verständlichen Zahlen statt Prozent, zum Beispiel „an 3 von 7 Tagen“ oder „Ø 3,4 von 5“.',
    ],
    en: [
      'Fields can now be weekly, monthly or yearly, for example “Cleaned this week?” – you find them at the very bottom of “Today”.',
      'Numbers can now be counted up with “+”, e.g. cigarettes or glasses of water – and get a goal like “at least 8” or “at most 3”.',
      'Groups stand out as a block and collapse once everything is filled in (adjustable per group).',
      'Goals and statistics in plain numbers instead of percent, for example “on 3 of 7 days” or “avg. 3.4 of 5”.',
    ],
  },
];

export function unseenChangelog() {
  const last = state.userSettings.lastSeenChangelog;
  return CHANGELOG.filter((e) => !last || e.id > last);
}

// Schließen = gesehen, auf allen Wegen (Knopf, Escape, Zurück), sonst käme es beim nächsten
// Öffnen wieder. Best effort: schlägt das Speichern fehl, kommt das Fenster eben nochmal.
export function closeWhatsNew() {
  state.whatsNew = false;
  const latest = CHANGELOG[0].id;
  state.userSettings = { ...state.userSettings, lastSeenChangelog: latest };
  if (state.session) {
    supabase.from('user_settings').upsert({ user_id: state.session.user.id, last_seen_changelog: latest }, { onConflict: 'user_id' })
      .then(({ error }) => { if (error) console.warn('Neuigkeiten nicht als gesehen gespeichert:', error.message); });
  }
}
