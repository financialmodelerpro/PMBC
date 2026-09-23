// scripts/verify-growth-prospecting.mjs
//
// Proves Phase 2, Prospecting (Units 2.1 to 2.6, migration 088):
//
//   1. Offline, always: the Prospect Score rules (weights, bands, the SAR 50
//      million hard rule, unknown size, reasons), signal evidence and duplicate
//      rules, the Research Agent's source check (unsourced facts dropped, emails
//      removed, only site services and approved offers), the mock research and
//      feed samples passing through the real parsers, the feed's evidence and
//      date screening, CSV parsing and the import plan (duplicates, suppression,
//      bad dates), settings validation, the migration's safeguards, and the
//      static gates (admin-only, no dashes, public site untouched).
//   2. Only with --write-test-rows, once 088 is applied: signals, triage,
//      scoring, overrides, a refused research run and a pilot import against
//      the live database with is_test rows only, all removed afterwards.
//      Before 088 these are reported as PENDING.
//
//   npm run verify-growth-prospecting
//   npm run verify-growth-prospecting -- --write-test-rows

import { randomUUID } from 'node:crypto';

import { WRITE, adminOnlyGates, check, dashed, finish, load, markPending, migrationChecks, publicChanges, read, serviceClient, tableReady, walk } from './lib/growthVerify.mjs';

const score = await load('src/lib/growth/scoring/prospect.ts');
const sig = await load('src/lib/growth/signalsModel.ts');
const rm = await load('src/lib/growth/agents/researchModel.ts');
const json = await load('src/lib/growth/agents/json.ts');
const mock = await load('src/lib/growth/ai/mock.ts');
const imp = await load('src/lib/growth/importModel.ts');
const eng = await load('src/lib/growth/engineSettingsModel.ts');
const pricing = await load('src/lib/growth/ai/pricing.ts');
const agents = await load('src/lib/growth/ai/agents.ts');
const feedMod = await load('src/lib/growth/feed.ts');

