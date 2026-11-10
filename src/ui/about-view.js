import { supabase } from '../lib/config.js';
import { hasDayGoal, hasNumberGoal, hasNumericSeries, hasWeekGoal, isCounterKind, isDurationComputed, isMultiKind, isScoredKind, isSinceComputed, isTextKind, isTimeKind, multiValue, numberGoalText, weekGoalChartNote } from '../domain/fields.js';
import { NEUTRAL_FILL, applyGoal, habitColor, isNeutralScale, isPlannedOn, scoreTextColor } from '../domain/dates.js';
import { state } from '../state/state.js';
import { formatDMY, round1 } from '../lib/format.js';
import { getNote } from '../data/save.js';
import { isAboutSectionCollapsed } from '../data/device.js';
import { renderBySection, statsFieldName } from './row-view.js';
import { esc, icon } from '../lib/html.js';
import { computeHabitStats, formatSeriesValue, numberFieldStats } from '../domain/scores.js';
import { addDays, formatKey, isFutureKey, isPeriodField, parseDateKey } from '../lib/calendar.js';
import { requestRender } from '../lib/render-request.js';
import { CHANGELOG, unseenChangelog } from '../data/changelog.js';
import { currentLocale, detectLikelyCountry, formatNumber, t, tPlain } from '../lib/i18n.js';

// --- Rendering: Über Logbuch / Tipps -----------------------------------------
// Ruhige, freiwillig aufsuchbare Sammelstelle für Bedienhinweise, die sonst nirgends
// erklärt werden (Wischen, Tag antippen zum Springen, Gruppen, ...) — bewusst kein
// aufdringliches Tutorial/Tooltip-Overlay, sondern eine Seite, die da ist, wenn man
// neugierig ist. Die Tipp-Gruppen (tipGroup) sind eine simple Array-Struktur statt
// vieler Einzel-Strings, damit neue Tipps sich leicht ergänzen lassen.
// Ein Tipp in "Über Logbuch". link (optional): wohin der Tipp verweist - { menu:
// '<data-menu-target>' } öffnet die Einstellungen und springt zur Einstellung (focusSettingsTarget),
// { manage: true } öffnet "Felder verwalten". Der Tipp-Titel steht im Link zusätzlich
// unsichtbar für Screenreader, sonst hießen alle Links nur "Im Menü zeigen".
// bodyTag 'div' für Texte mit Liste (Datenschutz), sonst 'p'.
function renderTip([titleKey, bodyKey, link], bodyTag = 'p') {
  const linkHtml = !link ? '' : link.menu
    ? `<button type="button" class="link-btn tip-link" data-action="open-settings-at" data-target="${link.menu}">${t('about.link.menu')}<span class="visually-hidden">: ${t(titleKey)}</span></button>`
    : `<button type="button" class="link-btn tip-link" data-action="open-manage">${t('about.link.manage')}<span class="visually-hidden">: ${t(titleKey)}</span></button>`;
  return `
    <div class="tip">
      <p class="tip-title">${t(titleKey)}</p>
      <${bodyTag} class="tip-body">${t(bodyKey)}</${bodyTag}>
      ${linkHtml}
    </div>
  `;
}
function tipGroup(groupTitleKey, tips, iconName) {
  const collapseKey = `tipGroup:${groupTitleKey}`;
  return `
    <details class="tip-group" data-collapse-key="${collapseKey}" ${isAboutSectionCollapsed(collapseKey) ? '' : 'open'}>
      <summary class="manage-section-title">${iconName ? icon(iconName) : ''}${t(groupTitleKey)}</summary>
      ${tips.map((tip) => renderTip(tip)).join('')}
    </details>
  `;
}

// Eigener, optisch hervorgehobener Bereich (statt nur einer weiteren Tipp-Gruppe) —
// ausdrücklicher Nutzerwunsch, das Thema sichtbar stärker zu gewichten als die
// übrigen, eher beiläufigen Bedienungs-Tipps. Ausführlichere Texte inkl. der
// Begründung, warum uns das wichtig ist (siehe docs/design-bedienung.md), nicht nur die
// nackten Fakten.
function renderA11ySection() {
  const items = [
    ['about.a11y.pattern.title', 'about.a11y.pattern.body', { menu: 'pattern' }],
    ['about.a11y.textSize.title', 'about.a11y.textSize.body', { menu: 'text-size' }],
    ['about.a11y.buttons.title', 'about.a11y.buttons.body'],
    ['about.a11y.keyboard.title', 'about.a11y.keyboard.body'],
    ['about.a11y.screenreader.title', 'about.a11y.screenreader.body'],
  ];
  return `
    <details class="a11y-highlight" data-collapse-key="aboutA11yCollapsed" ${isAboutSectionCollapsed('aboutA11yCollapsed') ? '' : 'open'}>
      <summary class="manage-section-title">${icon('a11y')}${t('about.a11y.title')}</summary>
      <p class="tip-body">${t('about.a11y.intro')}</p>
      ${items.map((tip) => renderTip(tip)).join('')}
      <p class="tip-body a11y-feedback">${t('about.a11y.feedback')} <button type="button" class="link-btn" data-action="open-feedback">${t('menu.feedback')}</button></p>
    </details>
  `;
}

