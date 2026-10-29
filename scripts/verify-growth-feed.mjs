// verify-growth-feed.mjs (2026-10-29)
//
// The signal feed fix: how the answer is read, the parse outcomes, the date
// window, coverage by keyword group, the cost ceiling and migration 113.
// Offline and read only: no AI call, no database write.
//
//   1. Reading the answer: the result tool's input wins; text is read past
//      fences, narration and other objects; five outcomes kept apart.
//   2. The window: the prompt and the screen use the same number.
//   3. Coverage and cost: one call per group, rotation, the ceiling.
//   4. The rules that stay: evidence, duplicates, the per-run limit, runAi.
//   5. Settings and migration 113.
//
//   npm run verify-growth-feed

import path from 'node:path';

import { createJiti } from 'jiti';

import { DASHES, check, finish, load, migrationChecks, read, root } from './lib/growthVerify.mjs';

// The Settings form is TSX: load it with JSX on.
const loadTsx = (rel) => createJiti(import.meta.url, { alias: { '@': path.join(root, 'src') }, jsx: { runtime: 'automatic' } }).import(path.join(root, rel));

const fm = await load('src/lib/growth/feedModel.ts');
const feed = await load('src/lib/growth/feed.ts');
const model = await load('src/lib/growth/model.ts');
const esm = await load('src/lib/growth/engineSettingsModel.ts');
const mock = await load('src/lib/growth/ai/mock.ts');

console.log('1. Reading the answer');
const sig = { company_name: 'ZZ Co', trigger_type: 'new_project', signal_date: '2026-10-20', summary: 'ZZ Co announced a project.', evidence_url: 'https://news.test.sa/a', source_name: 'News', keyword_number: 1 };
const r = (a) => fm.readFeedAnswer(a).outcome;
check('tool input with signals: candidates, read from the tool', (() => { const o = r({ toolInput: { signals: [sig, sig] }, text: '' }); return o.kind === 'candidates' && o.count === 2 && o.source === 'tool'; })());
check('tool input with an empty list: nothing found', r({ toolInput: { signals: [] }, text: 'Some narration' }).kind === 'empty_list');
check('tool input without a signals list: no signals key', r({ toolInput: { results: [] }, text: '' }).kind === 'no_signals_key');
check('the tool input wins over JSON in the text', r({ toolInput: { signals: [] }, text: JSON.stringify({ signals: [sig] }) }).kind === 'empty_list');
check('text: narration then fenced JSON is read', (() => { const o = r({ text: `I searched for "sukuk" and the company's news.\n\n\`\`\`json\n${JSON.stringify({ signals: [sig] })}\n\`\`\`\nDone.` }); return o.kind === 'candidates' && o.count === 1 && o.source === 'text'; })());
check('text: an earlier object without signals is passed over for the signals object', r({ text: `Plan: {"step": 1} then ${JSON.stringify({ signals: [sig] })}` }).kind === 'candidates');
check('text: braces inside strings do not break the scan', r({ text: JSON.stringify({ signals: [{ ...sig, summary: 'Odd { text } here' }] }) }).count === 1);
check('text: prose only is no JSON', r({ text: 'I could not find any qualifying events this week.' }).kind === 'no_json');
check('text: empty answer is no JSON, source none', (() => { const o = r({ text: '' }); return o.kind === 'no_json' && o.source === 'none'; })());
check('text: broken JSON is invalid JSON', r({ text: '{"signals": [ {"company_name": "A",, } ]' + '}' }).kind === 'invalid_json');
check('text: JSON without a signals list', r({ text: '{"events": []}' }).kind === 'no_signals_key');
check('text: an empty signals list is nothing found', r({ text: 'Nothing new. {"signals": []}' }).kind === 'empty_list');
{
  const nothing = fm.summarizeOutcomes([{ kind: 'empty_list', count: 0, source: 'tool' }]);
  const unread = fm.summarizeOutcomes([{ kind: 'no_json', count: 0, source: 'text' }]);
  const mixed = fm.summarizeOutcomes([{ kind: 'candidates', count: 3, source: 'tool' }, { kind: 'candidates', count: 2, source: 'tool' }, { kind: 'empty_list', count: 0, source: 'tool' }, { kind: 'invalid_json', count: 0, source: 'text' }]);
  check('summary: nothing found reads differently from could not be read', nothing.includes('found nothing') && !nothing.includes('could not') && unread.includes('could not be read (no JSON in the answer)'), `${nothing} | ${unread}`);
  check('summary: counts candidates, groups and each outcome', mixed === '4 answers read: 5 candidates from 2 groups; 1 found nothing; 1 could not be read (JSON that could not be read)', mixed);
}
{
  const t = fm.feedResultTool();
  const item = t.inputSchema.properties.signals.items;
  check('the result tool is strict-ready: no extra fields, everything required', t.inputSchema.additionalProperties === false && item.additionalProperties === false && Object.keys(item.properties).every((k) => item.required.includes(k)));
  check('the result tool lists exactly the trigger types', JSON.stringify(item.properties.trigger_type.enum) === JSON.stringify(model.TRIGGER_TYPES.map((x) => x.value)));
}
{
  const out = await mock.mockProvider.call({ model: 'mock', messages: [{ role: 'user', content: '1. sukuk issuance Saudi Arabia [fundraising_debt]' }], maxTokens: 8000, purpose: 'signal_feed', agent: 'signal-feed', resultTool: fm.feedResultTool() });
  const read1 = fm.readFeedAnswer({ toolInput: out.toolInput, text: out.text });
  const s = feed.screenCandidates(read1.value, { sourceUrls: out.sourceUrls, mock: true, today: new Date().toISOString().slice(0, 10), maxAgeDays: 30 });
  check('mock: the sample arrives as the tool input', read1.outcome.source === 'tool' && read1.outcome.kind === 'candidates' && out.stopReasons[0] === 'tool_use');
  check('mock: the sample still screens as before (two kept, the link-less one discarded)', s.valid.length === 2 && s.discarded.length === 1 && s.discarded[0].why === 'no evidence link');
}