console.log('1. Prospect Score (offline)');
{
  const now = new Date('2026-09-23T09:00:00Z');
  const w = eng.DEFAULT_SCORING_WEIGHTS;
  check('default weights are 10, 15, 20, 20, 15, 10, 10 and sum to 100', w.geography === 10 && w.sector === 15 && w.project_signal === 20 && w.funding_signal === 20 && w.scale === 15 && w.decision_maker === 10 && w.recency === 10 && Object.values(w).reduce((a, b) => a + b, 0) === 100);
  check('bands at 80, 60 and 40', score.bandFor(80) === 'priority' && score.bandFor(79) === 'good' && score.bandFor(60) === 'good' && score.bandFor(59) === 'watch' && score.bandFor(40) === 'watch' && score.bandFor(39) === 'low');
  const best = score.scoreProspect({
    company: { country: 'Saudi Arabia', city: 'Riyadh', sector: 'Real estate development', scale_sar: 1_200_000_000 },
    leads: [],
    contacts: [{ is_decision_maker: true, role_title: 'CFO' }],
    signals: [{ trigger_type: 'off_plan_registration', signal_date: '2026-09-15', status: 'new' }, { trigger_type: 'fundraising_debt', signal_date: '2026-09-10', status: 'new' }],
    now,
  });
  check('a KSA real estate developer with project and funding signals, a CFO and SAR 1.2 billion scores 100, Priority', best.score === 100 && best.band === 'priority', `${best.score} ${best.band}`);
  check('two or three written reasons', best.reasons.length >= 2 && best.reasons.length <= 3 && best.reasons.every((r) => typeof r === 'string' && r.length > 10));
  const small = score.scoreProspect({ ...{ company: { country: 'Saudi Arabia', city: 'Riyadh', sector: 'Real estate', scale_sar: 30_000_000 } }, leads: [], contacts: [{ is_decision_maker: true, role_title: 'CEO' }], signals: [{ trigger_type: 'new_project', signal_date: '2026-09-20', status: 'new' }, { trigger_type: 'acquisition_jv', signal_date: '2026-09-20', status: 'new' }], now });
  check('a known size under SAR 50 million is Low whatever the score', small.band === 'low' && small.score >= 60 && small.belowMinimum, `${small.score} ${small.band}`);
  check('the Low reason names the minimum', small.reasons[0].includes('SAR 50 million'));
  const leadSmall = score.scoreProspect({ company: { country: 'KSA', city: null, sector: 'Hospitality', scale_sar: null }, leads: [{ deal_size_sar: '20000000' }], contacts: [], signals: [], now });
  check('a lead deal size under the minimum also forces Low', leadSmall.band === 'low' && leadSmall.belowMinimum);
  const unknown = score.scoreProspect({ company: { country: 'Saudi Arabia', city: null, sector: 'Real estate', scale_sar: null }, leads: [], contacts: [], signals: [], now });
  check('unknown size scores zero on scale', unknown.factors.find((f) => f.factor === 'scale').points === 0 && unknown.sizeSar === null);
  check('real estate is the highest sector', score.sectorShare('Real estate developer').share === 1 && score.sectorShare('Industrial manufacturing').share < 1 && score.sectorShare('Retail').share < score.sectorShare('Energy').share);
  check('KSA 1, GCC 0.6, elsewhere 0.2, unknown 0', score.geographyShare('Saudi Arabia') === 1 && score.geographyShare('United Arab Emirates') === 0.6 && score.geographyShare('Pakistan') === 0.2 && score.geographyShare('') === 0);
  const dismissed = score.scoreProspect({ company: { country: 'Saudi Arabia', city: null, sector: null }, leads: [], contacts: [], signals: [{ trigger_type: 'new_project', signal_date: '2026-09-20', status: 'dismissed' }], now });
  check('dismissed signals do not count', dismissed.factors.find((f) => f.factor === 'project_signal').points === 0);
  const stale = score.scoreProspect({ company: { country: 'Saudi Arabia', city: null, sector: null }, leads: [], contacts: [], signals: [{ trigger_type: 'new_project', signal_date: '2024-01-01', status: 'new' }], now });
  check('signals older than a year do not count', stale.factors.find((f) => f.factor === 'project_signal').points === 0 && stale.factors.find((f) => f.factor === 'recency').points === 0);
  const titled = score.scoreProspect({ company: { country: 'Saudi Arabia', city: null, sector: null }, leads: [], contacts: [{ is_decision_maker: false, role_title: 'Group Head of Investments' }], signals: [], now, targeting: { decisionMakerTitles: ['head of investments'], excludedWork: [] } });
  check('approved targeting titles make a contact a decision-maker', titled.factors.find((f) => f.factor === 'decision_maker').share === 1);
  const excluded = score.scoreProspect({ company: { country: 'Saudi Arabia', city: null, sector: 'Audit services', description: 'statutory audit firm' }, leads: [], contacts: [], signals: [], now, targeting: { decisionMakerTitles: [], excludedWork: ['statutory audit'] } });
  check('excluded work is flagged in the reasons', excluded.excludedMatches.includes('statutory audit') && excluded.reasons.some((r) => r.includes('excluded work')));
  const custom = score.scoreProspect({ company: { country: 'Saudi Arabia', city: null, sector: null }, leads: [], contacts: [], signals: [], now, weights: { geography: 100, sector: 0, project_signal: 0, funding_signal: 0, scale: 0, decision_maker: 0, recency: 0 } });
  check('weights from settings are used', custom.score === 100);
  check('weights must sum to 100', !eng.scoringWeightsSchema.safeParse({ ...w, geography: 11 }).success && eng.scoringWeightsSchema.safeParse(w).success && !eng.scoringWeightsSchema.safeParse({ geography: 100 }).success);
}