// Ebenfalls eigener hervorgehobener Bereich, gleiches Muster wie renderA11ySection —
// derselbe Gedanke, dass ein Produkt, das beim An-sich-selbst-Arbeiten helfen soll,
// auch aktiv auf einen gesunden Umgang damit hinweisen sollte, statt das nur implizit
// zu hoffen. Der Krisen-Hinweis (Telefonseelsorge) ist bewusst optisch eigenständig
// (rust- statt moss-Ton) hervorgehoben, da er der konkret handlungsrelevante Teil ist.
function renderMentalHealthSection() {
  const items = [
    ['about.mentalHealth.observation.title', 'about.mentalHealth.observation.body'],
    ['about.mentalHealth.noSubstitute.title', 'about.mentalHealth.noSubstitute.body'],
  ];
  return `
    <details class="mental-health-highlight" data-collapse-key="aboutMentalHealthCollapsed" ${isAboutSectionCollapsed('aboutMentalHealthCollapsed') ? '' : 'open'}>
      <summary class="manage-section-title">${icon('mentalHealth')}${t('about.mentalHealth.title')}</summary>
      <p class="tip-body">${t('about.mentalHealth.intro')}</p>
      ${items.map((tip) => renderTip(tip)).join('')}
      <div class="tip mental-health-crisis">
        <p class="tip-title">${t('about.mentalHealth.crisis.title')}</p>
        ${detectLikelyCountry() === 'DE' ? `
          <p class="tip-body">${t('about.mentalHealth.crisis.germany')}</p>
          <div class="crisis-actions">
            <a class="crisis-action-button" href="https://www.telefonseelsorge.de" target="_blank" rel="noopener">${esc(t('about.mentalHealth.crisis.websiteButton'))}</a>
            <a class="crisis-action-button" href="tel:+498001110111">${esc(t('about.mentalHealth.crisis.callButton1'))}</a>
            <a class="crisis-action-button" href="tel:+498001110222">${esc(t('about.mentalHealth.crisis.callButton2'))}</a>
          </div>
        ` : ''}
        <p class="tip-body">${t('about.mentalHealth.crisis.international')}</p>
        <p class="tip-body">${t('about.mentalHealth.crisis.emergency')}</p>
        <p class="tip-body">${t('about.mentalHealth.crisis.closing')}</p>
      </div>
      <p class="tip-body mental-health-feedback">${t('about.mentalHealth.feedback')} <button type="button" class="link-btn" data-action="open-feedback">${t('menu.feedback')}</button></p>
    </details>
  `;
}

// Dritter hervorgehobener Bereich, gleiches Muster wie renderA11ySection: was der
// Betreiber sehen kann und was nicht, und warum. WICHTIG: muss mit der Technik
// übereinstimmen - ändert sich, was der Server im Klartext sieht (neue unverschlüsselte
// Spalte, Log, Auswertung o.ä.), diesen Text mit anpassen (siehe CLAUDE.md
// "Pflichten bei Änderungen"). Die Punkte stehen in <div> statt <p>, da einer eine Liste enthält.
function renderPrivacySection() {
  const items = [
    ['about.privacy.cannotSee.title', 'about.privacy.cannotSee.body'],
    ['about.privacy.canSee.title', 'about.privacy.canSee.body'],
    ['about.privacy.recoveryKey.title', 'about.privacy.recoveryKey.body', { menu: 'recovery-key' }],
    ['about.privacy.yourData.title', 'about.privacy.yourData.body', { menu: 'export' }],
  ];
  return `
    <details class="privacy-highlight" data-collapse-key="aboutPrivacyCollapsed" ${isAboutSectionCollapsed('aboutPrivacyCollapsed') ? '' : 'open'}>
      <summary class="manage-section-title">${icon('privacy')}${t('about.privacy.title')}</summary>
      <p class="tip-body">${t('about.privacy.intro')}</p>
      ${items.map((tip) => renderTip(tip, 'div')).join('')}
      <p class="tip-body privacy-feedback">${t('about.privacy.feedback')} <button type="button" class="link-btn" data-action="open-feedback">${t('menu.feedback')}</button></p>
    </details>
  `;
}