console.log('2. The date window');
const today = '2026-10-29';
const fk = [{ id: 'k1', keyword: 'sukuk issuance Saudi Arabia', trigger: 'fundraising_debt', region: 'ksa' }];
const p30 = feed.feedPrompt(fk, today, { windowDays: 30, searches: 5, groupLabel: 'Fundraising and debt' });
check('the prompt states the window and its first day', p30.system.includes('last 30 days (on or after 2026-09-29)'), p30.system);
check('the old 7 day window is gone', !p30.system.includes('7 days'));
check('the default window is 30 days', feed.FEED_MAX_AGE_DAYS === 30 && feed.feedPrompt(fk, today).system.includes('last 30 days'));
check('the prompt asks for the report_signals call, not bare JSON', p30.system.includes('call the report_signals tool once') && !p30.system.includes('Answer with one JSON object'));
check('the prompt keeps the evidence rule', p30.system.includes('Never construct, shorten or guess a URL'));
check('the prompt names the group and its search allowance', p30.user.includes('Keyword group: Fundraising and debt.') && p30.system.includes('You have 5 searches'));
{
  const at = (days) => new Date(Date.parse(`${today}T00:00:00Z`) - days * 86_400_000).toISOString().slice(0, 10);
  const c = (d) => ({ ...sig, signal_date: d });
  const s30 = feed.screenCandidates({ signals: [c(at(29)), c(at(31))] }, { sourceUrls: [sig.evidence_url], mock: false, today, maxAgeDays: 30 });
  check('30 days: 29 days old is kept, 31 days old is discarded', s30.valid.length === 1 && s30.discarded[0]?.why === 'older than 30 days');
  const s7 = feed.screenCandidates({ signals: [c(at(10))] }, { sourceUrls: [sig.evidence_url], mock: false, today, maxAgeDays: 7 });
  check('a shorter window is enforced the same way', s7.valid.length === 0 && s7.discarded[0]?.why === 'older than 7 days');
}