console.log('2. Signals (offline)');
{
  check('real evidence links pass', sig.isRealEvidenceUrl('https://www.argaam.com/en/article/123') && sig.isRealEvidenceUrl('http://spa.gov.sa/x'));
  check('reserved, local, non-web and bare-IP links fail', ['https://example.invalid/x', 'https://example.com/x', 'http://localhost/x', 'ftp://files.example.org/x', 'not a link', '', 'https://10.0.0.1/x', 'https://intranet/x'].every((u) => !sig.isRealEvidenceUrl(u)));
  check('evidence key drops www, tracking, fragment and trailing slash', sig.evidenceKey('https://WWW.Argaam.com/en/a/1/?utm_source=x&id=2#top') === 'argaam.com/en/a/1?id=2');
  const existing = [
    { id: 'a', created_at: '2026-09-01T00:00:00Z', company_id: null, company_name: 'Al Noor Development Co.', trigger_type: 'new_project', signal_date: '2026-09-01', evidence_key: 'argaam.com/1' },
  ];
  check('same evidence link is a duplicate', sig.findDuplicate({ company_id: null, company_name: 'Other', trigger_type: 'expansion', signal_date: '2026-09-20', evidence_url: 'https://www.argaam.com/1/' }, existing)?.why === 'same_evidence');
  check('same company and trigger within two weeks is a duplicate', sig.findDuplicate({ company_id: null, company_name: 'AL NOOR DEVELOPMENT COMPANY', trigger_type: 'new_project', signal_date: '2026-09-10', evidence_url: 'https://other.sa/2' }, existing)?.why === 'same_company_trigger');
  check('the same company after the window is not', sig.findDuplicate({ company_id: null, company_name: 'Al Noor Development', trigger_type: 'new_project', signal_date: '2026-10-20', evidence_url: 'https://other.sa/3' }, existing) === null);
  check('a signal needs a real evidence link', !sig.signalCreateSchema.safeParse({ trigger_type: 'other', signal_date: '2026-09-01', summary: 'A long enough summary', evidence_url: 'https://example.invalid/x', company_name: 'X' }).success);
  check('a signal needs a company', !sig.signalCreateSchema.safeParse({ trigger_type: 'other', signal_date: '2026-09-01', summary: 'A long enough summary', evidence_url: 'https://argaam.com/x' }).success);
  check('a future date is refused', !sig.signalCreateSchema.safeParse({ trigger_type: 'other', signal_date: '2099-01-01', summary: 'A long enough summary', evidence_url: 'https://argaam.com/x', company_name: 'X' }).success);
  check('a valid signal passes', sig.signalCreateSchema.safeParse({ trigger_type: 'contract_award', signal_date: '2026-09-01', summary: 'Awarded a SAR 300m contract', evidence_url: 'https://argaam.com/x', company_name: 'X' }).success);
  check('dismissing needs a reason', !sig.signalTriageSchema.safeParse({ action: 'dismiss', reason: '' }).success && sig.signalTriageSchema.safeParse({ action: 'dismiss', reason: 'Below minimum size' }).success);
}