// "Beta – Stand …" in "Über Logbuch" = neuester Eintrag (früher eine eigene Konstante, die man
// zusätzlich pflegen musste).
const APP_STATUS_DATE = CHANGELOG[0].id;
function changelogItems(entry) { return entry[currentLocale] || entry.de; }
function changelogShortItems(entry) { return entry.short ? (entry.short[currentLocale] || entry.short.de) : changelogItems(entry); }
export function renderWhatsNew() {
  const entries = unseenChangelog();
  return `
    <div class="modal-overlay">
      <div class="modal-box whats-new" role="dialog" aria-modal="true" aria-labelledby="whats-new-title">
        <h2 id="whats-new-title">${icon('news')}${t('whatsNew.title')}</h2>
        ${entries.map((e) => `
          ${entries.length > 1 ? `<h3 class="whats-new-date">${esc(formatDMY(e.id))}</h3>` : ''}
          <ul class="whats-new-list">${changelogShortItems(e).map((item) => `<li>${esc(item)}</li>`).join('')}</ul>
        `).join('')}
        <div class="habit-form-actions">
          <button type="button" class="habit-form-cancel" data-action="whats-new-all">${t('whatsNew.all')}</button>
          <button type="button" class="auth-submit" data-action="whats-new-close">${t('whatsNew.close')}</button>
        </div>
      </div>
    </div>
  `;
}
// Aufklappbar und zu Beginn zu wie die übrigen Bereiche hier; "Alle Neuigkeiten" im
// "Was ist neu"-Fenster öffnet ihn (whats-new-all).
function renderAboutNews() {
  return `
    <details class="tip-group about-news" id="about-news" data-collapse-key="aboutNewsCollapsed" ${isAboutSectionCollapsed('aboutNewsCollapsed') ? '' : 'open'}>
      <summary class="manage-section-title">${icon('news')}${t('about.news.title')}</summary>
      ${CHANGELOG.map((e) => `
        <h3 class="whats-new-date">${esc(formatDMY(e.id))}</h3>
        <ul class="whats-new-list">${changelogItems(e).map((item) => `<li>${esc(item)}</li>`).join('')}</ul>
      `).join('')}
    </details>
  `;
}

export function renderAbout() {
  return `
    <p class="about-status">${t('about.status', { date: formatDMY(APP_STATUS_DATE) })} <button type="button" class="link-btn" data-action="open-feedback">${t('menu.feedback')}</button></p>
    <p class="about-status about-status--secondary">${t('about.monetizationNote')}</p>
    <p class="about-intro">${t('about.intro')}</p>
    ${renderMentalHealthSection()}
    ${renderA11ySection()}
    ${renderPrivacySection()}
    <div class="manage-section-divider"></div>
    ${renderAboutNews()}
    <div class="manage-section-divider"></div>
    ${tipGroup('about.group.usage', [
      ['about.tip.swipe.title', 'about.tip.swipe.body'],
      ['about.tip.keys.title', 'about.tip.keys.body'],
      ['about.tip.jumpDay.title', 'about.tip.jumpDay.body'],
      ['about.tip.toggleOff.title', 'about.tip.toggleOff.body'],
      ['about.tip.openDot.title', 'about.tip.openDot.body'],
      ['about.tip.fieldMenu.title', 'about.tip.fieldMenu.body'],
      ['about.tip.reorder.title', 'about.tip.reorder.body', { manage: true }],
    ], 'usage')}
    <div class="manage-section-divider"></div>
    ${tipGroup('about.group.fields', [
      ['about.tip.noValuation.title', 'about.tip.noValuation.body'],
      ['about.tip.computed.title', 'about.tip.computed.body'],
      ['about.tip.goalThreshold.title', 'about.tip.goalThreshold.body'],
      ['about.tip.slider.title', 'about.tip.slider.body'],
      ['about.tip.textFields.title', 'about.tip.textFields.body'],
      ['about.tip.customReminder.title', 'about.tip.customReminder.body'],
      ['about.tip.sections.title', 'about.tip.sections.body', { manage: true }],
      ['about.tip.schedule.title', 'about.tip.schedule.body', { manage: true }],
      ['about.tip.archiveVsDelete.title', 'about.tip.archiveVsDelete.body', { manage: true }],
    ], 'fields')}
    <div class="manage-section-divider"></div>
    ${tipGroup('about.group.appearance', [
      ['about.tip.theme.title', 'about.tip.theme.body', { menu: 'theme' }],
      ['about.tip.textSize.title', 'about.tip.textSize.body', { menu: 'text-size' }],
      ['about.tip.language.title', 'about.tip.language.body', { menu: 'language' }],
    ], 'appearance')}
  `;
}

