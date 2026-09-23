// scripts/verify-growth-keywords.mjs
//
// Proves the signal keyword library (2026-09-23):
//
//   1. Offline: the defaults (groups 1 to 9 on, distress and the wider GCC
//      off, each keyword's trigger from its group), the GCC variants (Saudi
//      only terms left out), keyword matching and the trigger it suggests,
//      in-run deduplication, the feed prompt, the change schema, the retype
//      triage action, and that a paused feed saves nothing (cron skips, a run
//      by hand is a preview). Migration 094's checks.
//   2. Live, read only: the library loads (saved, or the defaults when nothing
//      is saved yet); with the feed paused, a cron run is skipped and writes
//      no feed run.
//   3. Only with --write-test-rows: group and keyword toggles, add, edit and
//      remove, a per-keyword signal count from an is_test signal, and a reset
//      to the defaults. The library as it was is restored afterwards (removed
//      again when nothing was saved before), and every test row is swept.
//
//   npm run verify-growth-keywords
//   npm run verify-growth-keywords -- --write-test-rows

import { sweep } from './lib/growthFixtures.mjs';
import { DASHES, WRITE, check, finish, load, markPending, migrationChecks, read, serviceClient, tableReady } from './lib/growthVerify.mjs';

const lib = await load('src/lib/growth/keywordLibrary.ts');
const feed = await load('src/lib/growth/feed.ts');
const sm = await load('src/lib/growth/signalsModel.ts');
const mock = await load('src/lib/growth/ai/mockSamples.ts');

console.log('1. Defaults, matching and the feed rules (offline)');
const groups = lib.DEFAULT_KEYWORD_GROUPS;
const by = Object.fromEntries(groups.map((g) => [g.key, g]));
const KSA_ON = ['new_project', 'real_estate_off_plan', 'fundraising_debt', 'transactions', 'capital_markets', 'market_entry', 'finance_leadership', 'contract_awards', 'expansion_capex'];
check('eleven groups', groups.length === 11, String(groups.length));
check('groups 1 to 9 are on by default', KSA_ON.every((k) => by[k]?.enabled === true));
check('distress and restructuring is off by default, trigger other', by.distress_restructuring?.enabled === false && by.distress_restructuring.trigger === 'other');
check('the wider GCC group is off by default', by.wider_gcc?.enabled === false && by.wider_gcc.region === 'gcc');
check('the wider GCC group names all eight places', ['UAE', 'Dubai', 'Abu Dhabi', 'Qatar', 'Doha', 'Kuwait', 'Bahrain', 'Oman'].every((p) => by.wider_gcc.label.includes(p)));
const triggers = { new_project: 'new_project', real_estate_off_plan: 'off_plan_registration', fundraising_debt: 'fundraising_debt', transactions: 'acquisition_jv', capital_markets: 'capital_market_activity', market_entry: 'market_entry', finance_leadership: 'finance_leadership_hire', contract_awards: 'contract_award', expansion_capex: 'expansion', distress_restructuring: 'other' };
check('each Saudi group suggests its trigger type', Object.entries(triggers).every(([k, t]) => by[k].trigger === t && by[k].keywords.every((w) => w.trigger === t)));
const counts = { new_project: 22, real_estate_off_plan: 18, fundraising_debt: 19, transactions: 13, capital_markets: 9, market_entry: 10, finance_leadership: 8, contract_awards: 8, expansion_capex: 8, distress_restructuring: 5 };
check('every default keyword is there', Object.entries(counts).every(([k, n]) => by[k].keywords.length === n), Object.keys(counts).map((k) => `${k}=${by[k].keywords.length}`).join(' '));
check('spot check: ROSHN development, Tadawul listing, appoints CFO Saudi Arabia, letter of award Saudi', ['ROSHN development', 'Tadawul listing', 'appoints CFO Saudi Arabia', 'letter of award Saudi'].every((w) => groups.some((g) => g.keywords.some((k) => k.keyword === w))));
check('no keyword repeats within a group', groups.every((g) => new Set(g.keywords.map((k) => k.keyword.toLowerCase())).size === g.keywords.length));
check('every keyword fits the length limit', groups.every((g) => g.keywords.every((k) => k.keyword.length >= 2 && k.keyword.length <= lib.KEYWORD_LIMITS.keyword)));
check('no dashes in any default keyword or label', !groups.some((g) => DASHES.test(g.label) || g.keywords.some((k) => DASHES.test(k.keyword))));