console.log('3. Research Agent and signal feed (offline)');
{
  const raw = {
    summary: { value: 'Developer of residential communities.', sources: ['https://argaam.com/a'] },
    sector: { value: 'Real estate', sources: ['https://made-up.sa/not-returned'] },
    city: { value: 'Riyadh', sources: [] },
    projects: [{ name: 'Tower', detail: 'Contact cfo@acme.sa for detail', scale_sar: 500000000, sources: ['https://argaam.com/a'] }, { name: 'Ghost', detail: 'x', scale_sar: 1, sources: ['https://nowhere.sa/x'] }],
    recent_triggers: [{ trigger_type: 'weird', date: '2026-09-01', summary: 'Something', sources: ['https://argaam.com/a'] }],
    decision_makers: [{ name: 'Invented Person', title: 'CFO', sources: [] }],
    likely_service: { value: 'not-a-service', reason: 'x' },
    entry_offer: { value: 'model_health_check', reason: 'y' },
    reasoning: 'Email me at someone@example.org',
    unknowns: [],
  };
  const b = rm.checkBrief(raw, { allowedUrls: ['https://argaam.com/a'], offerKeys: ['feasibility_study'], mock: false });
  check('a sourced fact is kept with its source', b.summary?.sources[0] === 'https://argaam.com/a');
  check('a fact whose source the search did not return is dropped', b.sector === null && b.dropped.some((d) => d.startsWith('Sector')));
  check('a fact with no source is unknown', b.city === null);
  check('an unsourced project and person are dropped', b.projects.length === 1 && b.decision_makers.length === 0 && b.dropped.some((d) => d.includes('Ghost')) && b.dropped.some((d) => d.includes('Invented Person')));
  check('email addresses are removed everywhere', !JSON.stringify(b).includes('@acme.sa') && !JSON.stringify(b).includes('someone@example.org'));
  check('an unknown trigger type becomes other', b.recent_triggers[0].trigger_type === 'other');
  check('only a site service is accepted', b.likely_service.value === null);
  check('only an approved offer is accepted', b.entry_offer.value === null);
  check('reserved links never pass in real mode', rm.checkBrief({ summary: { value: 'x', sources: ['https://example.invalid/a'] } }, { allowedUrls: ['https://example.invalid/a'], offerKeys: [], mock: false }).summary === null);
  const out = await mock.mockProvider.call({ model: 'mock', messages: [{ role: 'user', content: 'Research' }], maxTokens: 8000, purpose: 'prospect_research', agent: 'research-agent' });
  check('mock research is labelled', out.text.startsWith(mock.MOCK_LABEL));
  const mb = rm.checkBrief(json.extractJsonObject(out.text), { allowedUrls: out.sourceUrls, offerKeys: ['feasibility_study'], mock: true });
  check('the mock brief passes the real parser with sources', mb && mb.summary?.sources.length === 1 && mb.projects.length === 1 && mb.likely_service.value === 'refm' && mb.entry_offer.value === 'feasibility_study');
  const feedOut = await mock.mockProvider.call({ model: 'mock', messages: [{ role: 'user', content: 'x' }], maxTokens: 6000, purpose: 'signal_feed', agent: 'signal-feed' });
  const today = new Date(Date.now() + 3 * 3_600_000).toISOString().slice(0, 10);
  const screened = feedMod.screenCandidates(json.extractJsonObject(feedOut.text), { sourceUrls: feedOut.sourceUrls, mock: true, today });
  check('the mock feed keeps the sourced sample and discards the one without a link', screened.valid.length === 1 && screened.discarded.length === 1 && screened.discarded[0].why === 'no evidence link');
  const realScreen = feedMod.screenCandidates(json.extractJsonObject(feedOut.text), { sourceUrls: feedOut.sourceUrls, mock: false, today });
  check('in real mode a reserved evidence link is discarded', realScreen.valid.length === 0);
  const notReturned = feedMod.screenCandidates({ signals: [{ company_name: 'A', trigger_type: 'new_project', signal_date: today, summary: 'A real sounding summary', evidence_url: 'https://argaam.com/z' }] }, { sourceUrls: [], mock: false, today });
  check('a link the search did not return is discarded', notReturned.discarded[0]?.why === 'the evidence link was not returned by the search');
  const old = feedMod.screenCandidates({ signals: [{ company_name: 'A', trigger_type: 'new_project', signal_date: '2020-01-01', summary: 'A real sounding summary', evidence_url: 'https://argaam.com/z' }] }, { sourceUrls: ['https://argaam.com/z'], mock: false, today });
  check('a stale signal is discarded', old.discarded[0]?.why.startsWith('older than'));
  check('JSON is found after a label and inside a fence', json.extractJsonObject('[label]\n```json\n{"a":{"b":"}"}}\n```')?.a?.b === '}');
  check('the default model is Claude Sonnet 5', pricing.DEFAULT_MODEL === 'claude-sonnet-5' && agents.modelForAgent('research-agent', {}) === 'claude-sonnet-5' && agents.modelForAgent('research-agent', { 'research-agent': 'claude-opus-5' }) === 'claude-opus-5');
  check('web searches are priced at USD 0.01 each', pricing.costUsd('claude-sonnet-5', { inputTokens: 0, outputTokens: 0, webSearchRequests: 3 }) === 0.03);
  check('agent model overrides must be priced models', !eng.engineGroupSchemas.agent_models.safeParse({ agent_models: { 'research-agent': 'gpt-5' } }).success);
}