// Übergangslösung, bis es ggf. einen Community-Bereich gibt. Das eigentliche Limit
// (5 pro 24h) und die Mail an den Betreiber laufen serverseitig in der Edge Function
// submit-feedback. Der Absender-Hinweis wird beim Umschalten direkt im DOM getauscht
// statt per render() - ein Re-Render würde den Fokus von der Checkbox wegreißen.
// t() escaped die E-Mail-Adresse bereits - das Ergebnis ist fertiges HTML (innerHTML,
// nie noch einmal durch esc()).
export function feedbackSenderNote(anonymous) {
  return anonymous ? t('feedback.anonymousNote') : t('feedback.replyNote', { email: state.session?.user?.email ?? '' });
}
export function renderFeedback() {
  const f = state.feedback;
  return `
    <div class="feedback-form">
      <p class="tip-body feedback-intro">${t('feedback.intro')}</p>
      <div class="auth-field">
        <label for="feedback-message">${t('feedback.messageLabel')}</label>
        <textarea id="feedback-message" maxlength="5000" ${f.busy ? 'disabled' : ''}>${esc(f.message)}</textarea>
      </div>
      <label class="checkbox-field">
        <input type="checkbox" data-action="feedback-anonymous" aria-describedby="feedback-sender-note" ${f.anonymous ? 'checked' : ''} ${f.busy ? 'disabled' : ''} />
        ${t('feedback.anonymousLabel')}
      </label>
      <p class="habit-form-lock-note" id="feedback-sender-note">${feedbackSenderNote(f.anonymous)}</p>
      <button type="button" class="manage-new-btn" data-action="feedback-submit" ${f.busy ? 'disabled' : ''}>${f.busy ? t('feedback.sending') : t('feedback.submit')}</button>
    </div>
  `;
}

export async function handleFeedbackSubmit() {
  const message = state.feedback.message.trim();
  if (!message) {
    state.notice = { type: 'error', text: t('feedback.error.empty') };
    requestRender();
    return;
  }
  state.feedback.busy = true;
  requestRender();
  const { error } = await supabase.functions.invoke('submit-feedback', {
    body: { message, anonymous: state.feedback.anonymous, locale: currentLocale },
  });
  state.feedback.busy = false;
  if (error) {
    // Bei Nicht-2xx liefert supabase-js die eigentliche Antwort in error.context.
    let code = null;
    try { code = (await error.context.json()).error; } catch { /* z.B. Netzwerkfehler */ }
    state.notice = { type: 'error', text: code === 'rate_limited' ? t('feedback.error.rateLimited') : t('feedback.error.failed') };
  } else {
    state.feedback = { message: '', anonymous: false, busy: false };
    state.notice = { type: 'ok', text: t('feedback.sent') };
  }
  requestRender();
}

