// scripts/verify-growth-kb.mjs
//
// Proves the Growth Knowledge Base (Unit 1.3, migration 084):
//
//   1. Offline, always: the kinds and statuses in src/lib/growth/kbModel.ts
//      match the migration's CHECK lists; the ten starter drafts are the six
//      Growth services and four entry offers, with valid public site mappings
//      and no content; the activity order fix is in the migration; the content
//      cleaning, approval rules and approved snapshot behave.
//   2. Read only: the table exists, and the ten starter drafts are present, as
//      real rows (not test rows).
//   3. Only with --write-test-rows: drives the real Knowledge Base code
//      (src/lib/growth/kb.ts) through create, refused approval, approve, edit
//      while approved (agents keep the approved copy), re-approve, archive and
//      restore, checking getApprovedKnowledge at every step and the activity
//      log with who and when, in order. Proves the case study link is a real
//      foreign key, the public anon key cannot read the table, and activity
//      written together keeps its order. Then removes every test row and
//      confirms only the ten starter drafts remain.
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
const seeds = [...sql.matchAll(/\('(service|offer)',\s*'([a-z_]+)',\s*(\d+),\s*'([^']+)',\s*(NULL|'[^']*')\)/g)].map((m) => ({ kind: m[1], key: m[2], title: m[4], slug: m[5] === 'NULL' ? null : m[5].slice(1, -1) }));
check('ten starter drafts in the migration', seeds.length === 10, String(seeds.length));
check('the six services are the six Growth services', same(seeds.filter((s) => s.kind === 'service').map((s) => s.key), model.GROWTH_SERVICES.map((s) => s.value)));
check('service titles are the Growth service labels', seeds.filter((s) => s.kind === 'service').every((s) => model.GROWTH_SERVICES.find((g) => g.value === s.key)?.label === s.title));
check('the four offers are the four entry offers', same(seeds.filter((s) => s.kind === 'offer').map((s) => s.key), kbm.KB_OFFER_KEYS));
check('every seeded site mapping is a real public site service', seeds.filter((s) => s.slug).every((s) => SERVICES.some((x) => x.slug === s.slug)));
check('Feasibility Studies left unmapped for Ahmad', seeds.find((s) => s.key === 'feasibility_study' && s.kind === 'service')?.slug === null);
check('offers carry no site mapping', seeds.filter((s) => s.kind === 'offer').every((s) => s.slug === null));
check('starter drafts carry no content (no invented facts)', !/INSERT INTO growth_kb_items[^;]*content/.test(sql));
{
  const c = kbm.cleanKbContent('service', { description: '  A  ', use_cases: 'one\n\n two \n', junk: 'x', sectors: ['a', '', ' b '] });
  check('cleaning trims, splits lists by line, drops unknown keys', c.description === 'A' && JSON.stringify(c.use_cases) === '["one","two"]' && JSON.stringify(c.sectors) === '["a","b"]' && !('junk' in c));
  const draft = { kind: 'faq', title: 'Q?', content: {}, site_service_slug: null, case_study_id: null };
  check('an empty FAQ cannot be approved', kbm.approvalProblems(draft).length === 1);
  check('a complete FAQ can be approved', kbm.approvalProblems({ ...draft, content: { answer: 'A.' } }).length === 0);
  check('a service needs its public site mapping to be approved', kbm.approvalProblems({ kind: 'service', title: 'S', content: { description: 'd', ideal_client: 'i', use_cases: ['u'], deliverables: ['d'], sectors: ['s'] }, site_service_slug: null, case_study_id: null }).some((p) => p.includes('public site service')));
  check('a case study needs its record to be approved', kbm.approvalProblems({ kind: 'case_study', title: 'C', content: { when_to_use: 'w' }, site_service_slug: null, case_study_id: null }).some((p) => p.includes('case study record')));
  check('targeting needs titles or excluded work', kbm.approvalProblems({ kind: 'targeting', title: 'T', content: {}, site_service_slug: null, case_study_id: null }).length === 1);
  check('the approved snapshot freezes the link too', kbm.approvedSnapshot({ kind: 'service', title: 'S', content: {}, site_service_slug: 'refm', case_study_id: null }).site_service_slug === 'refm');
  check('services and offers are fixed kinds', kbm.kbKind('service').fixed === true && kbm.kbKind('offer').fixed === true && !kbm.kbKind('faq').fixed);
}
{
  const files = [
    'supabase/migrations/084_growth_knowledge_base.sql',
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
    const keyed = (real ?? []).filter((r) => r.item_key);
    check('six starter services present', same(keyed.filter((r) => r.kind === 'service').map((r) => r.item_key), model.GROWTH_SERVICES.map((s) => s.value)));
    check('four starter offers present', same(keyed.filter((r) => r.kind === 'offer').map((r) => r.item_key), kbm.KB_OFFER_KEYS));
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

    // Services are fixed; the link is frozen at approval.
    const svcAttempt = await kb.createKbItem({ kind: 'service', title: `${MARKER} Extra service ${run}`, content: {} }, actor, { isTest: true });
    check('no seventh service can be added', !svcAttempt.ok && svcAttempt.status === 422);
    const { data: testService, error: tsErr } = await svc
      .from('growth_kb_items')
      .insert({ is_test: true, kind: 'service', title: `${MARKER} Service ${run}`, site_service_slug: 'business-valuation', content: { description: 'd', ideal_client: 'i', use_cases: ['u'], deliverables: ['d'], sectors: ['s'] }, updated_by: actor.id, updated_by_name: actor.name })
      .select('id')
      .single();
    check('test service row created', !tsErr && testService, tsErr?.message);
    if (testService) {
      await kb.actOnKbItem(testService.id, 'approve', actor);
      await kb.editKbItem(testService.id, { title: `${MARKER} Service ${run}`, content: { description: 'd', ideal_client: 'i', use_cases: ['u'], deliverables: ['d'], sectors: ['s'] }, site_service_slug: 'refm' }, actor);
      const services = (await kb.getApprovedKnowledge({ includeTest: true })).service.filter((s) => s.title.startsWith(MARKER));
      check('agents keep the approved service mapping until re-approved', services[0]?.siteService?.slug === 'business-valuation', JSON.stringify(services[0]?.siteService));
      const badSlug = await kb.editKbItem(testService.id, { title: `${MARKER} Service ${run}`, content: {}, site_service_slug: 'not-a-service' }, actor);
      check('an unknown public site service is refused', !badSlug.ok && badSlug.status === 422);
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
    check('only the ten starter drafts remain', (realAfter ?? []).length === 10, String(realAfter?.length));
  }
}

console.log(`\n${checks - failures} of ${checks} checks passed.`);
if (failures) {
  console.log(`${failures} FAILED`);
  process.exit(1);
}
