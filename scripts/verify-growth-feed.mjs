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

import { DASHES, check, finish, load, migrationChecks, read } from './lib/growthVerify.mjs';

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
check('the ceiling is checked before each call starts', src.includes('withinCeiling(spent, committed, estimate, ceiling)'));
check('groups left out are recorded with the reason', src.includes("why: 'cost_ceiling'") && src.includes("why: 'time_limit'") && src.includes('skipped,'));
check('each call records outcome, searches, URLs, stop reasons and the raw answer', ['outcome: read.outcome', 'searches: ai.webSearchRequests', 'source_urls: ai.sourceUrls.length', 'stop_reasons: ai.stopReasons', 'raw_text: ai.text.slice(0, RAW_TEXT_CHARS)', 'raw_tool_input:'].every((s) => src.includes(s)));
check('the run stores the parse summary, cost and searches', src.includes('parse_summary: parse') && src.includes('cost_usd: spent') && src.includes('searches: searchesRun'));
check('the result line carries the parse summary', src.includes('const message = `${head} ${parse}. ${coverage}`'));

console.log('4. The rules that stay');
check('every call goes through runAi with web search and the result tool', /runAi\(\{ agent: FEED_AGENT[^)]*webSearch[^)]*resultTool: tool/.test(src));
check('evidence: a link the search did not return is still discarded', src.includes("why = 'the evidence link was not returned by the search'") && src.includes('sourceUrls: ai.sourceUrls'));
check('duplicates: in the run and in the inbox', src.includes('dedupeWithinRun(valid)') && src.includes("why: 'already in the inbox'"));
check('the per-run limit still applies', src.includes('if (saved >= max)'));
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
check('no dashes in the touched feed files', !['src/lib/growth/feed.ts', 'src/lib/growth/feedModel.ts', 'src/lib/growth/ai/anthropic.ts', 'src/components/admin/growth/signals/FeedPanel.tsx'].some((f) => DASHES.test(read(f))));

finish('verify-growth-feed');