// Durchschnitt eines bewerteten Felds in natürlichen Begriffen (Nutzer-Entscheidung
// 2026-10-10, statt Prozent für alle): Ja/Nein "an 2 von 5 Tagen „Ja“", mehrstufige Skala
// "Ø 3,4" in den Werten des Felds (bei eigenen Bezeichnungen zusätzlich, zwischen welchen
// sie liegt), berechnete Felder weiter in % (sie mitteln über verschiedene Skalen).
// avg = Mittel der normalisierten Scores über die eingetragenen Tage, count = deren Anzahl.
export function isYesNoScale(h) { return h.kind === 'scale' && !!h.good && h.max - h.min === 1; }
export function scaleLabelAt(h, value) { return h.labels ? h.labels[value - h.min] : String(value); }
function avgScaleValue(h, avg) {
  return h.good === 'low' ? h.max - avg * (h.max - h.min) : h.min + avg * (h.max - h.min);
}
// Zwischen welchen Bezeichnungen der Ø liegt, mit ihren Zahlen (dieselben wie im
// Feld-Formular vor den Bezeichnungen), damit die Zahl davor zuzuordnen ist:
// "keine (1) – leicht (2)"; liegt der Ø auf einer Stufe, nur deren Bezeichnung.
function avgLabelSpan(h, avg) {
  if (!h.labels) return '';
  const v = avgScaleValue(h, avg);
  const lower = Math.floor(v + 0.05);
  const upper = Math.ceil(v - 0.05);
  return lower >= upper
    ? scaleLabelAt(h, lower)
    : `${scaleLabelAt(h, lower)} (${formatNumber(lower)}) – ${scaleLabelAt(h, upper)} (${formatNumber(upper)})`;
}
// Mini-Skala mit Punkt an der Stelle des Ø (Skalen ab drei Stufen): eine Zahl allein verrät
// nicht, wie viele Stufen es gibt, eine Bezeichnung passt oft nicht in die Wochenspalte.
// Ausgerichtet wie das Feld selbst (links der erste Wert, wie die Knöpfe in "Heute"); ob gut
// oder schlecht, zeigt die Farbe (Nutzer-Entscheidung 2026-10-11 - "rechts = besser" war bei
// "Niedrige Werte erstrebenswert" verwirrend).
function isMultiStepScale(h) { return h.kind === 'scale' && !!h.good && h.max - h.min > 1; }
function avgMiniScale(h, avg, extraClass = '') {
  const pos = h.good === 'low' ? 1 - avg : avg; // avg ist "wie gut" - zurück auf die Feldrichtung
  return `<span class="avg-scale${extraClass}" aria-hidden="true"><span class="avg-scale-dot" style="left:${(pos * 100).toFixed(1)}%"></span></span>`;
}
// Kurzform für die schmale Ø-Spalte der Woche (HTML); den genauen Wert zeigt Antippen.
// Zahlen mit Ziel: der Durchschnitt ist die Hauptzahl (Zahlen denkt man in Schnitten - "2/7"
// sah wie ein Wert aus), wie oft das Ziel erreicht war steht in der Langform.
export function habitAvgShort(h, avg, count, hits = 0, numAvg = null) {
  if (hasDayGoal(h)) return formatNumber(round1(numAvg ?? 0));
  if (isMultiStepScale(h)) return avgMiniScale(h, avg);
  if (isYesNoScale(h)) return `${Math.round(avg * count)}/${count}`;
  if (h.kind === 'scale') return formatNumber(round1(avgScaleValue(h, avg)));
  return Math.round(avg * 100) + '%';
}
export function habitAvgLong(h, avg, count, hits = 0, numAvg = null) {
  if (hasDayGoal(h)) {
    return `Ø ${formatNumber(round1(numAvg ?? 0))}${h.unit ? ` ${h.unit}` : ''} · ${tPlain('stats.goalHits' + (isPeriodField(h) ? `.${h.period}` : ''), { n: hits, total: count })}`;
  }
  if (isYesNoScale(h)) {
    const best = scaleLabelAt(h, h.good === 'low' ? h.min : h.max);
    const unit = isPeriodField(h) ? `.${h.period}` : '';
    return tPlain((h.labels ? 'stats.yesNoDaysLabel' : 'stats.yesNoDays') + unit, { n: Math.round(avg * count), total: count, label: best });
  }
  if (h.kind === 'scale') {
    // Eigene Bezeichnungen: Zahl + zwischen welchen Bezeichnungen sie liegt (Nutzer-
    // Entscheidung 2026-10-11: die Zahl soll stehen bleiben, die Zuordnung klar sein).
    // Sonst die Zahl samt Spanne - "von 5" bei Skalen ab 1 (alle seit 2026-09-18 angelegten);
    // ältere Felder mit Daten behalten ihren Startwert (Schieberegler ab 0, Knöpfe auch z.B.
    // -2 bis 2), dort "(0 bis 10)".
    const v = formatNumber(round1(avgScaleValue(h, avg)));
    if (h.labels) return `Ø ${v} · ${avgLabelSpan(h, avg)}`;
    return h.min === 1
      ? tPlain('stats.scaleOf', { value: v, max: h.max })
      : tPlain('stats.scaleRange', { value: v, min: formatNumber(h.min), max: formatNumber(h.max) });
  }
  return Math.round(avg * 100) + '%';
}
// Mehrfachauswahl in der Auswertung (Nutzer-Idee 2026-10-30): das Feld als eigene Zeile, darunter
// je Option eine Unterzeile wie ein Ja/Nein-Feld - eingetragen wird gesammelt, ausgewertet jede
// Option für sich. "an n von m Tagen": m = Tage, an denen das Feld eingetragen war (auch "nichts
// davon"). Ausgeblendete Optionen nur, solange sie im Zeitraum vorkommen.
export function multiOptionCounts(h, dateKeys) {
  const entered = dateKeys.filter((k) => multiValue(h, k) !== null);
  const options = (h.options || []).filter((o) => !o.hidden || entered.some((k) => multiValue(h, k).includes(o.id)));
  return { entered: entered.length, options: options.map((o) => ({ option: o, n: entered.filter((k) => multiValue(h, k).includes(o.id)).length })) };
}
export function multiWeekRows(h, dayKeys, days) {
  const values = dayKeys.map((k) => multiValue(h, k));
  const cellAttrs = (i) => (isFutureKey(dayKeys[i]) ? '' : `data-action="open-day" data-date="${dayKeys[i]}" data-focus-habit="${h.id}"`);
  const { entered, options } = multiOptionCounts(h, dayKeys);
  // Kopfzeile: wie viele Optionen am Tag gewählt waren (0 = "nichts davon").
  const head = `
    <div class="grid-row">
      <div class="grid-label">${statsFieldName(h, 'grid')}</div>
      ${values.map((v, i) => `<div class="grid-cell grid-cell--count${getNote(dayKeys[i], h.id) ? ' has-note' : ''}${v === null && !isPlannedOn(h, days[i]) ? ' grid-cell--unplanned' : ''}" ${cellAttrs(i)} aria-hidden="true">${v === null ? '' : v.length}</div>`).join('')}
      <div class="grid-cell grid-cell--avg grid-cell--blank"></div>
    </div>
  `;
  return head + options.map(({ option, n }) => {
    const long = `${option.label}: ${tPlain('stats.yesNoDays', { n, total: entered })}`;
    return `
      <div class="grid-row grid-row--sub">
        <div class="grid-label grid-label--sub">${esc(option.label)}</div>
        ${values.map((v, i) => `<div class="grid-cell" ${cellAttrs(i)}${v?.includes(option.id) ? ` style="background-color:${NEUTRAL_FILL}"` : ''} aria-hidden="true"></div>`).join('')}
        ${entered
          ? `<button type="button" class="grid-cell grid-cell--avg grid-cell--plain" data-action="avg-info" data-text="${esc(long)}" aria-label="${esc(long)}">${n}/${entered}</button>`
          : '<div class="grid-cell grid-cell--avg grid-cell--plain">–</div>'}
      </div>
    `;
  }).join('');
}
function renderMultiStatsRows(h, dateKeys) {
  const { entered, options } = multiOptionCounts(h, dateKeys);
  return `
    <div class="month-stat-row">
      <span class="habit-name">${statsFieldName(h, 'rows')}</span>
      <span class="month-stat-value">${entered ? `<span class="month-stat-count">${entered}×</span>` : '<span class="month-stat-count">–</span>'}</span>
    </div>
    ${entered ? options.map(({ option, n }) => `
      <div class="month-stat-row month-stat-row--sub">
        <span class="habit-name">${esc(option.label)}</span>
        <span class="month-stat-value">${esc(tPlain('stats.yesNoDays', { n, total: entered }))}</span>
      </div>
    `).join('') : ''}
  `;
}
// Liste pro Feld in Monat/Jahr/Gesamt: bewertete Felder mit Durchschnitt, Mehrfachauswahl mit
// ihren Unterzeilen - in der Reihenfolge der Verwaltung, nach Gruppen.
export function inFieldStatsList(h) { return isScoredKind(h) || isMultiKind(h); }
export function renderFieldStatsList(habits, dateKeys) {
  const listed = habits.filter(inFieldStatsList);
  const stats = computeHabitStats(listed.filter(isScoredKind), dateKeys);
  return renderBySection(listed, 'stats', (list) => list.map((h) => (isMultiKind(h)
    ? renderMultiStatsRows(h, dateKeys)
    : renderStatsRows(stats.filter((st) => st.habit === h)))).join(''));
}
export function renderStatsRows(stats) {
  return stats.map(({ habit, avg, count, hits, numAvg }) => `
    <div class="month-stat-row">
      <span class="habit-name">${statsFieldName(habit, 'rows')}</span>
      ${isNeutralScale(habit)
        ? `<span class="month-stat-value"><span class="month-stat-count">${count}×</span></span>`
        : `<span class="month-stat-value" style="color:${avg === null ? 'var(--sand)' : scoreTextColor(habitColor(habit, applyGoal(habit, avg)))}">${avg !== null && isMultiStepScale(habit) ? avgMiniScale(habit, avg, ' avg-scale--inline') : ''}${avg !== null ? esc(habitAvgLong(habit, avg, count, hits, numAvg)) : '–'}${avg !== null && !isYesNoScale(habit) && !hasDayGoal(habit) ? ` <span class="month-stat-count">(${count}×)</span>` : ''}</span>`}
    </div>
  `).join('');
}