console.log('4. Pilot import (offline)');
{
  const csv = 'Company,Website,Contact,Email,Title,Last outreach,Channel,Deal size\n"Acme, Holding",https://www.acme.sa/x,Sara,SARA@acme.sa,CFO,2026-08-01,email,120m\nBeta Co,beta.sa,,blocked@beta.sa,,01/08/2026,,\nGamma,,Omar,sara@acme.sa,,not a date,,\n,,,,,,,\nDelta,delta.sa,,,,2099-01-01,,abc\n';
  const rows = imp.parseCsv(csv);
  check('CSV: quoted commas and blank rows', rows.length === 5 && rows[1][0] === 'Acme, Holding');
  const mapping = imp.guessMapping(rows[0]);
  check('mapping guessed from headers', mapping.company_name === 0 && mapping.website_domain === 1 && mapping.contact_email === 3 && mapping.last_outreach_date === 5 && mapping.deal_size_sar === 7);
  const lookups = { companiesByDomain: new Map([['beta.sa', { id: 'b1', name: 'Beta Company' }]]), companiesByName: new Map(), contactsByEmail: new Map(), suppressed: new Set(['blocked@beta.sa']) };
  const plan = imp.planImport(rows, mapping, lookups, '2026-09-23');
  check('a clean row imports with its outreach and lead', plan[0].action === 'import' && plan[0].outreach?.date === '2026-08-01' && plan[0].lead?.dealSizeSar === 120_000_000 && plan[0].contact?.email === 'sara@acme.sa' && plan[0].company.domain === 'acme.sa');
  check('an existing company is reused', plan[1].company.existingId === 'b1');
  check('a suppressed email is flagged', plan[1].contact?.suppressed === true && plan[1].warnings.some((w) => w.includes('suppressed')));
  check('DD/MM/YYYY dates are read', plan[1].outreach?.date === '2026-08-01');
  check('a repeated email and a bad date skip the row', plan[2].action === 'skip' && plan[2].problems.some((p) => p.includes('repeats')) && plan[2].problems.some((p) => p.includes('not a date')));
  check('future outreach and bad numbers skip the row', plan[3].action === 'skip' && plan[3].problems.some((p) => p.includes('future')) && plan[3].problems.some((p) => p.includes('Deal size')));
  const sum = imp.summarisePlan(plan);
  check('the summary counts rows, skips and suppressed', sum.rows === 4 && sum.toImport === 2 && sum.skipped === 2 && sum.suppressed === 1);
}

