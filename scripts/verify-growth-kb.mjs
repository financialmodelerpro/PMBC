// scripts/verify-growth-kb.mjs
//
// Proves the Growth Knowledge Base (Unit 1.3, migration 084):
//
//   1. Offline, always: the kinds and statuses in src/lib/growth/kbModel.ts
//      match the migration's CHECK lists; migration 086 turns the services into
//      the site's nine (converting five, archiving Feasibility Studies, adding
//      four), each keyed and named as on the site, and links the feasibility
//      offer to its three services; no content is invented; the activity order fix is in the migration; the content
//      cleaning, approval rules and approved snapshot behave.
//   2. Read only: the nine services are live, named and linked as on the site,
//      Feasibility Studies is archived, the four offers are present.
//   3. Only with --write-test-rows: drives the real Knowledge Base code
//      (src/lib/growth/kb.ts) through create, refused approval, approve, edit
//      while approved (agents keep the approved copy), re-approve, archive and
//      restore, checking getApprovedKnowledge at every step and the activity
//      log with who and when, in order. Proves the case study link is a real
//      foreign key, the public anon key cannot read the table, and activity
//      written together keeps its order. Then removes every test row and
//      confirms the real items are exactly as they were.
//
// The database is production. Every row the write phase creates has
// is_test = true and a title starting with the marker below; every delete is
// filtered on is_test = true. No other table is written. Approved by Ahmad for
// the Growth tables on 2026-09-22.
//
//   npm run verify-growth-kb                      (offline and read only)
//   npm run verify-growth-kb -- --write-test-rows (full, writes test rows)

import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { createJiti } from 'jiti';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WRITE = process.argv.includes('--write-test-rows');
const MARKER = 'ZZ KB Verify';
const DASHES = new RegExp(`[${String.fromCharCode(0x2013)}${String.fromCharCode(0x2014)}]`);

for (const line of fs.existsSync(path.join(root, '.env.local')) ? fs.readFileSync(path.join(root, '.env.local'), 'utf8').split(/\r?\n/) : []) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
}

const jiti = createJiti(import.meta.url, { alias: { '@': path.join(root, 'src') } });
const kbm = await jiti.import(path.join(root, 'src/lib/growth/kbModel.ts'));
const model = await jiti.import(path.join(root, 'src/lib/growth/model.ts'));
const { SERVICES } = await jiti.import(path.join(root, 'src/config/services.ts'));

let checks = 0, failures = 0;
function check(label, ok, detail = '') {
  checks++;
  if (ok) return;
  failures++;
  console.log(`  FAIL  ${label}${detail ? `: ${detail}` : ''}`);
}
const same = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());