// Durchschnitt erste vs. zweite Hälfte der Reihe statt reinem Endpunkt-Vergleich —
// robuster gegen einzelne Ausreißer am Rand. Unterschiede unter 5% der Spannweite
// gelten als Rauschen ("gleichbleibend"), nicht als echter Trend.
function trendDirection(series, range) {
  const mid = Math.floor(series.length / 2);
  const firstAvg = series.slice(0, mid).reduce((a, p) => a + p.value, 0) / mid;
  const secondHalf = series.slice(mid);
  const secondAvg = secondHalf.reduce((a, p) => a + p.value, 0) / secondHalf.length;
  const delta = secondAvg - firstAvg;
  if (Math.abs(delta) < range * 0.05) return 'flat';
  return delta > 0 ? 'up' : 'down';
}

// Zähler-Tagesfelder lückenlos über alle Tage des Bereichs: Jahr und Gesamt übergeben nur Tage
// mit irgendeinem Eintrag - ein Tag ohne App-Nutzung zählte dort sonst nicht als 0, im Monat
// (alle Tage) aber schon.
function counterDayKeys(dateKeys) {
  if (!dateKeys.length) return dateKeys;
  const sorted = [...dateKeys].sort();
  const todayKey = formatKey(new Date());
  const keys = [];
  for (let d = parseDateKey(sorted[0]); formatKey(d) <= sorted[sorted.length - 1] && formatKey(d) <= todayKey; d = addDays(d, 1)) keys.push(formatKey(d));
  return keys;
}
function renderNumberChart(habit, dateKeys, interactive) {
  if (isCounterKind(habit) && !isPeriodField(habit)) dateKeys = counterDayKeys(dateKeys);
  const stats = numberFieldStats(habit, dateKeys);
  // Uhrzeiten und Dauern auf die Minute statt auf eine Nachkommastelle (7,53 h -> 7:32, nicht 7:30).
  const fmt = (v, rounded) => formatSeriesValue(habit, rounded && !isTimeKind(habit) && !isDurationComputed(habit) ? round1(v) : v);
  const head = `
    <div class="number-chart-head">
      <span class="habit-name">${statsFieldName(habit, 'chart')}</span>
      ${stats ? `<span class="number-chart-meta">${isSinceComputed(habit)
        ? t('numberChart.metaLast', { last: fmt(stats.last) }) // Ø oder Anzahl von Zähl-Tagen sagen nichts
        : habit.summary === 'sum'
        ? t('numberChart.metaSum', { sum: fmt(stats.sum, true), avg: fmt(stats.avg, true), per: t('numberChart.per.' + (habit.period || 'day')), count: stats.count })
        : t('numberChart.meta', { last: fmt(stats.last), avg: fmt(stats.avg, true), count: stats.count })}${hasNumberGoal(habit) ? ` · ${esc(numberGoalText(habit))}` : ''}</span>` : ''}
    </div>
    ${hasWeekGoal(habit) ? weekGoalChartNote(habit, dateKeys) : ''}
  `;
  if (!stats || stats.series.length < 2) {
    return `<div class="number-chart-box">${head}<p class="manage-meta">${stats ? t('numberChart.tooFewValues') : t('numberChart.noValues')}</p></div>`;
  }
  const w = 280, h = 56, pad = 4;
  const n = stats.series.length;
  // Mit Tagesziel: Bereich so weit, dass die Ziellinie(n) sichtbar sind (Bereich: zwei Linien).
  // Ein Wochenziel ist keine Linie - die Summe liegt auf einer anderen Höhe als die Tageswerte.
  const goals = hasDayGoal(habit) ? (habit.goal.dir === 'range' ? [habit.goal.target, habit.goal.max] : [habit.goal.target]) : [];
  const lo = Math.min(stats.min, ...goals);
  const hi = Math.max(stats.max, ...goals);
  const range = hi - lo || 1;
  const yOf = (v) => h - pad - ((v - lo) / range) * (h - 2 * pad);
  const points = stats.series.map((p, i) => {
    const x = pad + (i / (n - 1)) * (w - 2 * pad);
    return [x, yOf(p.value)];
  });
  const goalLine = goals
    .map((g) => `<line x1="0" x2="${w}" y1="${yOf(g).toFixed(1)}" y2="${yOf(g).toFixed(1)}" style="stroke:var(--sand);stroke-width:1;stroke-dasharray:4 3" vector-effect="non-scaling-stroke" />`)
    .join('');
  const pointsAttr = points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const dots = points.map(([x, y]) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.6" style="fill:var(--ink)" />`).join('');
  // Tage mit Notiz zu diesem Feld: Ring um den Datenpunkt. Als HTML über dem SVG statt
  // als <circle> darin - das SVG wird per preserveAspectRatio="none" nur waagerecht
  // gestreckt, ein Kreis darin würde zur Ellipse. Senkrecht entspricht 1 Einheit genau
  // 1px (Höhe fest 56px, siehe .number-chart-svg), waagerecht wird in % umgerechnet.
  const noteRings = stats.series
    .map((p, i) => (getNote(p.key, habit.id) ? points[i] : null))
    .filter(Boolean);
  const rings = noteRings
    .map(([x, y]) => `<span class="number-chart-note" style="left:${((x / w) * 100).toFixed(2)}%;top:${y.toFixed(1)}px"></span>`)
    .join('');
  // Antippbare Spalten statt nur der winzigen Punkte: die ganze senkrechte Spalte um
  // einen Punkt (Breite = Abstand zwischen zwei Punkten) öffnet dessen Tag. Bewusst
  // nur für Zeige-Geräte (aria-hidden, nicht fokussierbar): per Tastatur erreicht man
  // denselben Tag schon über die Wochentage bzw. Monatszellen - bis zu 31 weitere
  // Tab-Stopps hier würden nur verlängern, ohne etwas Neues zugänglich zu machen.
  const hits = interactive
    ? stats.series.map((p, i) => {
      // Am Rand abgeschnitten statt um den Punkt zentriert - die äußeren Spalten ragten
      // sonst zur Hälfte über den Graphen hinaus und machten die ganze Seite waagerecht
      // scrollbar.
      const center = (points[i][0] / w) * 100;
      const left = Math.max(0, center - 50 / n);
      const right = Math.min(100, center + 50 / n);
      return `<span class="number-chart-hit" data-action="open-day" data-date="${p.key}" data-focus-habit="${habit.id}" style="left:${left.toFixed(2)}%;width:${(right - left).toFixed(2)}%"></span>`;
    }).join('')
    : '';
  const trend = trendDirection(stats.series, range);
  const summary = isSinceComputed(habit) ? t('numberChart.summaryLast', { name: habit.name, last: fmt(stats.last) }) : t('numberChart.summary', {
    name: habit.name,
    count: stats.count,
    last: fmt(stats.last),
    avg: fmt(stats.avg, true),
    min: fmt(stats.min),
    max: fmt(stats.max),
    trend: t(`numberChart.trend.${trend}`),
  });
  return `
    <div class="number-chart-box">
      ${head}
      <div class="number-chart-plot">
        <svg viewBox="0 0 ${w} ${h}" class="number-chart-svg" preserveAspectRatio="none" aria-hidden="true">
          ${goalLine}
          <polyline points="${pointsAttr}" fill="none" style="stroke:var(--moss);stroke-width:1.5" />
          ${dots}
        </svg>
        ${rings ? `<div aria-hidden="true">${rings}</div>` : ''}
        ${hits ? `<div aria-hidden="true">${hits}</div>` : ''}
      </div>
      <p class="visually-hidden">${summary}${noteRings.length ? ' ' + t('numberChart.withNotes', { count: noteRings.length }) : ''}</p>
    </div>
  `;
}

// interactive: Datenpunkte antippbar (→ dieser Tag in "Heute"), nur in Woche/Monat -
// bei Jahr/Gesamt lägen bis zu 365 Punkte auf Handybreite, ~1px pro Tag, nicht mehr
// gezielt treffbar.
export function renderNumberCharts(visibleHabits, dateKeys, interactive = false) {
  const numberHabits = visibleHabits.filter(hasNumericSeries);
  if (!numberHabits.length) return '';
  return `<div class="month-stats">${renderBySection(numberHabits, 'stats', (list) => list.map((h) => renderNumberChart(h, dateKeys, interactive)).join(''))}</div>`;
}

// Rückblick für Text-Felder: pro Feld eine Liste der Antworten im Zeitraum, jeder
// Eintrag öffnet seinen Tag. In allen Ansichten gleich: eingeklappt mit Anzahl im
// Titel, neueste zuerst (in langen Listen ist das Neueste meist das Relevanteste - eine
// je nach Ansicht umgekehrte Reihenfolge war verwirrend). Felder ohne Antwort im
// Zeitraum erscheinen gar nicht.
export function renderTextReviews(habits, dateKeys, labelFor = formatDMY) {
  const renderOne = (h) => {
    const entries = dateKeys
      .map((k) => ({ key: k, text: state.entries[k]?.[h.id] }))
      .filter((e) => typeof e.text === 'string' && e.text.trim());
    if (!entries.length) return '';
    entries.reverse();
    const title = `${esc(h.name)}${h.archivedAt ? ` <span class="manage-meta">(${t('common.archived')})</span>` : ''}`;
    const list = `
      <ul class="text-review-list">
        ${entries.map((e) => `
          <li><button type="button" class="text-review-entry" data-action="open-day" data-date="${e.key}" data-focus-habit="${h.id}">
            <span class="text-review-date">${esc(labelFor(e.key))}</span>
            <span class="text-review-text">${esc(e.text.trim())}</span>
          </button></li>
        `).join('')}
      </ul>
    `;
    const count = t(entries.length === 1 ? 'textReview.countOne' : 'textReview.countMany', { count: entries.length });
    return `<details class="text-review"><summary class="text-review-title">${title} <span class="manage-meta">· ${count}</span></summary>${list}</details>`;
  };
  const withEntries = habits.filter(isTextKind).filter((h) => renderOne(h));
  if (!withEntries.length) return '';
  return `<div class="month-stats">${renderBySection(withEntries, 'stats', (list) => list.map(renderOne).join(''))}</div>`;
}