console.log('5. Migration 088 and static gates (offline)');
{
  const sql = migrationChecks('088_growth_prospecting.sql', ['growth_feed_runs', 'growth_imports', 'growth_research_briefs']);
  check('088: a mock brief can never be accepted', sql.includes('CHECK (NOT is_mock OR jsonb_array_length(accepted) = 0)'));
  check('088: the scheduled feed runs once a day', sql.includes("ON growth_feed_runs (run_date, is_test) WHERE trigger = 'cron'"));
  check('088: weights checked to sum to 100', sql.includes('growth_scoring_weights_ok') && sql.includes('= 100'));
  check('088: dismissal needs a reason', sql.includes('growth_signals_dismissal_needs_reason'));
  check('088: override needs a reason', sql.includes('growth_companies_override_needs_reason'));
  adminOnlyGates();
  const cron = read('src/app/api/cron/growth-daily/route.ts');
  check('the Growth cron refuses without CRON_SECRET', cron.includes("if (!secret) return NextResponse.json({ error: 'Not configured' }, { status: 503 })") && cron.includes('Bearer ${secret}'));
  check('vercel.json schedules the Growth cron at 06:00 UTC (09:00 Riyadh)', JSON.parse(read('vercel.json')).crons.some((c) => c.path === '/api/cron/growth-daily' && c.schedule === '0 6 * * *'));
  const files = [...walk('src/lib/growth'), ...walk('src/app/admin/growth'), ...walk('src/app/api/admin/growth'), ...walk('src/components/admin/growth'), 'src/app/api/cron/growth-daily/route.ts', 'scripts/verify-growth-prospecting.mjs', 'scripts/lib/growthVerify.mjs'];
  const d = dashed(files);
  check('no em or en dash in any Growth file', d.length === 0, d.join(', '));
  const pub = publicChanges();
  check('the public site is untouched since Phase 1', pub.length === 0, pub.join(', '));
  check('every Growth AI call goes through runAi', walk('src/lib/growth').filter((f) => /provider\.call\(|selectProvider\(/.test(read(f))).every((f) => f === 'src/lib/growth/ai/run.ts' || f === 'src/lib/growth/ai/provider.ts'));
}

console.log('6. Live database, test rows');
const svc = serviceClient();
if (!svc) console.log('  SKIP  no SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
else if (!(await tableReady(svc, 'growth_feed_runs'))) markPending('live signals, triage, scoring, research refusal and import', '088_growth_prospecting.sql');
else if (!WRITE) console.log('  Write phase skipped (pass --write-test-rows to run it).');
else await live(svc);

async function live(svc) {
  const pros = await load('src/lib/growth/prospects.ts');
  const sigs = await load('src/lib/growth/signals.ts');
  const research = await load('src/lib/growth/agents/research.ts');
  const importer = await load('src/lib/growth/import.ts');
  const tag = `ZZ-GROWTH-P2-${randomUUID().slice(0, 8)}`;
  const actor = { id: 'verify-growth-prospecting', name: 'Prospecting verifier' };
  const started = new Date(Date.now() - 1000).toISOString();

  async function cleanup() {
    const { data: cos } = await svc.from('growth_companies').select('id').eq('is_test', true).like('name', 'ZZ-GROWTH-P2-%');
    const ids = (cos ?? []).map((c) => c.id);
    const { data: cts } = await svc.from('growth_contacts').select('id').eq('is_test', true).like('email', 'zz-growth-p2-%');
    const cids = (cts ?? []).map((c) => c.id);
    const { data: sg } = await svc.from('growth_signals').select('id').eq('is_test', true).like('summary', 'ZZ-GROWTH-P2-%');
    const sids = (sg ?? []).map((s) => s.id);
    await svc.from('growth_activity').delete().eq('is_test', true).gte('created_at', started);
    for (const [col, list] of [['company_id', ids], ['contact_id', cids], ['signal_id', sids]]) if (list.length) await svc.from('growth_activity').delete().eq('is_test', true).in(col, list);
    if (ids.length) {
      await svc.from('growth_research_briefs').delete().eq('is_test', true).in('company_id', ids);
      await svc.from('growth_ai_usage').delete().eq('is_test', true).in('company_id', ids);
    }
    if (sids.length) await svc.from('growth_signals').delete().eq('is_test', true).in('id', sids);
    if (ids.length) {
      await svc.from('growth_signals').delete().eq('is_test', true).in('company_id', ids);
      await svc.from('growth_leads').delete().eq('is_test', true).in('company_id', ids);
      await svc.from('growth_contacts').delete().eq('is_test', true).in('company_id', ids);
      await svc.from('growth_companies').delete().eq('is_test', true).in('id', ids);
    }
    await svc.from('growth_imports').delete().eq('is_test', true).like('filename', 'zz-growth-p2%');
  }
  await cleanup();
  try {
    const co = await pros.createCompany({ name: `${tag} Developer`, website_domain: `https://www.${tag.toLowerCase()}.sa/`, sector: 'Real estate development', city: 'Riyadh', country: 'Saudi Arabia', scale_sar: 800_000_000, source: 'outbound' }, actor, { isTest: true });
    check('company created through the app', co.ok, co.error);
    if (!co.ok) return;
    const dupCo = await pros.createCompany({ name: `${tag} Copy`, website_domain: `${tag.toLowerCase()}.sa` }, actor, { isTest: true });
    check('a company with the same domain is refused as a duplicate', !dupCo.ok && dupCo.status === 409);
    const ct = await pros.createContact(co.value.id, { full_name: `${tag} Person`, role_title: 'Chief Financial Officer', email: `zz-growth-p2-${tag.toLowerCase()}@example.invalid`, is_decision_maker: true }, actor, { isTest: true });
    check('contact created', ct.ok, ct.error);
    const s1 = await sigs.createSignal({ trigger_type: 'off_plan_registration', signal_date: '2026-09-20', summary: `${tag} off-plan registration`, evidence_url: `https://www.argaam.com/zz/${tag}?utm_source=x`, company_id: co.value.id }, actor, { isTest: true });
    check('signal created', s1.ok && s1.value.origin === 'manual' && s1.value.duplicateWhy === null, s1.error);
    const s2 = await sigs.createSignal({ trigger_type: 'fundraising_debt', signal_date: '2026-09-21', summary: `${tag} same article again`, evidence_url: `https://argaam.com/zz/${tag}/`, company_name: 'Anyone' }, actor, { isTest: true });
    check('the same evidence link is flagged as a duplicate, not refused', s2.ok && s2.value.duplicate_of === s1.value.id && s2.value.duplicateWhy === 'same_evidence');
    const dis = await sigs.triageSignal(s2.value.id, { action: 'dismiss', reason: 'Duplicate of the registration' }, actor);
    check('dismiss keeps the reason and who triaged', dis.ok && dis.value.status === 'dismissed' && dis.value.dismissed_reason && dis.value.triaged_by_name === actor.name);
    const { error: noReason } = await svc.from('growth_signals').update({ status: 'dismissed', dismissed_reason: null }).eq('id', s2.value.id).eq('is_test', true);
    check('the database refuses a dismissal without a reason', noReason?.code === '23514');
    const conv = await sigs.triageSignal(s1.value.id, { action: 'convert', company_id: co.value.id, lead_title: `${tag} lead` }, actor);
    check('convert opens a lead and links the signal', conv.ok && conv.value.status === 'converted' && conv.value.lead_id);
    const { data: stored } = await svc.from('growth_companies').select('*').eq('id', co.value.id).single();
    check('the score is stored with band and reasons', typeof stored.prospect_score === 'number' && stored.prospect_band && stored.score_reasons.length >= 2);
    // 10 + 15 + 20 (project) + 0 (funding signal dismissed) + 12.75 (SAR 800m) + 10 + 10 = 78.
    check('the dismissed funding signal does not count: 78, Good', stored.prospect_score === 78 && stored.prospect_band === 'good', `${stored.prospect_score} ${stored.prospect_band}`);
    const small = await pros.updateCompany(co.value.id, { scale_sar: 20_000_000 }, actor);
    const { data: lowRow } = await svc.from('growth_companies').select('prospect_band').eq('id', co.value.id).single();
    check('rescored automatically: under SAR 50 million is Low', small.ok && lowRow.prospect_band === 'low');
    const ov = await pros.setScoreOverride(co.value.id, { action: 'set', score: 85, reason: 'Referred by a partner' }, actor);
    const { data: ovRow } = await svc.from('growth_companies').select('*').eq('id', co.value.id).single();
    check('override keeps its reason and the SAR 50 million rule', ov.ok && ovRow.score_override && ovRow.prospect_score === 85 && ovRow.prospect_band === 'low');
    await pros.updateCompany(co.value.id, { scale_sar: 900_000_000 }, actor);
    const { data: kept } = await svc.from('growth_companies').select('*').eq('id', co.value.id).single();
    check('an override survives rescoring while the computed score moves', kept.prospect_score === 85 && kept.computed_score !== ovRow.computed_score);
    const cleared = await pros.setScoreOverride(co.value.id, { action: 'clear' }, actor);
    const { data: clr } = await svc.from('growth_companies').select('*').eq('id', co.value.id).single();
    check('clearing restores the rules score', cleared.ok && !clr.score_override && clr.prospect_score === clr.computed_score);
    const { error: noOvReason } = await svc.from('growth_companies').update({ score_override: true, override_reason: null }).eq('id', co.value.id).eq('is_test', true);
    check('the database refuses an override without a reason', noOvReason?.code === '23514');
    const res = await research.runResearch(co.value.id, actor, { isTest: true });
    const { count: briefs } = await svc.from('growth_research_briefs').select('id', { count: 'exact', head: true }).eq('company_id', co.value.id);
    check('research refuses without approved knowledge or a budget, and saves no brief', !res.ok && briefs === 0, res.ok ? 'ran' : res.error);
    const csv = `Company,Website,Contact,Email,Last outreach,Channel\n${tag} Imported,${tag.toLowerCase()}-imp.sa,Imp Person,zz-growth-p2-imp-${tag.toLowerCase()}@example.invalid,2026-08-01,LinkedIn\n`;
    const dry = await importer.previewImport(csv, { company_name: 0, website_domain: 1, contact_name: 2, contact_email: 3, last_outreach_date: 4, last_outreach_channel: 5 });
    const { count: before } = await svc.from('growth_companies').select('id', { count: 'exact', head: true }).like('name', `${tag} Imported%`);
    check('a dry run writes nothing', dry.ok && dry.value.summary.toImport === 1 && before === 0);
    const done = await importer.runImport(csv, { company_name: 0, website_domain: 1, contact_name: 2, contact_email: 3, last_outreach_date: 4, last_outreach_channel: 5 }, 'zz-growth-p2.csv', actor, { isTest: true });
    const { data: impCo } = await svc.from('growth_companies').select('id, source, import_id').like('name', `${tag} Imported%`).maybeSingle();
    const { data: hist } = impCo ? await svc.from('growth_activity').select('created_at, action').eq('company_id', impCo.id).eq('action', 'outreach.history') : { data: [] };
    check('the import creates pilot records pointing at the import', done.ok && impCo?.source === 'pilot' && impCo?.import_id === done.value.importId);
    check('past outreach becomes a dated activity', hist?.length === 1 && hist[0].created_at.startsWith('2026-08-01'));
  } finally {
    await cleanup();
    const { count } = await svc.from('growth_companies').select('id', { count: 'exact', head: true }).like('name', 'ZZ-GROWTH-P2-%');
    check('every test row removed', count === 0);
  }
}

finish('verify-growth-prospecting');
