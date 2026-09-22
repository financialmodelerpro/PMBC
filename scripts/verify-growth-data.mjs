// scripts/verify-growth-data.mjs
//
// Proves the Growth Engine data layer (Unit 1.2, migration 083):
//
//   1. Offline, always: every value list in src/lib/growth/model.ts matches the
//      CHECK list in the migration, the minimum deal size matches the generated
//      column, the normalisers and the below-minimum rule behave, and the Growth
//      section is admin-only in all three places (the shared prefix list, the
//      sidebar item, the page gate).
//   2. Read only: which Growth tables exist (the same check Growth Home shows).
//   3. Only with --write-test-rows, and only once every table exists: creates a
//      company, contact, signal (first without its company, then attached),
//      leads above and below the minimum, and activity; reads them back linked;
//      proves the de-duplication, evidence, override and append-only rules;
//      proves the public anon key can neither read nor write any Growth table;
//      then deletes everything it created.
//
// The database is production (previews and local runs share it). Every row the
// write phase creates has is_test = true and a name or email starting with the
// marker below, and every delete it sends is filtered on is_test = true, so no
// real record can be touched. Rows left by a crashed run are found by the same
// marker and removed first. Approved by Ahmad for Unit 1.2 on 2026-09-22.
//
//   npm run verify-growth-data                      (offline and read only)
//   npm run verify-growth-data -- --write-test-rows (full, writes test rows)
//
// Reads SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL and
// NEXT_PUBLIC_SUPABASE_ANON_KEY from the environment or .env.local. Never
// prints any of them.

import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { createJiti } from 'jiti';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WRITE = process.argv.includes('--write-test-rows');
const MARKER = 'ZZ Growth Verify';

for (const line of fs.existsSync(path.join(root, '.env.local')) ? fs.readFileSync(path.join(root, '.env.local'), 'utf8').split(/\r?\n/) : []) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
}

const jiti = createJiti(import.meta.url, { alias: { '@': path.join(root, 'src') } });
const model = await jiti.import(path.join(root, 'src/lib/growth/model.ts'));
const access = await jiti.import(path.join(root, 'src/lib/auth/adminAccess.ts'));

let checks = 0, failures = 0;
function check(label, ok, detail = '') {
  checks++;
  if (ok) return;
  failures++;
  console.log(`  FAIL  ${label}${detail ? `: ${detail}` : ''}`);
}
const same = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());