console.log('1. Model, migration and rules (offline)');
const sql = fs.readFileSync(path.join(root, 'supabase/migrations/084_growth_knowledge_base.sql'), 'utf8');
const listIn = (column) => [...sql.matchAll(new RegExp(`CHECK \\(${column} IN \\(([^)]*)\\)`, 'g'))].map((m) => [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]));
check('kinds match the migration', same(listIn('kind')[0] ?? [], kbm.KB_KINDS_LIST), String(listIn('kind')[0]));
check('statuses match the migration', same(listIn('status')[0] ?? [], kbm.KB_STATUSES));
check('every kind has a config', kbm.KB_KINDS_LIST.every((k) => kbm.KB_KINDS.some((c) => c.kind === k)) && kbm.KB_KINDS.length === 10);
check('SAFE TO APPLY line present', /^-- SAFE TO APPLY:/m.test(sql));
check('RLS on and anon revoked', sql.includes('ALTER TABLE growth_kb_items ENABLE ROW LEVEL SECURITY;') && sql.includes('REVOKE ALL ON TABLE growth_kb_items FROM anon, authenticated;'));
check('activity order: clock_timestamp default and a seq identity', sql.includes('ALTER COLUMN created_at SET DEFAULT clock_timestamp()') && /ADD COLUMN IF NOT EXISTS seq BIGINT GENERATED ALWAYS AS IDENTITY/.test(sql));
check('is_test on the table', /is_test BOOLEAN NOT NULL DEFAULT false/.test(sql));
const sql086 = fs.readFileSync(path.join(root, 'supabase/migrations/086_growth_nine_services.sql'), 'utf8');
const conversions = [...sql086.matchAll(/\('([a-z_]+)', '([a-z-]+)', '([^']+)', (\d+)\)/g)].map((m) => ({ old: m[1], key: m[2], title: m[3] }));
const added = [...sql086.matchAll(/\('service', '([a-z-]+)', (\d+), '([^']+)', '([a-z-]+)', 'Migration 086'\)/g)].map((m) => ({ key: m[1], title: m[3], slug: m[4] }));
const siteNine = SERVICES.map((x) => x.slug);
check('086 converts five old service drafts', conversions.length === 5 && same(conversions.map((c) => c.old), ['financial_modeling', 'business_valuation', 'financial_due_diligence', 'ma_modeling', 'real_estate_modeling']), JSON.stringify(conversions));
check('086 adds the four missing site services', added.length === 4 && added.every((a) => a.key === a.slug));
check('converted and added together are exactly the nine site services', same([...conversions.map((c) => c.key), ...added.map((a) => a.key)], siteNine));
check('every service is named exactly as on the site', [...conversions, ...added].every((c) => SERVICES.find((x) => x.slug === c.key)?.title === c.title));
check('Feasibility Studies service is archived, not deleted', /SET status = 'archived', item_key = NULL/.test(sql086) && sql086.includes("item_key = 'feasibility_study' AND NOT is_test"));
check('the feasibility offer links to Financial Modeling, Real Estate Financial Modeling and Project Finance', sql086.includes("SET related_service_slugs = ARRAY['financial-modeling', 'refm', 'project-finance']"));
check('086 CHECK lists are the nine site slugs', [...sql086.matchAll(/'financial-modeling', 'business-valuation', 'financial-due-diligence', 'transaction-advisory',\s*'mergers-acquisitions', 'refm', 'project-finance', 'investment-memorandums', 'cfo-advisory'/g)].length === 5 && JSON.stringify(siteNine) === JSON.stringify(['financial-modeling', 'business-valuation', 'financial-due-diligence', 'transaction-advisory', 'mergers-acquisitions', 'refm', 'project-finance', 'investment-memorandums', 'cfo-advisory']));
check('086 logs every conversion and the offer link', sql086.includes("'kb.service_aligned'") && sql086.includes("'kb.offer_linked'"));
check('086 has a SAFE TO APPLY line and adds no content', /^-- SAFE TO APPLY:/m.test(sql086) && !/content\s*=/.test(sql086));
check('the model services are the nine site services', same(kbm.KB_SERVICE_KEYS, siteNine));
{
  const c = kbm.cleanKbContent('service', { description: '  A  ', use_cases: 'one\n\n two \n', junk: 'x', sectors: ['a', '', ' b '] });
  check('cleaning trims, splits lists by line, drops unknown keys', c.description === 'A' && JSON.stringify(c.use_cases) === '["one","two"]' && JSON.stringify(c.sectors) === '["a","b"]' && !('junk' in c));
  const draft = { kind: 'faq', title: 'Q?', content: {}, site_service_slug: null, case_study_id: null };
  check('an empty FAQ cannot be approved', kbm.approvalProblems(draft).length === 1);
  check('a complete FAQ can be approved', kbm.approvalProblems({ ...draft, content: { answer: 'A.' } }).length === 0);
  const full = { description: 'd', ideal_client: 'i', use_cases: ['u'], deliverables: ['d'], sectors: ['s'] };
  check('a complete service linked to its site page can be approved', kbm.approvalProblems({ kind: 'service', title: 'S', content: full, site_service_slug: 'refm', case_study_id: null }).length === 0);
  check('a service that is not a site service cannot be approved', kbm.approvalProblems({ kind: 'service', title: 'S', content: full, site_service_slug: 'real_estate_modeling', case_study_id: null }).some((p) => p.includes('not one of the site services')));
  check('an offer snapshot freezes its related services, cleaned to site order', JSON.stringify(kbm.approvedSnapshot({ kind: 'offer', title: 'O', content: {}, site_service_slug: null, case_study_id: null, related_service_slugs: ['project-finance', 'bogus', 'financial-modeling', 'project-finance'] }).related_service_slugs) === '["financial-modeling","project-finance"]');
  check('a case study needs its record to be approved', kbm.approvalProblems({ kind: 'case_study', title: 'C', content: { when_to_use: 'w' }, site_service_slug: null, case_study_id: null }).some((p) => p.includes('case study record')));
  check('targeting needs titles or excluded work', kbm.approvalProblems({ kind: 'targeting', title: 'T', content: {}, site_service_slug: null, case_study_id: null }).length === 1);
  check('the approved snapshot freezes the link too', kbm.approvedSnapshot({ kind: 'service', title: 'S', content: {}, site_service_slug: 'refm', case_study_id: null }).site_service_slug === 'refm');
  check('services and offers are fixed kinds', kbm.kbKind('service').fixed === true && kbm.kbKind('offer').fixed === true && !kbm.kbKind('faq').fixed);
}
{
  const files = [
    'supabase/migrations/084_growth_knowledge_base.sql',
    'supabase/migrations/086_growth_nine_services.sql',
    'src/lib/growth/kbModel.ts',
    'src/lib/growth/kb.ts',
    'src/components/admin/growth/kb/KbEditor.tsx',
    'src/components/admin/growth/kb/KbActions.tsx',
    'src/app/admin/growth/knowledge-base/page.tsx',
    'src/app/admin/growth/knowledge-base/new/page.tsx',
    'src/app/admin/growth/knowledge-base/[id]/page.tsx',
    'src/app/api/admin/growth/kb/route.ts',
    'src/app/api/admin/growth/kb/[id]/route.ts',
  ];
  const dirty = files.filter((f) => DASHES.test(fs.readFileSync(path.join(root, f), 'utf8')));
  check('no em or en dash in any Knowledge Base file', dirty.length === 0, dirty.join(', '));
  const api = fs.readFileSync(path.join(root, 'src/app/api/admin/growth/kb/[id]/route.ts'), 'utf8') + fs.readFileSync(path.join(root, 'src/app/api/admin/growth/kb/route.ts'), 'utf8');
  check('every Knowledge Base API handler is admin-only', (api.match(/await requireOwner\(\)/g) ?? []).length === 3);
  const pages = ['src/app/admin/growth/knowledge-base/page.tsx', 'src/app/admin/growth/knowledge-base/new/page.tsx', 'src/app/admin/growth/knowledge-base/[id]/page.tsx'];
  check('every Knowledge Base page calls requireGrowthSession', pages.every((p) => fs.readFileSync(path.join(root, p), 'utf8').includes('await requireGrowthSession()')));
}

console.log('2. Table and starter drafts (read only)');
const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.log('  SKIP  no SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
} else {
  const svc = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: real, error } = await svc.from('growth_kb_items').select('kind, item_key, status, title, is_test').eq('is_test', false);
  if (error) {
    console.log(`  growth_kb_items: ${error.code === 'PGRST205' ? 'missing (apply 084)' : error.message}`);
    if (WRITE) check('table exists before the write phase', false, 'apply 084_growth_knowledge_base.sql first');
  } else {
    const liveServices = (real ?? []).filter((r) => r.kind === 'service' && r.status !== 'archived');
    check('nine live services, keyed by the site slugs', same(liveServices.map((r) => r.item_key), siteNine), liveServices.map((r) => r.item_key).join(','));
    check('each live service is named exactly as on the site', liveServices.every((r) => SERVICES.find((x) => x.slug === r.item_key)?.title === r.title));
    const { data: links } = await svc.from('growth_kb_items').select('kind, item_key, site_service_slug, related_service_slugs, status, title').eq('is_test', false);
    check('each live service links to its own site page', (links ?? []).filter((r) => r.kind === 'service' && r.status !== 'archived').every((r) => r.site_service_slug === r.item_key));
    check('Feasibility Studies service archived with its key cleared', (links ?? []).some((r) => r.kind === 'service' && r.status === 'archived' && r.item_key === null && r.title.startsWith('Feasibility Studies')));
    check('four offers present', same((real ?? []).filter((r) => r.kind === 'offer').map((r) => r.item_key), kbm.KB_OFFER_KEYS));
    const feas = (links ?? []).find((r) => r.kind === 'offer' && r.item_key === 'feasibility_study');
    check('the feasibility offer links to its three services', JSON.stringify(feas?.related_service_slugs) === '["financial-modeling","refm","project-finance"]', JSON.stringify(feas?.related_service_slugs));
    const { data: aligned } = await svc.from('growth_activity').select('action').in('action', ['kb.service_aligned', 'kb.offer_linked']);
    check('the conversion is in the activity log', (aligned ?? []).filter((a) => a.action === 'kb.service_aligned').length === 5 && (aligned ?? []).filter((a) => a.action === 'kb.offer_linked').length === 1);
    const { data: st } = await svc.from('growth_settings').select('priority_services').eq('id', 1).single();
    check('priority services are all site services', Array.isArray(st?.priority_services) && st.priority_services.every((x) => siteNine.includes(x)));
    const { error: seqErr } = await svc.from('growth_activity').select('seq, kb_item_id').limit(1);
    check('growth_activity has seq and kb_item_id', !seqErr, seqErr?.message);
    if (!WRITE) console.log('  Write phase skipped (pass --write-test-rows to run it).');
    else {
      console.log('3. Test rows through the real Knowledge Base code');
      await writePhase(svc, real ?? []);
    }
  }
}

async function writePhase(svc, realBefore) {
  const kb = await jiti.import(path.join(root, 'src/lib/growth/kb.ts'));
  const actor = { id: 'verify-growth-kb', name: 'KB verifier' };
  const run = randomUUID().slice(0, 8);
  const approvedFaqs = async (opts = { includeTest: true }) => (await kb.getApprovedKnowledge(opts)).faq.filter((i) => i.title.startsWith(MARKER));

  async function sweep() {
    const { data: items } = await svc.from('growth_kb_items').select('id').eq('is_test', true).like('title', `${MARKER}%`);
    const ids = (items ?? []).map((i) => i.id);
    if (ids.length) {
      const { error: aErr } = await svc.from('growth_activity').delete().eq('is_test', true).in('kb_item_id', ids);
      if (aErr) check('clean-up: delete test activity', false, aErr.message);
    }
    const { error: oErr } = await svc.from('growth_activity').delete().eq('is_test', true).like('action', 'verify.kb.%');
    if (oErr) check('clean-up: delete order-test activity', false, oErr.message);
    if (ids.length) {
      const { error } = await svc.from('growth_kb_items').delete().eq('is_test', true).in('id', ids);
      if (error) check('clean-up: delete test items', false, error.message);
    }
  }

  await sweep();
  try {
    // Create, refused approval, approve.
    const created = await kb.createKbItem({ kind: 'faq', title: `${MARKER} What does a model review cover? ${run}`, content: { answer: '' } }, actor, { isTest: true });
    check('test FAQ created as a draft', created.ok && created.item.status === 'draft' && created.item.is_test === true, created.error);
    if (!created.ok) return;
    const id = created.item.id;
    check('a draft is not given to agents', (await approvedFaqs()).length === 0);
    const refused = await kb.actOnKbItem(id, 'approve', actor);
    check('an incomplete item cannot be approved', !refused.ok && refused.status === 422, refused.error);
    const filled = await kb.editKbItem(id, { title: created.item.title, content: { answer: 'Version one answer.' } }, actor);
    check('draft edited', filled.ok);
    const approved = await kb.actOnKbItem(id, 'approve', actor);
    check('approved, with who and when', approved.ok && approved.item.status === 'approved' && approved.item.approved_by_name === actor.name && Boolean(approved.item.approved_at));
    let got = await approvedFaqs();
    check('agents receive the approved copy', got.length === 1 && got[0].content.answer === 'Version one answer.' && got[0].approvedBy === actor.name);
    check('test rows never reach agents by default', (await approvedFaqs({})).length === 0);

    // Edit while approved: agents keep the approved copy.
    const edited = await kb.editKbItem(id, { title: created.item.title, content: { answer: 'Version two, half written' } }, actor);
    check('edit keeps the item approved', edited.ok && edited.item.status === 'approved');
    check('the edit shows as unapproved', edited.ok && kb.hasUnapprovedEdits(edited.item));
    got = await approvedFaqs();
    check('agents still receive version one, never the edit', got.length === 1 && got[0].content.answer === 'Version one answer.');
    const again = await kb.actOnKbItem(id, 'approve', actor);
    got = await approvedFaqs();
    check('re-approval publishes version two', again.ok && got[0]?.content.answer === 'Version two, half written' && !kb.hasUnapprovedEdits(again.item));

    // Archive and restore.
    const archived = await kb.actOnKbItem(id, 'archive', actor);
    check('archived items are withdrawn from agents', archived.ok && archived.item.status === 'archived' && (await approvedFaqs()).length === 0);
    const blocked = await kb.editKbItem(id, { title: created.item.title, content: { answer: 'x' } }, actor);
    check('an archived item cannot be edited', !blocked.ok && blocked.status === 409);
    const restored = await kb.actOnKbItem(id, 'restore', actor);
    check('restore returns a draft that agents do not read', restored.ok && restored.item.status === 'draft' && (await approvedFaqs()).length === 0);

    // The log: every step, with who, in order.
    const { data: log } = await svc.from('growth_activity').select('action, actor_type, actor_id, metadata, created_at, seq, is_test').eq('kb_item_id', id).order('created_at').order('seq');
    const actions = (log ?? []).map((l) => l.action).join(',');
    check('activity logged in order', actions === 'kb.created,kb.approved,kb.edited_approved,kb.approved,kb.archived,kb.restored', actions);
    check('activity records who', (log ?? []).every((l) => l.actor_type === 'admin' && l.actor_id === actor.id && l.metadata?.actor_name === actor.name));
    check('activity for test items is flagged test', (log ?? []).every((l) => l.is_test === true));
    check('draft edits are not logged as approved edits', !(log ?? []).some((l, n) => l.action === 'kb.edited_approved' && n === 0));

    // Services are fixed, one per site service, each linked to its own page.
    const svcAttempt = await kb.createKbItem({ kind: 'service', title: `${MARKER} Extra service ${run}`, content: {} }, actor, { isTest: true });
    check('no tenth service can be added', !svcAttempt.ok && svcAttempt.status === 422);
    const full = { description: 'd', ideal_client: 'i', use_cases: ['u'], deliverables: ['d'], sectors: ['s'] };
    const { error: oldKeyErr } = await svc.from('growth_kb_items').insert({ is_test: true, kind: 'service', item_key: 'ma_modeling', site_service_slug: 'ma_modeling', title: `${MARKER} Old ${run}` });
    check('an old six-service key is refused by the database', oldKeyErr?.code === '23514');
    const { error: wrongLink } = await svc.from('growth_kb_items').insert({ is_test: true, kind: 'service', item_key: 'refm', site_service_slug: 'project-finance', title: `${MARKER} Wrong ${run}` });
    check('a service linked to another service page is refused', wrongLink?.code === '23514');
    const { data: testService, error: tsErr } = await svc
      .from('growth_kb_items')
      .insert({ is_test: true, kind: 'service', item_key: 'business-valuation', title: `${MARKER} Service ${run}`, site_service_slug: 'business-valuation', content: full, updated_by: actor.id, updated_by_name: actor.name })
      .select('id')
      .single();
    check('a test service may reuse a real service key', !tsErr && testService, tsErr?.message);
    if (testService) {
      await kb.actOnKbItem(testService.id, 'approve', actor);
      const moved = await kb.editKbItem(testService.id, { title: `${MARKER} Service ${run}`, content: full, site_service_slug: 'refm' }, actor);
      check('a service cannot be pointed at another site page', moved.ok && moved.item.site_service_slug === 'business-valuation');
      const services = (await kb.getApprovedKnowledge({ includeTest: true })).service.filter((x) => x.title.startsWith(MARKER));
      check('agents get the service page with its site name and link', services[0]?.siteService?.slug === 'business-valuation' && services[0]?.siteService?.title === 'Business Valuation' && services[0]?.siteService?.href === '/services/business-valuation', JSON.stringify(services[0]?.siteService));
    }

    // Offers link to related services; the links are frozen at approval.
    const { data: testOffer, error: toErr } = await svc
      .from('growth_kb_items')
      .insert({ is_test: true, kind: 'offer', item_key: 'feasibility_study', title: `${MARKER} Offer ${run}`, content: { scope: 's', suits: 'u', upsell_path: 'p' }, updated_by: actor.id, updated_by_name: actor.name })
      .select('id')
      .single();
    check('test offer row created', !toErr && testOffer, toErr?.message);
    if (testOffer) {
      const offerContent = { scope: 's', suits: 'u', upsell_path: 'p' };
      const bogus = await kb.editKbItem(testOffer.id, { title: `${MARKER} Offer ${run}`, content: offerContent, related_service_slugs: ['refm', 'feasibility_study'] }, actor);
      check('an offer cannot link to something that is not a site service', !bogus.ok && bogus.status === 422);
      const linked = await kb.editKbItem(testOffer.id, { title: `${MARKER} Offer ${run}`, content: offerContent, related_service_slugs: ['project-finance', 'financial-modeling', 'refm'] }, actor);
      check('offer links saved in site order', linked.ok && JSON.stringify(linked.item.related_service_slugs) === '["financial-modeling","refm","project-finance"]');
      await kb.actOnKbItem(testOffer.id, 'approve', actor);
      await kb.editKbItem(testOffer.id, { title: `${MARKER} Offer ${run}`, content: offerContent, related_service_slugs: ['cfo-advisory'] }, actor);
      const offers = (await kb.getApprovedKnowledge({ includeTest: true })).offer.filter((x) => x.title.startsWith(MARKER));
      check('agents keep the approved related services until re-approved', JSON.stringify(offers[0]?.relatedServices?.map((r) => r.title)) === '["Financial Modeling","Real Estate Financial Modeling","Project Finance"]', JSON.stringify(offers[0]?.relatedServices));
      const { data: offerLog } = await svc.from('growth_activity').select('action').eq('kb_item_id', testOffer.id).order('created_at').order('seq');
      check('a change of related services while approved is logged', (offerLog ?? []).some((l) => l.action === 'kb.edited_approved'));
      const { error: dbBogus } = await svc.from('growth_kb_items').update({ related_service_slugs: ['bogus'] }).eq('id', testOffer.id);
      check('the database refuses an unknown related service', dbBogus?.code === '23514');
    }

    // Case studies link to the real table.
    const cs = await kb.createKbItem({ kind: 'case_study', title: `${MARKER} Case ${run}`, content: { when_to_use: 'w' }, case_study_id: randomUUID() }, actor, { isTest: true });
    check('a case study link must point at an existing record', !cs.ok && cs.status === 422, cs.ok ? 'accepted' : cs.error);

    // Activity written together keeps its order.
    const { data: batch, error: bErr } = await svc
      .from('growth_activity')
      .insert([1, 2, 3].map((n) => ({ is_test: true, actor_type: 'system', actor_id: 'verify-growth-kb', action: `verify.kb.order.${n}`, summary: null, metadata: {} })))
      .select('action, created_at, seq');
    check('batch activity inserted', !bErr && batch?.length === 3, bErr?.message);
    const { data: ordered } = await svc.from('growth_activity').select('action').eq('is_test', true).like('action', 'verify.kb.order.%').order('created_at').order('seq');
    check('activity written together reads back in insertion order', (ordered ?? []).map((o) => o.action).join() === 'verify.kb.order.1,verify.kb.order.2,verify.kb.order.3');
    check('rows in one statement get increasing seq', batch && batch[0].seq < batch[1].seq && batch[1].seq < batch[2].seq);

    // The public anon key.
    const anonUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (anonUrl && anonKey) {
      const anon = createClient(anonUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
      const { data, error } = await anon.from('growth_kb_items').select('id').limit(5);
      check('anon cannot read the Knowledge Base', Boolean(error) || (Array.isArray(data) && data.length === 0));
      const { error: insErr } = await anon.from('growth_kb_items').insert({ is_test: true, kind: 'faq', title: `${MARKER} anon` });
      check('anon cannot write the Knowledge Base', Boolean(insErr));
    } else {
      check('anon key available', false);
    }
  } finally {
    await sweep();
    const { count: tests } = await svc.from('growth_kb_items').select('id', { count: 'exact' }).eq('is_test', true);
    const { count: testActs } = await svc.from('growth_activity').select('id', { count: 'exact' }).eq('is_test', true);
    const { data: realAfter } = await svc.from('growth_kb_items').select('id, kind, item_key').eq('is_test', false);
    check('no test Knowledge Base rows remain', (tests ?? 0) === 0, String(tests));
    check('no test activity remains', (testActs ?? 0) === 0, String(testActs));
    check('real items unchanged by the run', same((realAfter ?? []).map((r) => `${r.kind}:${r.item_key}`), realBefore.map((r) => `${r.kind}:${r.item_key}`)));
    check('the real items number the same as before', (realAfter ?? []).length === realBefore.length, `${realAfter?.length} vs ${realBefore.length}`);
  }
}

console.log(`\n${checks - failures} of ${checks} checks passed.`);
if (failures) {
  console.log(`${failures} FAILED`);
  process.exit(1);
}