check('GCC variant: Saudi Arabia becomes GCC', lib.gccVariant('IPO Saudi Arabia') === 'IPO GCC');
check('GCC variant: Riyadh becomes GCC', lib.gccVariant('opens Riyadh office') === 'opens GCC office');
check('GCC variant: Saudi only terms are left out', ['NEOM project', 'Tadawul listing', 'Wafi registration', 'MISA licence', 'awarded SAR contract', 'tourism project Red Sea'].every((w) => lib.gccVariant(w) === null));
check('the GCC group has only GCC keywords, none Saudi', by.wider_gcc.keywords.length > 40 && by.wider_gcc.keywords.every((k) => /\bGCC\b/.test(k.keyword) && !/Saudi|Riyadh|Jeddah/.test(k.keyword)));
check('each GCC keyword keeps its source trigger', by.wider_gcc.keywords.find((k) => k.keyword === 'IPO GCC')?.trigger === 'capital_market_activity');

const kw = (id, keyword, trigger, enabled = true) => ({ id, keyword, trigger, enabled });
const sample = [kw('a', 'sukuk issuance Saudi Arabia', 'fundraising_debt'), kw('b', 'appoints CFO Saudi Arabia', 'finance_leadership_hire'), kw('c', 'acquires stake Saudi Arabia', 'acquisition_jv'), kw('d', 'IPO Saudi Arabia', 'capital_market_activity', false)];
check('matching: a sukuk story suggests fundraising and debt', lib.suggestKeyword('Sample Co. completed a SAR 2 billion sukuk issuance', sample)?.trigger === 'fundraising_debt');
check('matching: plurals and tenses still match', lib.suggestKeyword('The group appointed a new CFO; it acquired stakes in two firms', [kw('x', 'acquires stake Saudi Arabia', 'acquisition_jv')])?.id === 'x');
check('matching: a keyword switched off never matches', lib.suggestKeyword('The company announced its IPO', sample) === null);
check('matching: nothing fits, no suggestion', lib.suggestKeyword('A quiet week with no news', sample) === null);
check('matching: the more specific keyword wins', lib.suggestKeyword('new project launch', [kw('p', 'new project Riyadh', 'new_project'), kw('q', 'development launch Saudi Arabia', 'new_project')])?.id === 'p');