console.log('1. Model matches the migration, rules and access');
const sql = fs.readFileSync(path.join(root, 'supabase/migrations/083_growth_core.sql'), 'utf8');
const sql086 = fs.readFileSync(path.join(root, 'supabase/migrations/086_growth_nine_services.sql'), 'utf8');
function checkList(column, source = sql) {
  const lists = [...source.matchAll(new RegExp(`CHECK \\(${column} IN \\(([^)]*)\\)`, 'g'))].map((m) => [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]));
  return lists;
}
const values = (list) => list.map((x) => (typeof x === 'string' ? x : x.value));
// The service columns were redefined by 086 (the site's nine services); the rest are as 083 made them.
for (const [column, list, count, source] of [
  ['likely_service', model.GROWTH_SERVICES, 1, sql086],
  ['recommended_service', model.GROWTH_SERVICES, 1, sql086],
  ['stage', model.PIPELINE_STAGES, 1],
  ['prospect_band', model.PROSPECT_BANDS, 1],
  ['lead_temperature', model.LEAD_TEMPERATURES, 1],
  ['trigger_type', model.TRIGGER_TYPES, 1],
  ['source', model.LEAD_SOURCES, 1],
  ['consent_status', model.CONSENT_STATUSES, 1],
  ['actor_type', model.ACTOR_TYPES, 1],
]) {
  const lists = checkList(column, source);
  check(`${column}: one CHECK list in the migration`, lists.length === count, String(lists.length));
  check(`${column}: model.ts matches the migration`, lists[0] && same(lists[0], values(list)), `${lists[0]} vs ${values(list)}`);
}
{
  // `status` appears on companies and signals; tell them apart by their values.
  const statusLists = checkList('status');
  check('status: two CHECK lists (companies, signals)', statusLists.length === 2, String(statusLists.length));
  check('company statuses match', statusLists.some((l) => same(l, values(model.COMPANY_STATUSES))));
  check('signal statuses match', statusLists.some((l) => same(l, values(model.SIGNAL_STATUSES))));
}
{
  const { SERVICES } = await jiti.import(path.join(root, 'src/config/services.ts'));
  check('Growth services are the nine site services, same slugs, names and order', model.GROWTH_SERVICES.length === 9 && JSON.stringify(model.GROWTH_SERVICES.map((g) => [g.value, g.label, g.href])) === JSON.stringify(SERVICES.map((x) => [x.slug, x.title, `/services/${x.slug}`])));
  check('priority default: the five outreach services, all site services', JSON.stringify([...model.DEFAULT_PRIORITY_SERVICES].sort()) === JSON.stringify(['business-valuation', 'financial-due-diligence', 'financial-modeling', 'mergers-acquisitions', 'refm']) && model.DEFAULT_PRIORITY_SERVICES.every(model.isGrowthService));
  check('the old six-service values are gone from the model', !['financial_modeling', 'ma_modeling', 'real_estate_modeling', 'feasibility_study'].some(model.isGrowthService));
}
check('ten pipeline stages in the order given', values(model.PIPELINE_STAGES).join() === 'prospect,contacted,replied,qualified,meeting_booked,opportunity,proposal,won,lost,nurture');
check('minimum deal size is SAR 50 million in both places', model.MINIMUM_DEAL_SIZE_SAR === 50_000_000 && sql.includes('deal_size_sar < 50000000'));
check('default company country is Saudi Arabia in both places', model.DEFAULT_COMPANY_COUNTRY === 'Saudi Arabia' && sql.includes("country TEXT NOT NULL DEFAULT 'Saudi Arabia'"));
check('below minimum: under 50m yes, 50m and over no, unknown no', model.isBelowMinimum(49_999_999) && !model.isBelowMinimum(50_000_000) && !model.isBelowMinimum(null) && !model.isBelowMinimum(undefined));
check('normaliseDomain strips scheme, www, path, port and case', model.normaliseDomain(' HTTPS://www.Example.com.sa/about?x=1 ') === 'example.com.sa' && model.normaliseDomain('sub.example.com:8080/') === 'sub.example.com' && model.normaliseDomain('') === null);
check('normaliseEmail trims and lower-cases', model.normaliseEmail('  Jane@Acme.COM ') === 'jane@acme.com' && model.normaliseEmail('   ') === null);
check('no em or en dash in the migration or the model', !/[\u2013\u2014]/.test(sql + fs.readFileSync(path.join(root, 'src/lib/growth/model.ts'), 'utf8')));
check('RLS on for all five tables', ['growth_companies', 'growth_contacts', 'growth_leads', 'growth_signals', 'growth_activity'].every((t) => sql.includes(`ALTER TABLE ${t} ENABLE ROW LEVEL SECURITY;`)));
check('anon and authenticated privileges revoked', /REVOKE ALL ON TABLE growth_companies, growth_contacts, growth_leads, growth_signals, growth_activity FROM anon, authenticated;/.test(sql));
check('/admin/growth and its pages are admin-only', access.isAdminOnlyPath('/admin/growth') && access.isAdminOnlyPath('/admin/growth/settings') && !access.isAdminOnlyPath('/admin/growthx'));
check('an editor may not open Growth, an admin may', !access.roleMayOpen('editor', '/admin/growth/pipeline') && access.roleMayOpen('admin', '/admin/growth/pipeline'));
check('other admin-only paths unchanged', ['/admin/settings', '/admin/header-settings', '/admin/footer-links', '/admin/users', '/admin/audit'].every((p) => access.isAdminOnlyPath(p)) && access.roleMayOpen('editor', '/admin/tool-leads'));
{
  const nav = fs.readFileSync(path.join(root, 'src/components/admin/CmsAdminNav.tsx'), 'utf8');
  check('sidebar Growth item is admin-only', /label: 'Growth', href: '\/admin\/growth', icon: TrendingUp, role: 'admin'/.test(nav));
  const gate = fs.readFileSync(path.join(root, 'src/lib/growth/access.ts'), 'utf8');
  check('page gate sends an editor away', /session\.user\.role !== 'admin'\) redirect\('\/admin\?denied=1'\)/.test(gate));
  const pages = fs.readdirSync(path.join(root, 'src/app/admin/growth'), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
  check('ten Growth sub-pages plus Home', pages.length === 10 && fs.existsSync(path.join(root, 'src/app/admin/growth/page.tsx')), pages.join(','));
}