console.log('3. Coverage and cost');
check('estimate: USD 0.05 a search', fm.estimateGroupCostUsd(5) === 0.25 && fm.estimateGroupCostUsd(10) === 0.5);
check('ceiling: a call that fits starts, one that does not is left out', fm.withinCeiling(2.5, 0.25, 0.25, 3) && !fm.withinCeiling(2.6, 0.25, 0.25, 3));
{
  const g = ['a', 'b', 'c', 'd'];
  const r1 = fm.rotateGroups(g, '2026-01-01');
  const r2 = fm.rotateGroups(g, '2026-01-02');
  check('rotation: every group runs, the start moves each day', r1.join() === 'a,b,c,d' && r2.join() === 'b,c,d,a' && [...r2].sort().join() === 'a,b,c,d');
}
check('calls run a few at a time inside the time limit', fm.FEED_CONCURRENCY >= 2 && fm.FEED_CONCURRENCY <= 5 && fm.FEED_TIME_BUDGET_MS < 300_000 && fm.FEED_CALL_TIMEOUT_MS < 300_000);
const src = read('src/lib/growth/feed.ts');
check('one call per keyword group, not one for all', src.includes('go.map(async (g) =>') && src.includes('feedPrompt(g.keywords, today,'));
check('each group gets its own search allowance', /webSearch: \{ maxUses: searches \}/.test(src));
check('the ceiling is checked before each call starts', src.includes('withinCeiling(spent, committed, estimate, runCeiling)'));
check('groups left out are recorded with the reason', src.includes("why: 'cost_ceiling'") && src.includes("why: 'time_limit'") && src.includes('skipped,'));
check('each call records outcome, searches, URLs, stop reasons and the raw answer', ['outcome: read.outcome', 'searches: ai.webSearchRequests', 'source_urls: ai.sourceUrls.length', 'stop_reasons: ai.stopReasons', 'raw_text: ai.text.slice(0, RAW_TEXT_CHARS)', 'raw_tool_input:'].every((s) => src.includes(s)));
check('the run stores the parse summary, cost and searches', src.includes('parse_summary: parse') && src.includes('cost_usd: spent') && src.includes('searches: searchesRun'));
check('the result line carries the parse summary', src.includes('const message = `${head} Not kept: ${dropped}. ${parse}. ${coverage}`'));

console.log('4. The rules that stay');
check('every call goes through runAi with web search and the result tool', /runAi\(\{ agent: FEED_AGENT[^)]*webSearch[^)]*resultTool: tool/.test(src));
check('evidence: a link the search did not return is still discarded', src.includes("why = 'the evidence link was not returned by the search'") && src.includes('sourceUrls: ai.sourceUrls'));
check('duplicates: in the run and in the inbox', src.includes('dedupeWithinRun(valid)') && src.includes("why: 'already in the inbox'"));
check('the per-run limit still applies, after ranking', src.includes('const plan = planKeeps(ranked, max);') && src.includes('for (const r of plan.keep)'));
check('paused or mock: nothing is saved', /const noSave = mock \|\| paused;/.test(src) && src.indexOf('if (noSave) {') < src.indexOf('await createSignal('));
const anth = read('src/lib/growth/ai/anthropic.ts');
check('provider: the result tool is strict, tool choice auto, never forced', anth.includes('strict: true') && anth.includes("tool_choice: { type: 'auto' as const }") && !/type: '(any|tool)'/.test(anth));
check('provider: asks once for the tool call when the model stops without it', anth.includes('if (result && !reminded && response.stop_reason === \'end_turn\')'));
check('provider: records every stop reason', anth.includes('stopReasons.push(String(response.stop_reason))'));
const panel = read('src/components/admin/growth/signals/FeedPanel.tsx');
check('the Signals screen shows how each run read its answers', panel.includes('d.parse_summary') && panel.includes('runDetail(r)'));