const today = '2026-09-23';
const fk = [
  { id: 'k1', keyword: 'sukuk issuance Saudi Arabia', trigger: 'fundraising_debt', region: 'ksa' },
  { id: 'k2', keyword: 'appoints CFO Saudi Arabia', trigger: 'finance_leadership_hire', region: 'ksa' },
];
const cand = (o) => ({ company_name: 'ZZ Co', trigger_type: 'other', signal_date: today, summary: 'ZZ Co did something notable.', evidence_url: 'https://news.test.sa/a', source_name: null, ...o });
const assigned = feed.assignKeywords([cand({ keyword_number: 2 }), cand({ summary: 'ZZ Co priced a sukuk issuance this week', keyword_number: 9 }), cand({ summary: 'ZZ Co opened a cafe' })], fk);
check('the keyword the agent names sets the trigger', assigned[0].matched_keyword === 'appoints CFO Saudi Arabia' && assigned[0].trigger_type === 'finance_leadership_hire' && assigned[0].matched_keyword_id === 'k2');
check('a number out of range falls back to matching the text', assigned[1].matched_keyword_id === 'k1' && assigned[1].trigger_type === 'fundraising_debt');
check('no match keeps the agent trigger and no keyword', assigned[2].matched_keyword === null && assigned[2].trigger_type === 'other');
const d = feed.dedupeWithinRun([cand({}), cand({ company_name: 'Other', evidence_url: 'https://www.news.test.sa/a/?utm_source=x' }), cand({ evidence_url: 'https://news.test.sa/b' }), cand({ company_name: 'Third', evidence_url: 'https://news.test.sa/c' })]);
check('in-run dedupe: same link (after tidying) and same company, trigger and date are kept once', d.unique.length === 2 && d.repeats.length === 2 && d.repeats.every((r) => r.outcome === 'duplicate'));
const p = feed.feedPrompt([...fk, { id: null, keyword: 'IPO GCC', trigger: 'capital_market_activity', region: 'gcc' }], today);
check('the prompt numbers each keyword with its trigger', p.user.includes('1. sukuk issuance Saudi Arabia [fundraising_debt]') && p.user.includes('3. IPO GCC [capital_market_activity]'));
check('the prompt asks for keyword_number and a real link', p.system.includes('keyword_number') && p.system.includes('Never construct, shorten or guess a URL'));
check('the prompt spells out GCC only when a GCC keyword is on', p.system.includes('Abu Dhabi') && !feed.feedPrompt(fk, today).system.includes('Abu Dhabi'));
{
  const raw = mock.JSON_SAMPLES.signal_feed({ messages: [{ role: 'user', content: feed.feedPrompt(fk, today).user }] });
  const s = feed.screenCandidates(raw, { sourceUrls: mock.sampleUrls(raw), mock: true, today: new Date().toISOString().slice(0, 10) });
  const a = feed.dedupeWithinRun(feed.assignKeywords(s.valid, fk));
  check('mock sample: the link-less candidate is discarded', s.discarded.length === 1 && s.discarded[0].why === 'no evidence link');
  check('mock sample: the repeat is caught in the run', a.unique.length === 1 && a.repeats.length === 1);
  check('mock sample: names its keyword by number', a.unique[0].matched_keyword_id === 'k1');
}