console.log('2. Data layer readiness (read only)');
const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TABLES = ['growth_companies', 'growth_contacts', 'growth_leads', 'growth_signals', 'growth_activity'];
let ready = false;
if (!url || !serviceKey) {
  console.log('  SKIP  no SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
} else {
  const svc = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const states = [];
  for (const t of TABLES) {
    const { error } = await svc.from(t).select('id').limit(1);
    states.push(!error ? 'ready' : error.code === 'PGRST205' || /does not exist|schema cache/i.test(error.message ?? '') ? 'missing' : `error ${error.code ?? ''}`);
  }
  ready = states.every((s) => s === 'ready');
  console.log(`  ${TABLES.map((t, i) => `${t}: ${states[i]}`).join(', ')}`);

  if (!WRITE) {
    console.log('  Write phase skipped (pass --write-test-rows to run it).');
  } else if (!ready) {
    check('all five tables exist before the write phase', false, 'apply 083_growth_core.sql first');
  } else {
    console.log('3. Test rows: create, link, read back, rules, anon key, clean up');
    await writePhase(svc);
  }
}

async function writePhase(svc) {
  const run = randomUUID().slice(0, 8);
  const created = { growth_activity: [], growth_signals: [], growth_leads: [], growth_contacts: [], growth_companies: [] };
  const expectError = async (label, promise, code) => {
    const { error } = await promise;
    check(label, Boolean(error) && (!code || error.code === code), error ? `${error.code} ${error.message}` : 'no error');
  };

  async function sweep(label) {
    // Rows from this run, and any left by a crashed earlier run, found by the marker.
    // Every delete is filtered on is_test = true.
    const leftovers = { ...created };
    const { data: cos } = await svc.from('growth_companies').select('id').eq('is_test', true).like('name', `${MARKER}%`);
    const { data: cts } = await svc.from('growth_contacts').select('id').eq('is_test', true).like('email', 'zz-growth-verify-%');
    const { data: lds } = await svc.from('growth_leads').select('id').eq('is_test', true).like('title', `${MARKER}%`);
    const { data: sgs } = await svc.from('growth_signals').select('id').eq('is_test', true).like('summary', `${MARKER}%`);
    const add = (t, rows) => (leftovers[t] = [...new Set([...(leftovers[t] ?? []), ...(rows ?? []).map((r) => r.id)])]);
    add('growth_companies', cos); add('growth_contacts', cts); add('growth_leads', lds); add('growth_signals', sgs);
    const ids = (t) => leftovers[t] ?? [];
    const { data: acts } = await svc.from('growth_activity').select('id').eq('is_test', true).or(
      [ids('growth_companies').length && `company_id.in.(${ids('growth_companies')})`, ids('growth_contacts').length && `contact_id.in.(${ids('growth_contacts')})`, ids('growth_leads').length && `lead_id.in.(${ids('growth_leads')})`, ids('growth_signals').length && `signal_id.in.(${ids('growth_signals')})`, `action.like.verify.%`]
        .filter(Boolean)
        .join(','),
    );
    add('growth_activity', acts);
    for (const t of ['growth_activity', 'growth_signals', 'growth_leads', 'growth_contacts', 'growth_companies']) {
      if (!ids(t).length) continue;
      const { error } = await svc.from(t).delete().eq('is_test', true).in('id', ids(t));
      if (error) check(`${label}: delete ${t}`, false, `${error.code} ${error.message}`);
    }
  }

  await sweep('pre-clean');
  try {
    // Company, with a domain given the way people paste it.
    const domain = model.normaliseDomain(`https://www.zz-growth-verify-${run}.example/about`);
    const { data: company, error: cErr } = await svc.from('growth_companies').insert({ is_test: true, name: `${MARKER} Co ${run}`, website_domain: domain, sector: 'Real estate', city: 'Riyadh', likely_service: 'refm' }).select().single();
    check('company created', !cErr && company, cErr?.message);
    if (!company) return;
    created.growth_companies.push(company.id);
    check('company country defaults to Saudi Arabia, status to new', company.country === 'Saudi Arabia' && company.status === 'new');
    await expectError('an old six-service value is refused', svc.from('growth_companies').insert({ is_test: true, name: `${MARKER} Old service ${run}`, likely_service: 'real_estate_modeling' }), '23514');
    await expectError('duplicate domain refused', svc.from('growth_companies').insert({ is_test: true, name: `${MARKER} Dup ${run}`, website_domain: domain }), '23505');
    await expectError('un-normalised domain refused', svc.from('growth_companies').insert({ is_test: true, name: `${MARKER} Raw ${run}`, website_domain: `WWW.${domain}` }), '23514');

    // Contact.
    const email = `zz-growth-verify-${run}@example.invalid`;
    const { data: contact, error: pErr } = await svc.from('growth_contacts').insert({ is_test: true, company_id: company.id, full_name: `${MARKER} Person ${run}`, role_title: 'CFO', email, is_decision_maker: true }).select().single();
    check('contact created and linked', !pErr && contact?.company_id === company.id, pErr?.message);
    if (!contact) return;
    created.growth_contacts.push(contact.id);
    check('contact consent defaults to unknown', contact.consent_status === 'unknown');
    await expectError('duplicate email refused', svc.from('growth_contacts').insert({ is_test: true, full_name: `${MARKER} Dup ${run}`, email }), '23505');
    await expectError('mixed-case email refused', svc.from('growth_contacts').insert({ is_test: true, full_name: `${MARKER} Case ${run}`, email: email.toUpperCase() }), '23514');

    // Signal before its company exists, then attached.
    const { data: signal, error: sErr } = await svc.from('growth_signals').insert({ is_test: true, company_name: `${MARKER} Co ${run}`, trigger_type: 'off_plan_registration', signal_date: '2026-09-20', summary: `${MARKER} off-plan project registered ${run}`, evidence_url: 'https://example.invalid/evidence' }).select().single();
    check('signal created with no company, status new', !sErr && signal?.company_id === null && signal?.status === 'new', sErr?.message);
    if (!signal) return;
    created.growth_signals.push(signal.id);
    await expectError('signal without evidence link refused', svc.from('growth_signals').insert({ is_test: true, company_name: 'x', trigger_type: 'other', signal_date: '2026-09-20', summary: `${MARKER} no evidence ${run}` }), '23502');
    await expectError('signal with a non-web evidence link refused', svc.from('growth_signals').insert({ is_test: true, company_name: 'x', trigger_type: 'other', signal_date: '2026-09-20', summary: `${MARKER} bad evidence ${run}`, evidence_url: 'not a link' }), '23514');
    await expectError('signal naming no company refused', svc.from('growth_signals').insert({ is_test: true, trigger_type: 'other', signal_date: '2026-09-20', summary: `${MARKER} nameless ${run}`, evidence_url: 'https://example.invalid/e' }), '23514');

    // Leads above and below the minimum.
    const lead = (title, deal) => ({ is_test: true, company_id: company.id, contact_id: contact.id, title: `${MARKER} ${title} ${run}`, source: 'outbound', recommended_service: 'refm', deal_size_sar: deal, prospect_score: 72, prospect_band: 'good', lead_score: 40, lead_temperature: 'warm', score_reasons: ['Off-plan registration in Riyadh', 'CFO identified'] });
    const { data: big, error: bErr } = await svc.from('growth_leads').insert(lead('Above', 120_000_000)).select().single();
    const { data: small, error: smErr } = await svc.from('growth_leads').insert(lead('Below', 12_500_000)).select().single();
    const { data: unknown, error: uErr } = await svc.from('growth_leads').insert(lead('Unknown', null)).select().single();
    for (const r of [big, small, unknown]) if (r) created.growth_leads.push(r.id);
    check('three leads created', !bErr && !smErr && !uErr, bErr?.message ?? smErr?.message ?? uErr?.message);
    check('below minimum: SAR 120m not flagged', big?.below_minimum === false);
    check('below minimum: SAR 12.5m flagged', small?.below_minimum === true);
    check('below minimum: no deal size not flagged', unknown?.below_minimum === false);
    check('lead stage defaults to prospect', big?.stage === 'prospect');
    check('score reasons stored as a list', Array.isArray(big?.score_reasons) && big.score_reasons.length === 2);
    await expectError('below_minimum cannot be written', svc.from('growth_leads').update({ below_minimum: false }).eq('id', small.id).eq('is_test', true));
    const { data: moved } = await svc.from('growth_leads').update({ deal_size_sar: 60_000_000 }).eq('id', small.id).eq('is_test', true).select().single();
    check('below minimum follows a changed deal size', moved?.below_minimum === false);
    await expectError('override without a reason refused', svc.from('growth_leads').update({ score_override: true }).eq('id', big.id).eq('is_test', true), '23514');
    const { error: ovErr } = await svc.from('growth_leads').update({ score_override: true, override_reason: 'Referred by an existing client' }).eq('id', big.id).eq('is_test', true);
    check('override with a reason accepted', !ovErr, ovErr?.message);
    await expectError('unknown stage refused', svc.from('growth_leads').update({ stage: 'maybe' }).eq('id', big.id).eq('is_test', true), '23514');
    await expectError('unknown source refused', svc.from('growth_leads').insert({ ...lead('Bad source', 1), source: 'cold_call' }), '23514');

    // Attach the signal to the company and lead.
    const { data: attached } = await svc.from('growth_signals').update({ company_id: company.id, lead_id: big.id, status: 'converted' }).eq('id', signal.id).eq('is_test', true).select().single();
    check('signal attached to its company and lead', attached?.company_id === company.id && attached?.lead_id === big.id && attached?.status === 'converted');
    check('updated_at maintained by the database', attached && Date.parse(attached.updated_at) >= Date.parse(signal.updated_at));

    // Activity, one insert per event as it happens in use. created_at defaults to
    // NOW(), the transaction time, so rows written by one statement share a
    // timestamp and have no defined order between them.
    const acts = [];
    let aErr = null;
    for (const row of [
      { is_test: true, company_id: company.id, signal_id: signal.id, actor_type: 'ai', actor_id: 'signal-scout', action: 'verify.signal_found', summary: `${MARKER} signal found` },
      { is_test: true, company_id: company.id, lead_id: big.id, contact_id: contact.id, actor_type: 'admin', actor_id: 'verify-growth-data', action: 'verify.lead_created', metadata: { run } },
    ]) {
      const { data, error } = await svc.from('growth_activity').insert(row).select().single();
      if (error) aErr = error;
      if (data) { acts.push(data); created.growth_activity.push(data.id); }
    }
    check('activity appended', !aErr && acts.length === 2, aErr?.message);
    check('activity metadata defaults to an empty object', acts[0] && typeof acts[0].metadata === 'object' && Object.keys(acts[0].metadata).length === 0);
    if (!acts?.length) return;
    await expectError('activity cannot be updated', svc.from('growth_activity').update({ summary: 'changed' }).eq('id', acts[0].id).eq('is_test', true));
    await expectError('a company with history cannot be deleted before its activity', svc.from('growth_companies').delete().eq('id', company.id).eq('is_test', true), '23503');

    // Read everything back, linked.
    const { data: back, error: rErr } = await svc
      .from('growth_leads')
      .select('id, title, below_minimum, company:growth_companies(id, name, website_domain), contact:growth_contacts(id, email, is_decision_maker)')
      .eq('id', big.id)
      .single();
    check('lead reads back with its company and contact', !rErr && back?.company?.website_domain === domain && back?.contact?.email === email && back?.contact?.is_decision_maker === true, rErr?.message);
    const { data: timeline } = await svc.from('growth_activity').select('action').eq('company_id', company.id).order('created_at');
    check('company timeline reads back in order', timeline?.map((t) => t.action).join() === 'verify.signal_found,verify.lead_created');

    // The public anon key: no read, no write, on any Growth table.
    const anonUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!anonUrl || !anonKey) {
      check('anon key available for the refusal checks', false, 'NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY missing');
    } else {
      const anon = createClient(anonUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
      for (const t of TABLES) {
        const { data, error } = await anon.from(t).select('*').limit(5);
        check(`anon cannot read ${t}`, Boolean(error) || (Array.isArray(data) && data.length === 0), error ? '' : `${data?.length} rows`);
      }
      const { data: target } = await anon.from('growth_leads').select('id').eq('id', big.id);
      check('anon cannot read a known test lead by id', !target || target.length === 0);
      const { error: insErr } = await anon.from('growth_companies').insert({ is_test: true, name: `${MARKER} Anon ${run}` });
      check('anon cannot insert', Boolean(insErr));
      const { data: upd } = await anon.from('growth_leads').update({ title: 'anon' }).eq('id', big.id).select();
      const { data: still } = await svc.from('growth_leads').select('title').eq('id', big.id).single();
      check('anon cannot update', (!upd || upd.length === 0) && still?.title?.startsWith(MARKER));
    }
  } finally {
    await sweep('clean-up');
    const counts = await Promise.all([
      svc.from('growth_companies').select('id', { count: 'exact' }).eq('is_test', true).like('name', `${MARKER}%`),
      svc.from('growth_contacts').select('id', { count: 'exact' }).eq('is_test', true).like('email', 'zz-growth-verify-%'),
      svc.from('growth_leads').select('id', { count: 'exact' }).eq('is_test', true).like('title', `${MARKER}%`),
      svc.from('growth_signals').select('id', { count: 'exact' }).eq('is_test', true).like('summary', `${MARKER}%`),
      svc.from('growth_activity').select('id', { count: 'exact' }).eq('is_test', true).like('action', 'verify.%'),
    ]);
    check('all test rows cleaned up', counts.every((c) => (c.count ?? 0) === 0), counts.map((c) => c.count).join(','));
  }
}

console.log(`\n${checks - failures} of ${checks} checks passed.`);
if (failures) {
  console.log(`${failures} FAILED`);
  process.exit(1);
}