console.log('5. Settings and migration 113');
const cols = esm.ENGINE_SETTING_COLUMNS;
check('three settings, all from 113, defaults 30 days, 5 searches, USD 3.00', cols.signal_feed_window_days.default === 30 && cols.signal_feed_searches_per_group.default === 5 && cols.signal_feed_max_cost_usd.default === 3 && ['signal_feed_window_days', 'signal_feed_searches_per_group', 'signal_feed_max_cost_usd'].every((k) => cols[k].migration === '113_growth_feed_coverage.sql'));
check('the feed runs on the defaults before 113 (not in its required list)', !/pendingMigration\(engine, \[[^\]]*signal_feed_window_days/.test(src));
const g = esm.engineGroupSchemas.signal_feed_coverage;
const ok = (v) => g.safeParse({ signal_feed_window_days: 30, signal_feed_searches_per_group: 5, signal_feed_max_cost_usd: 3, ...v }).success;
check('form: the defaults save', ok({}));
check('form: window 1 to 90 days', ok({ signal_feed_window_days: 1 }) && ok({ signal_feed_window_days: 90 }) && !ok({ signal_feed_window_days: 0 }) && !ok({ signal_feed_window_days: 91 }));
check('form: 1 to 10 searches a group', ok({ signal_feed_searches_per_group: 10 }) && !ok({ signal_feed_searches_per_group: 0 }) && !ok({ signal_feed_searches_per_group: 11 }));
check('form: ceiling above 0 and at most USD 50', ok({ signal_feed_max_cost_usd: 0.5 }) && !ok({ signal_feed_max_cost_usd: 0 }) && !ok({ signal_feed_max_cost_usd: 51 }));
check('the Settings screen shows the reach and cost form', read('src/app/admin/growth/settings/engine/page.tsx').includes('<FeedCoverageForm'));
const sql = migrationChecks('113_growth_feed_coverage.sql', []);
check('113: three columns with the same defaults', sql.includes('signal_feed_window_days INTEGER NOT NULL DEFAULT 30') && sql.includes('signal_feed_searches_per_group INTEGER NOT NULL DEFAULT 5') && sql.includes('signal_feed_max_cost_usd NUMERIC(6, 2) NOT NULL DEFAULT 3.00'));
check('113: the database checks the same limits', sql.includes('BETWEEN 1 AND 90') && sql.includes('BETWEEN 1 AND 10') && sql.includes('signal_feed_max_cost_usd > 0 AND signal_feed_max_cost_usd <= 50'));
check('no dashes in the touched feed files', !['src/lib/growth/feed.ts', 'src/lib/growth/feedModel.ts', 'src/lib/growth/ai/anthropic.ts', 'src/components/admin/growth/signals/FeedPanel.tsx', 'src/components/admin/growth/settings/EngineForms.tsx', 'supabase/migrations/114_growth_feed_days.sql'].some((f) => DASHES.test(read(f))));

console.log('6. Cadence, projection and the budget (2026-10-29, migration 114)');
// 2026-11-01 is a Sunday, 2026-11-02 a Monday, 2026-11-03 a Tuesday, 2026-11-05 a Thursday; 06:00 UTC is 09:00 Riyadh.
const at9 = (d) => new Date(`${d}T06:00:00Z`);
const SUN_TUE_THU = [0, 2, 4];
check('default days: Sunday, Tuesday and Thursday', JSON.stringify(cols.signal_feed_days.default) === '[0,2,4]' && cols.signal_feed_days.migration === '114_growth_feed_days.sql');
check('Riyadh weekday: late Saturday UTC is already Sunday in Riyadh', fm.riyadhWeekday(new Date('2026-10-31T22:00:00Z')) === 0);
check('feed days: Sunday, Tuesday and Thursday run', ['2026-11-01', '2026-11-03', '2026-11-05'].every((d) => fm.isFeedDay(SUN_TUE_THU, at9(d))));
check('feed days: Monday, Wednesday, Friday and Saturday do not', ['2026-11-02', '2026-11-04', '2026-11-06', '2026-11-07'].every((d) => !fm.isFeedDay(SUN_TUE_THU, at9(d))));
check('morning job: skipped on a Monday with Sunday, Tuesday and Thursday ticked', fm.morningDaySkip('cron', SUN_TUE_THU, at9('2026-11-02'))?.startsWith('Not a feed day') === true);
check('morning job: runs on a ticked day', fm.morningDaySkip('cron', SUN_TUE_THU, at9('2026-11-03')) === null && fm.morningDaySkip('cron', [1], at9('2026-11-02')) === null);
check('a run by hand works on any day, ticked or not', ['2026-11-01', '2026-11-02', '2026-11-04', '2026-11-06', '2026-11-07'].every((d) => fm.morningDaySkip('manual', SUN_TUE_THU, at9(d)) === null));
check('the feed applies the gate with its trigger and the stored days', src.includes('const notToday = morningDaySkip(opts.trigger, days, opts.now);') && src.includes('if (notToday) return skip(notToday);'));
check('the gate comes before the run is recorded or any AI call', src.indexOf('morningDaySkip(opts.trigger') < src.indexOf(".from('growth_feed_runs')\n    .insert(") && src.indexOf('morningDaySkip(opts.trigger') < src.indexOf('await runAi('));
{
  const days = esm.feedDaysSchema;
  check('days form: sorted and unique, at least one, 0 to 6', JSON.stringify(days.parse([4, 0, 2, 2])) === '[0,2,4]' && !days.safeParse([]).success && !days.safeParse([7]).success);
  check('days form: saved with the reach and cost group once 114 is in', esm.engineGroupSchemas.signal_feed_coverage.safeParse({ signal_feed_window_days: 30, signal_feed_searches_per_group: 5, signal_feed_max_cost_usd: 3, signal_feed_days: [1, 3] }).success);
  check('stored days are read as numbers, a bad value falls back to the default', JSON.stringify(esm.readEngineValue('signal_feed_days', [2, 4])) === '[2,4]' && JSON.stringify(esm.readEngineValue('signal_feed_days', ['x'])) === '[0,2,4]');
}
check('projection: USD 2.25 a run on three days is USD 29.25 a month', fm.projectMonthlyUsd(2.25, SUN_TUE_THU) === 29.25);
check('projection: every day at USD 2.25 is USD 68.25 a month', fm.projectMonthlyUsd(2.25, [0, 1, 2, 3, 4, 5, 6]) === 68.25);
{
  const m = fm.costBasis([2.1, 2.3], 9, 5);
  const e = fm.costBasis([], 9, 5);
  check('cost basis: the average of measured runs', m.basis === 'measured' && m.perRunUsd === 2.2 && m.runs === 2);
  check('cost basis: before any run, the estimate for every group', e.basis === 'estimate' && e.perRunUsd === 2.25);
}
check('the projection reads measured runs of this design only', src.includes("Array.isArray(r.detail?.calls) && typeof r.detail?.cost_usd === 'number'") && src.includes(".eq('mode', 'real')") && src.includes(".eq('status', 'completed')"));
check('warning: more than half the budget warns, half or less does not, no budget never', fm.overHalfBudget(40.01, 80) && !fm.overHalfBudget(40, 80) && !fm.overHalfBudget(100, null));
{
  const { renderToStaticMarkup } = await import('react-dom/server');
  const React = await import('react');
  const forms = await loadTsx('src/components/admin/growth/settings/EngineForms.tsx');
  const html = (perRunUsd, days, budgetUsd) => renderToStaticMarkup(React.createElement(forms.FeedCostProjection, { days, basis: { perRunUsd, basis: 'measured', runs: 3 }, budgetUsd }));
  const over = html(3.5, SUN_TUE_THU, 80);
  const under = html(2.25, SUN_TUE_THU, 80);
  const daily = html(2.25, [0, 1, 2, 3, 4, 5, 6], 80);
  check('form: three days at USD 3.50 (USD 45.50) shows the half-budget warning', over.includes('data-feed-warning="over-half"') && over.includes('data-feed-projection="45.50"'), over.slice(0, 200));
  check('form: three days at USD 2.25 (USD 29.25) shows no warning', !under.includes('data-feed-warning') && under.includes('data-feed-projection="29.25"'));
  check('form: ticking every day moves the projection and brings the warning', daily.includes('data-feed-projection="68.25"') && daily.includes('data-feed-warning'));
  check('form: the projection says it is measured', under.includes('the average of the last 3 runs'));
}
check('budget: a run that fits what is left goes ahead, one that does not is skipped', fm.budgetAllowsRun(77, 2.25, 80) && !fm.budgetAllowsRun(78, 2.25, 80) && !fm.budgetAllowsRun(0, 1, null));
check('budget: the skip is recorded as refused with the reason, and logged', src.includes("await finish({ status: 'refused', detail: { reason: 'budget', message,") && src.includes("action: 'feed.skipped'"));
check('budget: the check runs before any AI call', src.indexOf('budgetAllowsRun(spend.spentUsd, expected, budget)') < src.indexOf('await runAi('));
check('budget: a run that goes ahead is held to what is left', src.includes('runCeiling = Math.min(ceiling, round2(budget - spend.spentUsd))') && src.includes('withinCeiling(spent, committed, estimate, runCeiling)'));
check('Signals: shows the last run cost, or why it was skipped', panel.includes('lastRunLine(runs[0])') && read('src/components/admin/growth/signals/FeedPanel.tsx').includes("d.reason === 'budget'") && src.includes('cost_usd: own(r) ??'));
const sql114 = migrationChecks('114_growth_feed_days.sql', []);
check('114: the column, its default and the same checks as send_days', sql114.includes("signal_feed_days INTEGER[] NOT NULL DEFAULT '{0,2,4}'") && sql114.includes('cardinality(signal_feed_days) BETWEEN 1 AND 7') && sql114.includes('growth_is_increasing(signal_feed_days)'));

console.log('7. Ranking before the limit (2026-10-29, migration 115)');
const rk = await load('src/lib/growth/feedRank.ts');
{
  // The shape of the 2026-10-29 run: the weak ten it kept, and the strong ones the limit cut.
  const T = '2026-10-29';
  const c = (company_name, o) => ({ company_name, trigger_type: 'new_project', signal_date: '2026-10-20', summary: `${company_name} news.`, location: 'Riyadh, Saudi Arabia', company_sector: '', size_sar: 0, prospect_fit: 'prospect', fit_reason: '', ...o });
  const pool = [
    c('Saudi Capital Market Authority (CMA)', { trigger_type: 'capital_market_activity', company_sector: 'regulator' }),
    c('Tadawul / Saudi Capital Market Authority', { trigger_type: 'capital_market_activity' }),
    c('Saudi IPO market', { trigger_type: 'capital_market_activity' }),
    c('Ministry of Investment', { prospect_fit: 'not_a_prospect', fit_reason: 'a government body acting as regulator' }),
    c('SriLankan Airlines', { trigger_type: 'market_entry', company_sector: 'airline', prospect_fit: 'unlikely_buyer', fit_reason: 'a foreign airline opening an office' }),
    c('Siemens / Alstom', { trigger_type: 'contract_award', company_sector: 'rolling stock supplier', size_sar: 5_500_000_000, prospect_fit: 'unlikely_buyer', fit_reason: 'global equipment suppliers winning work' }),
    c('Arada', { company_sector: 'real estate developer', size_sar: 14_250_000_000 }),
    c('Sample Master Developer', { company_sector: 'master plan developer', size_sar: 14_000_000_000 }),
    c('ROSHN', { company_sector: 'government-linked real estate developer' }),
    c('Diriyah Company', { company_sector: 'giga-project developer', size_sar: 0 }),
    c('Sample Logistics Fund', { trigger_type: 'fundraising_debt', company_sector: 'logistics fund', size_sar: 500_000_000 }),
    c('Small Sample Co', { company_sector: 'real estate developer', size_sar: 20_000_000 }),
  ];
  const kept = pool.filter((x) => !rk.notAProspectReason(x));
  const dropped = pool.filter((x) => rk.notAProspectReason(x)).map((x) => x.company_name);
  check('not a prospect: regulators, exchanges, commentary and a regulator body are dropped before ranking', dropped.length === 4 && ['Saudi Capital Market Authority (CMA)', 'Tadawul / Saudi Capital Market Authority', 'Saudi IPO market', 'Ministry of Investment'].every((n) => dropped.includes(n)), dropped.join(', '));
  check('government-linked developers and giga-project owners stay in', ['ROSHN', 'Diriyah Company', 'Royal Commission for AlUla', 'NEOM'].every((n) => rk.notAProspectReason(c(n, {})) === null));
  check('a regulator stays out even when the model calls it a prospect', rk.notAProspectReason(c('Capital Market Authority', { prospect_fit: 'prospect' })) !== null);
  // Reversed, so the weak candidates come first and only the score can lift the strong ones.
  const ranked = rk.rankCandidates([...kept].reverse(), { today: T, weights: esm.DEFAULT_SCORING_WEIGHTS, sectorTiers: esm.DEFAULT_SECTOR_TIERS });
  const order = ranked.map((r) => r.candidate.company_name);
  const plan = rk.planKeeps(ranked, 4);
  const keptNames = plan.keep.map((r) => r.candidate.company_name);
  check('with four kept, the four real estate projects are kept', ['Arada', 'Sample Master Developer', 'ROSHN', 'Diriyah Company'].every((n) => keptNames.includes(n)), order.join(' > '));
  check('sized real estate outranks unsized real estate', order.indexOf('Arada') < order.indexOf('ROSHN') && order.indexOf('Sample Master Developer') < order.indexOf('Diriyah Company'), order.join(' > '));
  check('the logistics fund is cut only by the limit (over limit, not below rank)', plan.overLimit.map((r) => r.candidate.company_name).join() === 'Sample Logistics Fund', plan.overLimit.map((r) => r.candidate.company_name).join());
  check('global suppliers and an airline office rank last, below every prospect', order.slice(-3).every((n) => ['SriLankan Airlines', 'Siemens / Alstom', 'Small Sample Co'].includes(n)) && plan.belowRank.length === 3, order.join(' > '));
  check('a known size under SAR 50 million ranks last too', ranked.find((r) => r.candidate.company_name === 'Small Sample Co').tier === 1);
  check('a big contract does not lift an unlikely buyer above a prospect', order.indexOf('Siemens / Alstom') > order.indexOf('Sample Logistics Fund'));
  check('ranks run 1 to n with scores 0 to 100', ranked.every((r, i) => r.rank === i + 1 && r.score >= 0 && r.score <= 100));
  const top = plan.keep[0];
  const reason = rk.keptReason(top, ranked.length);
  check('the kept reason names the rank, the score and why', reason.startsWith(`Kept: rank 1 of ${ranked.length}; score ${top.score}`) && /real estate sector/.test(reason) && /size about SAR 14/.test(reason), reason);
  check('a ranked-last reason says why', ranked.find((r) => r.candidate.company_name === 'Siemens / Alstom').basis.includes('ranked last: global equipment suppliers winning work'));
  check('real estate scores above infrastructure for the same event', rk.rankCandidates([c('Infra Co', { company_sector: 'power utility', size_sar: 1e9 }), c('Dev Co', { company_sector: 'real estate developer', size_sar: 1e9 })], { today: T })[0].candidate.company_name === 'Dev Co');
  check('the ranking reads the Settings weights and tiers', src.includes('rankCandidates(prospects, { today, weights: engine.values.scoring_weights, sectorTiers: engine.values.sector_tiers })'));
}
{
  const t = fm.feedResultTool().inputSchema.properties.signals.items;
  check('the result tool asks for location, sector, size and fit', ['location', 'company_sector', 'size_sar', 'prospect_fit', 'fit_reason'].every((k) => t.required.includes(k)) && JSON.stringify(t.properties.prospect_fit.enum) === '["prospect","unlikely_buyer","not_a_prospect"]');
  check('the prompt states the fit rules, judged on need not size', p30.system.includes('Judge on that, not on size alone') && p30.system.includes('government-linked developers and giga-project owners') && p30.system.includes('unlikely_buyer: global contractors'));
  const s = feed.screenCandidates({ signals: [{ ...sig, location: 'Riyadh', company_sector: 'developer', size_sar: 1e9, prospect_fit: 'unlikely_buyer', fit_reason: 'x' }, { ...sig, evidence_url: 'https://news.test.sa/b', prospect_fit: 'nonsense', size_sar: 'big' }] }, { sourceUrls: [sig.evidence_url, 'https://news.test.sa/b'], mock: false, today: '2026-10-29' });
  check('screen: the new fields are read, and nonsense becomes unknown', s.valid[0].prospect_fit === 'unlikely_buyer' && s.valid[0].size_sar === 1e9 && s.valid[1].prospect_fit === null && s.valid[1].size_sar === null);
}
check('order: not a prospect, then inbox duplicates, then ranking, then the limit', src.indexOf('notAProspectReason(c)') < src.indexOf('await existingDuplicate(') && src.indexOf('await existingDuplicate(') < src.indexOf('rankCandidates(prospects') && src.indexOf('rankCandidates(prospects') < src.indexOf('planKeeps(ranked, max)'));
check('each kept signal stores its rank, score and reason', src.includes('feedRank: { rank: r.rank, score: r.score, reason }') && read('src/lib/growth/signals.ts').includes('row.feed_reason = opts.feedRank.reason'));
check('before 115 the insert drops only the rank columns first', read('src/lib/growth/signals.ts').includes("insertTolerant<InboxSignal>('growth_signals', row, SIGNAL_115_COLUMNS)"));
check('the run counts not a prospect, below rank and over limit separately', src.includes('const counts = { not_a_prospect: notProspect, below_rank: plan.belowRank.length, over_limit: plan.overLimit.length };') && src.includes('counts, decisions'));
check('the Signals screen shows rank and reason, and the three counts', panel.includes('data-rank={d.rank}') && read('src/components/admin/growth/signals/FeedPanel.tsx').includes('below rank') && read('src/app/admin/growth/signals/page.tsx').includes('data-feed-rank={s.feed_rank}'));
check('kept per run defaults to 20 and stays a setting', cols.signal_feed_max_per_run.default === 20 && esm.engineGroupSchemas.signal_feed.safeParse({ signal_feed_paused: false, signal_feed_max_per_run: 20 }).success);
const sql115 = migrationChecks('115_growth_feed_ranking.sql', []);
check('115: rank, score and reason on signals, with checks', sql115.includes('ADD COLUMN IF NOT EXISTS feed_rank INTEGER') && sql115.includes('feed_score BETWEEN 0 AND 100') && sql115.includes('ADD COLUMN IF NOT EXISTS feed_reason TEXT'));
check('115: the limit moves from 10 to 20 only where it is still 10', sql115.includes('SET DEFAULT 20') && sql115.includes('WHERE id = 1 AND signal_feed_max_per_run = 10'));
check('no dashes in the ranking files', !['src/lib/growth/feedRank.ts', 'supabase/migrations/115_growth_feed_ranking.sql', 'src/app/admin/growth/signals/page.tsx'].some((f) => DASHES.test(read(f))));

finish('verify-growth-feed');