const src = read('src/lib/growth/feed.ts');
check('paused: the cron run is skipped', /trigger === 'cron' && paused\) return skip/.test(src));
check('paused: a run by hand saves nothing', /const noSave = ai\.mock \|\| paused;/.test(src) && src.indexOf('if (noSave) {') > 0 && src.indexOf('if (noSave) {') < src.indexOf('await createSignal('));
check('the feed reads the library, falling back to the old list before 094', src.includes('activeKeywords(lib)') && src.includes("lib.source === 'pending'"));
check('the AI call still goes through runAi with web search', /runAi\(\{ agent: FEED_AGENT[^)]*webSearch/.test(src));

const ch = lib.keywordChangeSchema;
check('change schema: toggles, add, edit, remove and reset are accepted', ['group_toggle', 'keyword_toggle', 'keyword_add', 'keyword_edit', 'keyword_remove', 'reset'].every((a) => ch.safeParse({ action: a, group: 'new_project', id: 'd:new_project:0', enabled: true, keyword: 'new hotel Riyadh', trigger: 'new_project' }).success));
check('change schema: an empty or overlong keyword is refused', !ch.safeParse({ action: 'keyword_add', group: 'new_project', keyword: ' ', trigger: 'new_project' }).success && !ch.safeParse({ action: 'keyword_add', group: 'new_project', keyword: 'x'.repeat(121), trigger: 'new_project' }).success);
check('change schema: an unknown trigger is refused', !ch.safeParse({ action: 'keyword_add', group: 'new_project', keyword: 'new hotel', trigger: 'gossip' }).success);
check('triage: retype to a known trigger is accepted, unknown refused', sm.signalTriageSchema.safeParse({ action: 'retype', trigger_type: 'expansion' }).success && !sm.signalTriageSchema.safeParse({ action: 'retype', trigger_type: 'gossip' }).success);
check('the library route is owner only', read('src/app/api/admin/growth/keywords/route.ts').includes('ownerRequest(req'));
check('the Settings screen shows the library, and the old keyword box is gone', read('src/app/admin/growth/settings/engine/page.tsx').includes('<KeywordLibrary') && !read('src/components/admin/growth/settings/EngineForms.tsx').includes('One per line'));
check('the library screen shows a count per keyword and a reset', read('src/components/admin/growth/settings/KeywordLibrary.tsx').includes('data-count={k.count}') && read('src/components/admin/growth/settings/KeywordLibrary.tsx').includes("action: 'reset'"));

const sql = migrationChecks('094_growth_signal_keywords.sql', ['growth_keyword_groups', 'growth_signal_keywords']);
check('094 pauses the feed', /UPDATE growth_settings SET signal_feed_paused = true/.test(sql));
check('094 adds the matched keyword to signals', sql.includes('matched_keyword_id') && sql.includes('ADD COLUMN IF NOT EXISTS matched_keyword TEXT'));

console.log('2. Live, read only');
const svc = serviceClient();
if (!svc) console.log('  SKIP  no SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
else await live(svc);

async function live(svc) {
  const keywords = await load('src/lib/growth/keywords.ts');
  const eng = await load('src/lib/growth/engineSettings.ts');
  const ready = (await tableReady(svc, 'growth_keyword_groups')) && (await tableReady(svc, 'growth_signal_keywords'));
  const library = await keywords.getKeywordLibrary();
  if (!ready) {
    check('before 094 the library shows the defaults, read only', library.source === 'pending' && library.groups.length === 11);
    markPending('library loads from the database, toggles, reset and counts', '094_growth_signal_keywords.sql');
    return;
  }
  check('the library loads', ['database', 'defaults'].includes(library.source) && library.groups.length >= 1, library.error ?? library.source);
  if (library.source === 'defaults') check('nothing saved yet: the defaults load as they are', library.groups.length === 11 && keywords.activeKeywords(library).length === groups.filter((g) => g.enabled).reduce((a, g) => a + g.keywords.length, 0));
  check('every keyword carries a count', library.groups.every((g) => g.keywords.every((k) => Number.isInteger(k.count))));
  const settings = await eng.getEngineSettings();
  if (settings.values.signal_feed_paused) {
    const before = await svc.from('growth_feed_runs').select('id', { count: 'exact' }).limit(1);
    const r = await feed.runSignalFeed({ trigger: 'cron', isTest: true });
    const after = await svc.from('growth_feed_runs').select('id', { count: 'exact' }).limit(1);
    check('paused: the cron run is skipped and writes nothing', r.ok && r.value.status === 'skipped' && before.count === after.count, JSON.stringify(r.ok ? r.value.message : r.error));
  } else console.log('  NOTE  the feed is switched on, so the paused cron check is not run');

  if (!WRITE) {
    console.log('  Write phase skipped (pass --write-test-rows to run it).');
    return;
  }
  await writePhase(svc, keywords);
}

async function writePhase(svc, keywords) {
  console.log('3. Live, test changes (restored afterwards)');
  const actor = { id: null, name: 'ZZ Verify Keywords' };
  const snapG = (await svc.from('growth_keyword_groups').select('*')).data ?? [];
  const snapK = (await svc.from('growth_signal_keywords').select('*')).data ?? [];
  const signalIds = [];
  try {
    const change = (c) => keywords.changeKeywordLibrary(c, actor, { isTest: true });
    const g0 = await change({ action: 'group_toggle', group: 'distress_restructuring', enabled: true });
    let l = await keywords.getKeywordLibrary();
    check('a group toggle saves the defaults first, then switches the group on', g0.ok && l.source === 'database' && l.groups.find((g) => g.key === 'distress_restructuring')?.enabled === true, g0.ok ? '' : g0.error);
    check('the saved library matches the defaults', l.groups.length === 11 && l.groups.reduce((a, g) => a + g.keywords.length, 0) === groups.reduce((a, g) => a + g.keywords.length, 0));
    check('an active group adds its keywords to the feed', keywords.activeKeywords(l).some((k) => k.keyword === 'turnaround Saudi business'));
    await change({ action: 'group_toggle', group: 'new_project', enabled: false });
    l = await keywords.getKeywordLibrary();
    check('a group switched off takes its keywords out of the feed', !keywords.activeKeywords(l).some((k) => k.group === 'new_project'));

    const added = await change({ action: 'keyword_add', group: 'fundraising_debt', keyword: 'ZZ verify green bond', trigger: 'fundraising_debt' });
    l = await keywords.getKeywordLibrary();
    const mine = l.groups.find((g) => g.key === 'fundraising_debt').keywords.find((k) => k.keyword === 'ZZ verify green bond');
    check('Ahmad can add a keyword to any group', added.ok && mine && !mine.isDefault);
    const again = await change({ action: 'keyword_add', group: 'fundraising_debt', keyword: 'zz VERIFY green bond', trigger: 'fundraising_debt' });
    check('the same keyword twice in a group is refused', !again.ok && again.status === 409);
    const edited = await change({ action: 'keyword_edit', id: mine.id, keyword: 'ZZ verify green bonds', trigger: 'expansion' });
    const off = await change({ action: 'keyword_toggle', id: mine.id, enabled: false });
    l = await keywords.getKeywordLibrary();
    const mine2 = l.groups.find((g) => g.key === 'fundraising_debt').keywords.find((k) => k.id === mine.id);
    check('edit and switch off', edited.ok && off.ok && mine2.keyword === 'ZZ verify green bonds' && mine2.trigger === 'expansion' && !mine2.enabled);

    const sigs = await load('src/lib/growth/signals.ts');
    const s = await sigs.createSignal(
      { company_name: 'ZZ Verify Keywords Co', trigger_type: 'expansion', signal_date: new Date().toISOString().slice(0, 10), summary: 'ZZ verification signal for keyword counts.', evidence_url: `https://zz-verify.pacemakersglobal.com/kw-${Date.now()}`, source_name: null, company_id: null },
      null,
      { origin: 'feed', isTest: true, matchedKeyword: { id: mine.id, keyword: 'ZZ verify green bonds' } },
    );
    if (s.ok) signalIds.push(s.value.id);
    check('a feed signal records its keyword', s.ok && s.value.matched_keyword_id === mine.id, s.ok ? '' : s.error);
    const real = await keywords.getKeywordLibrary();
    l = await keywords.getKeywordLibrary({ includeTestSignals: true });
    const countOf = (x) => x.groups.find((g) => g.key === 'fundraising_debt').keywords.find((k) => k.id === mine.id)?.count;
    check('the keyword shows its signal count', countOf(l) === 1);
    check('a test signal is not counted on the real screen', countOf(real) === 0);

    const rm = await change({ action: 'keyword_remove', id: mine.id });
    l = await keywords.getKeywordLibrary();
    check('remove', rm.ok && !l.groups.some((g) => g.keywords.some((k) => k.id === mine.id)));
    const kept = await svc.from('growth_signals').select('matched_keyword_id, matched_keyword').eq('id', s.value.id).single();
    check('a removed keyword leaves its text on the signal', kept.data?.matched_keyword_id === null && kept.data?.matched_keyword === 'ZZ verify green bonds');

    const reset = await change({ action: 'reset' });
    l = await keywords.getKeywordLibrary();
    check('reset restores the defaults', reset.ok && l.source === 'database' && l.groups.every((g) => g.enabled === by[g.key]?.enabled) && l.groups.reduce((a, g) => a + g.keywords.length, 0) === groups.reduce((a, g) => a + g.keywords.length, 0) && l.groups.every((g) => g.keywords.every((k) => k.enabled && k.isDefault)));
  } finally {
    await svc.from('growth_signal_keywords').delete().not('id', 'is', null);
    await svc.from('growth_keyword_groups').delete().not('key', 'is', null);
    if (snapG.length) {
      await svc.from('growth_keyword_groups').insert(snapG);
      if (snapK.length) await svc.from('growth_signal_keywords').insert(snapK);
    }
    await svc.from('growth_activity').delete().eq('is_test', true).eq('action', 'keywords.changed');
    await sweep({ namePrefix: 'ZZ Verify Keywords' });
    for (const id of signalIds) {
      await svc.from('growth_activity').delete().eq('signal_id', id);
      await svc.from('growth_signals').delete().eq('id', id);
    }
    const g = (await svc.from('growth_keyword_groups').select('key')).data ?? [];
    check('the library is back as it was', g.length === snapG.length);
  }
}

finish('verify-growth-keywords');
