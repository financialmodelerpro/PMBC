// scripts/verify-growth-settings.mjs
//
// Proves Growth Settings (Unit 1.4, migration 085):
//
//   1. Offline, always: defaults and limits in settingsModel.ts match the
//      migration; the form schema refuses every invalid value the database
//      refuses; the suppression check catches an imported email, a suppressed
//      domain and a valuation tool unsubscribe made after the import, passes a
//      clean email, and fails closed when a source cannot be read; integration
//      status is right and never contains a value.
//   2. Read only: both tables exist and the settings row is present.
//   3. Only with --write-test-rows: imports the real opt-outs (real rows, which
//      stay); changes and restores the settings as a logged test change, with
//      old and new values; proves the database refuses invalid values; drives
//      suppression add, check, remove and history against the live tables;
//      proves the retention preview lists the right test contacts and changes
//      nothing; proves the audit log filters and hides test rows by default;
//      proves the anon key cannot read either table; removes every test row.
//
// The database is production. Test rows carry is_test = true and a marker;
// every delete is filtered on is_test = true. Settings changes are made only to
// the isolated test row (id 2, is_test, migration 087), created for the run and
// removed after it; the real row (id 1) is compared field for field before and
// after, including updated_at, and must not change at all. Previously the
// run restores it exactly and its log rows are marked test. The valuation
// tool's tables are only read. Approved by Ahmad for the Growth tables on
// 2026-09-22.
//
//   npm run verify-growth-settings                      (offline and read only)
//   npm run verify-growth-settings -- --write-test-rows (full)

import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { createJiti } from 'jiti';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WRITE = process.argv.includes('--write-test-rows');
const DASHES = new RegExp(`[${String.fromCharCode(0x2013)}${String.fromCharCode(0x2014)}]`);

for (const line of fs.existsSync(path.join(root, '.env.local')) ? fs.readFileSync(path.join(root, '.env.local'), 'utf8').split(/\r?\n/) : []) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
}

const jiti = createJiti(import.meta.url, { alias: { '@': path.join(root, 'src') } });
const sm = await jiti.import(path.join(root, 'src/lib/growth/settingsModel.ts'));
const sup = await jiti.import(path.join(root, 'src/lib/growth/suppression.ts'));
const integ = await jiti.import(path.join(root, 'src/lib/growth/integrations.ts'));
const ret = await jiti.import(path.join(root, 'src/lib/growth/retention.ts'));

let checks = 0, failures = 0;
function check(label, ok, detail = '') {
  checks++;
  if (ok) return;
  failures++;
  console.log(`  FAIL  ${label}${detail ? `: ${detail}` : ''}`);
}

console.log('1. Defaults, limits, suppression rules, integrations (offline)');
const sql = fs.readFileSync(path.join(root, 'supabase/migrations/085_growth_settings.sql'), 'utf8');
const D = sm.DEFAULT_SETTINGS;
check('default cap 10 in both', D.daily_cold_email_cap === 10 && sql.includes('daily_cold_email_cap INTEGER NOT NULL DEFAULT 10'));
check('default days Sunday to Thursday in both', JSON.stringify(D.send_days) === '[0,1,2,3,4]' && sql.includes("send_days INTEGER[] NOT NULL DEFAULT '{0,1,2,3,4}'"));
check('default window 09:00 to 17:00, Riyadh, in both', D.send_start === '09:00' && D.send_end === '17:00' && D.send_timezone === 'Asia/Riyadh' && sql.includes("send_start TIME NOT NULL DEFAULT '09:00'") && sql.includes("send_end TIME NOT NULL DEFAULT '17:00'") && sql.includes("DEFAULT 'Asia/Riyadh'"));
check('default follow-ups 4, 10, 20 and max 3 in both', JSON.stringify(D.follow_up_days) === '[4,10,20]' && D.max_follow_ups === 3 && sql.includes("DEFAULT '{4,10,20}'") && sql.includes('max_follow_ups INTEGER NOT NULL DEFAULT 3'));
check('default threshold 80 and alert email in both', D.ai_alert_threshold_pct === 80 && D.ai_alert_email === 'ahmad.din@pacemakersglobal.com' && sql.includes('DEFAULT 80') && sql.includes("DEFAULT 'ahmad.din@pacemakersglobal.com'"));
check('budget has no default: null until set', D.ai_monthly_budget_usd === null && /ai_monthly_budget_usd NUMERIC\(10, 2\) CHECK/.test(sql));
check('default retention 12 months in both', D.retention_months === 12 && sql.includes('retention_months INTEGER NOT NULL DEFAULT 12'));
const sql086 = fs.readFileSync(path.join(root, 'supabase/migrations/086_growth_nine_services.sql'), 'utf8');
check('default priority services: the five, in both', JSON.stringify(D.priority_services) === JSON.stringify(['financial-modeling', 'business-valuation', 'financial-due-diligence', 'mergers-acquisitions', 'refm']) && sql086.includes("DEFAULT ARRAY['financial-modeling', 'business-valuation', 'financial-due-diligence', 'mergers-acquisitions', 'refm']::TEXT[]"));
const L = sm.SETTINGS_LIMITS;
check('limits match the migration', sql.includes(`BETWEEN ${L.dailyCap.min} AND ${L.dailyCap.max}`) && sql.includes(`BETWEEN ${L.thresholdPct.min} AND ${L.thresholdPct.max}`) && sql.includes(`BETWEEN ${L.retentionMonths.min} AND ${L.retentionMonths.max}`) && sql.includes(`BETWEEN ${L.maxFollowUps.min} AND ${L.maxFollowUps.max}`) && sql.includes(`<= ${L.budgetUsd.max}`));
check('SAFE TO APPLY, RLS and revoke in the migration', /^-- SAFE TO APPLY:/m.test(sql) && sql.includes('ALTER TABLE growth_settings ENABLE ROW LEVEL SECURITY;') && sql.includes('ALTER TABLE growth_suppressions ENABLE ROW LEVEL SECURITY;') && sql.includes('REVOKE ALL ON TABLE growth_settings, growth_suppressions FROM anon, authenticated;'));
{
  const ok = { ...D, ai_monthly_budget_usd: null };
  check('defaults pass the form schema', sm.settingsSchema.safeParse(ok).success);
  check('no priority services is allowed', sm.settingsSchema.safeParse({ ...ok, priority_services: [] }).success);
  const bad = {
    'cap 0': { daily_cold_email_cap: 0 },
    'cap 501': { daily_cold_email_cap: 501 },
    'no sending days': { send_days: [] },
    'repeated day': { send_days: [1, 1] },
    'window ends first': { send_start: '17:00', send_end: '09:00' },
    'bad time': { send_start: '9am' },
    'follow-ups not increasing': { follow_up_days: [10, 4] },
    'follow-up day 0': { follow_up_days: [0, 4] },
    'more follow-ups than days': { follow_up_days: [4, 10], max_follow_ups: 3 },
    'budget 0': { ai_monthly_budget_usd: 0 },
    'threshold 0': { ai_alert_threshold_pct: 0 },
    'threshold 101': { ai_alert_threshold_pct: 101 },
    'bad alert email': { ai_alert_email: 'not an email' },
    'retention 0': { retention_months: 0 },
    'an unknown priority service': { priority_services: ['financial-modeling', 'feasibility_study'] },
    'a priority service twice': { priority_services: ['refm', 'refm'] },
  };
  for (const [label, patch] of Object.entries(bad)) check(`form refuses ${label}`, !sm.settingsSchema.safeParse({ ...ok, ...patch }).success);
  check('parseDayList reads "4, 10, 20"', JSON.stringify(sm.parseDayList('4, 10, 20')) === '[4,10,20]' && Number.isNaN(sm.parseDayList('4, x')[1]));
}
check('domainsOf lists the domain and its parents', JSON.stringify(sup.domainsOf('a@x.acme.com.sa')) === '["x.acme.com.sa","acme.com.sa","com.sa"]');
check('suppression values normalised', sup.normaliseSuppressionValue('email', ' Jane@ACME.com ') === 'jane@acme.com' && sup.normaliseSuppressionValue('domain', 'https://www.Acme.com/x') === 'acme.com' && sup.normaliseSuppressionValue('domain', 'jane@acme.com') === 'acme.com' && sup.normaliseSuppressionValue('email', 'nope') === null && sup.normaliseSuppressionValue('domain', 'localhost') === null);
{
  const fake = (over = {}) => ({
    async list(email, domains) {
      const hits = [];
      if (email === 'imported@client.example') hits.push({ source: 'valuation_unsubscribe', match: `email ${email}`, reason: 'imported', since: null });
      if (domains.includes('blocked.example')) hits.push({ source: 'manual', match: 'domain blocked.example', reason: 'domain', since: null });
      return hits;
    },
    async toolUnsubscribes(email) {
      return email === 'late@client.example' ? [{ source: 'valuation_unsubscribe', match: `email ${email}`, reason: 'live', since: '2026-09-23T00:00:00Z' }] : [];
    },
    async contactOptOuts() {
      return [];
    },
    ...over,
  });
  const r1 = await sup.checkSuppression('Imported@Client.example', fake());
  check('catches an imported email (case-insensitive)', r1.suppressed && r1.reasons[0].reason === 'imported');
  const r2 = await sup.checkSuppression('anyone@team.blocked.example', fake());
  check('catches a suppressed domain, including subdomains', r2.suppressed && r2.reasons[0].match === 'domain blocked.example');
  const r3 = await sup.checkSuppression('late@client.example', fake());
  check('catches a valuation unsubscribe made after the import (not in the list)', r3.suppressed && r3.reasons.length === 1 && r3.reasons[0].reason === 'live');
  const r4 = await sup.checkSuppression('clean@client.example', fake());
  check('a clean email passes', !r4.suppressed && r4.reasons.length === 0);
  const r5 = await sup.checkSuppression('clean@client.example', fake({ async toolUnsubscribes() { throw new Error('down'); } }));
  check('fails closed when a source cannot be read', r5.suppressed && r5.reasons[0].source === 'check_failed');
  const r6 = await sup.checkSuppression('not-an-email', fake());
  check('an unreadable address is suppressed', r6.suppressed);
}
{
  const SECRET = 'zz-secret-value-never-shown';
  const all = integ.integrationStatus({ BREVO_API_KEY: SECRET, EMAIL_FROM_DEFAULT: SECRET, ANTHROPIC_API_KEY: SECRET, MS_GRAPH_TENANT_ID: SECRET, MS_GRAPH_CLIENT_ID: SECRET, MS_GRAPH_CLIENT_SECRET: SECRET });
  const by = (k, list) => list.find((i) => i.key === k);
  check('Brevo configured when its variables are set', by('brevo', all).state === 'configured');
  check('Claude configured once its key is set; Graph Not set up until built', by('claude', all).state === 'configured' && by('microsoft_graph', all).state === 'not_set_up');
  check('integration status never contains a value', !JSON.stringify(all).includes(SECRET));
  const none = integ.integrationStatus({});
  check('Brevo not set up without its variables', by('brevo', none).state === 'not_set_up' && by('brevo', none).detail.includes('BREVO_API_KEY'));
  check('three integrations listed', all.length === 3);
}
check('retention cut-off is N calendar months back', ret.retentionCutoff(12, new Date('2026-09-22T00:00:00Z')).toISOString().startsWith('2025-09-22'));
{
  const files = [
    'supabase/migrations/085_growth_settings.sql', 'src/lib/growth/settingsModel.ts', 'src/lib/growth/settings.ts', 'src/lib/growth/suppression.ts', 'src/lib/growth/retention.ts', 'src/lib/growth/integrations.ts', 'src/lib/growth/audit.ts',
    'src/components/admin/growth/settings/SettingsForm.tsx', 'src/components/admin/growth/settings/SuppressionManager.tsx', 'src/components/admin/growth/settings/SettingsTabs.tsx',
    'src/app/admin/growth/settings/page.tsx', 'src/app/admin/growth/settings/suppression/page.tsx', 'src/app/admin/growth/settings/audit/page.tsx',
    'src/app/api/admin/growth/settings/route.ts', 'src/app/api/admin/growth/suppressions/route.ts', 'src/app/api/admin/growth/suppressions/[id]/route.ts', 'src/app/api/admin/growth/suppressions/import/route.ts',
  ];
  const dirty = files.filter((f) => DASHES.test(fs.readFileSync(path.join(root, f), 'utf8')));
  check('no em or en dash in any Unit 1.4 file', dirty.length === 0, dirty.join(', '));
  const apis = files.filter((f) => f.startsWith('src/app/api/'));
  check('every Unit 1.4 API route is admin-only', apis.every((f) => fs.readFileSync(path.join(root, f), 'utf8').includes('await requireOwner()')));
  const pages = files.filter((f) => f.startsWith('src/app/admin/'));
  check('every Unit 1.4 page calls requireGrowthSession', pages.every((f) => fs.readFileSync(path.join(root, f), 'utf8').includes('await requireGrowthSession()')));
}

console.log('2. Tables (read only)');
const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.log('  SKIP  no SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
} else {
  const svc = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const s = await svc.from('growth_settings').select('id').eq('id', 1).maybeSingle();
  const q = await svc.from('growth_suppressions').select('id').limit(1);
  if (s.error || q.error) {
    console.log(`  tables missing or unreadable: ${(s.error ?? q.error).message}`);
    if (WRITE) check('tables exist before the write phase', false, 'apply 085_growth_settings.sql first');
  } else {
    check('the settings row exists', Boolean(s.data));
    if (!WRITE) console.log('  Write phase skipped (pass --write-test-rows to run it).');
    else {
      console.log('3. Live database, test rows');
      await writePhase(svc);
    }
  }
}

async function writePhase(svc) {
  const settingsLib = await jiti.import(path.join(root, 'src/lib/growth/settings.ts'));
  const audit = await jiti.import(path.join(root, 'src/lib/growth/audit.ts'));
  const actor = { id: 'verify-growth-settings', name: 'Settings verifier' };
  const run = randomUUID().slice(0, 8);
  const runStart = new Date(Date.now() - 1000).toISOString();
  const created = { contacts: [], companies: [], leads: [] };
  const TEST_ROW = settingsLib.TEST_SETTINGS_ROW;
  const { data: realBefore } = await svc.from('growth_settings').select('*').eq('id', 1).single();
  await svc.from('growth_settings').delete().eq('id', TEST_ROW).eq('is_test', true);
  const { error: rowErr } = await svc.from('growth_settings').insert({ id: TEST_ROW, is_test: true });
  check('an isolated test settings row can be created', !rowErr, rowErr?.message);
  const { error: fakeReal } = await svc.from('growth_settings').insert({ id: 3, is_test: true });
  check('no third settings row is possible', Boolean(fakeReal));
  const { error: testAsReal } = await svc.from('growth_settings').update({ is_test: true }).eq('id', 1);
  check('the real row cannot be marked test', testAsReal?.code === '23514');
  const original = await settingsLib.getGrowthSettings(TEST_ROW);
  check('test settings read from the database', original.source === 'database', original.error);
  if (original.source !== 'database') return;

  async function cleanup() {
    await svc.from('growth_leads').delete().eq('is_test', true).in('id', created.leads.length ? created.leads : ['00000000-0000-0000-0000-000000000000']);
    await svc.from('growth_contacts').delete().eq('is_test', true).like('full_name', 'ZZ Settings Verify%');
    await svc.from('growth_companies').delete().eq('is_test', true).like('name', 'ZZ Settings Verify%');
    await svc.from('growth_suppressions').delete().eq('is_test', true).like('value', '%zz-supp-%');
    const { error } = await svc.from('growth_activity').delete().eq('is_test', true).gte('created_at', runStart);
    if (error) check('clean-up: delete test activity', false, error.message);
  }

  try {
    // Import the real opt-outs. Real rows, which stay.
    const imported = await sup.importOptOuts({ id: actor.id, name: 'Opt-out import (Unit 1.4)' });
    console.log(`  Import: found ${imported.found.valuation} valuation unsubscribes, ${imported.found.contacts} Growth contact opt-outs; added ${imported.added}, already suppressed ${imported.alreadySuppressed}.`);
    check('import ran without errors', imported.errors.length === 0, imported.errors.join('; '));
    const again = await sup.importOptOuts({ id: actor.id, name: 'Opt-out import (Unit 1.4)' });
    check('import is safe to run again (adds nothing new)', again.added === 0 && again.errors.length === 0);

    // Settings: a logged test change, then restored exactly.
    const changed = { ...original.settings, daily_cold_email_cap: original.settings.daily_cold_email_cap === 11 ? 12 : 11, retention_months: original.settings.retention_months === 6 ? 7 : 6, ai_alert_threshold_pct: original.settings.ai_alert_threshold_pct === 75 ? 76 : 75, priority_services: original.settings.priority_services.includes('cfo-advisory') ? original.settings.priority_services.filter((x) => x !== 'cfo-advisory') : [...original.settings.priority_services, 'cfo-advisory'] };
    const w1 = await settingsLib.updateGrowthSettings(changed, actor, { rowId: TEST_ROW });
    check('settings change saved', w1.ok, w1.error);
    const { data: log1 } = await svc.from('growth_activity').select('action, is_test, actor_id, metadata').eq('action', 'settings.changed').gte('created_at', runStart).order('created_at').order('seq');
    const entry = (log1 ?? [])[0];
    const c = entry?.metadata?.changes ?? {};
    check('settings change logged as a test row, with who', entry && entry.is_test === true && entry.actor_id === actor.id && entry.metadata.actor_name === actor.name);
    check('log holds old and new for each changed field, and only those', c.daily_cold_email_cap?.old === original.settings.daily_cold_email_cap && c.daily_cold_email_cap?.new === changed.daily_cold_email_cap && c.retention_months?.new === changed.retention_months && c.ai_alert_threshold_pct?.new === changed.ai_alert_threshold_pct && JSON.stringify(c.priority_services?.new) === JSON.stringify(changed.priority_services) && Object.keys(c).length === 4, JSON.stringify(c));
    const w2 = await settingsLib.updateGrowthSettings(original.settings, actor, { rowId: TEST_ROW });
    const back = await settingsLib.getGrowthSettings(TEST_ROW);
    check('settings restored exactly', w2.ok && JSON.stringify(back.settings) === JSON.stringify(original.settings));

    // The database refuses invalid values, whatever the app sends.
    const invalid = {
      'cap 0': { daily_cold_email_cap: 0 },
      'threshold 101': { ai_alert_threshold_pct: 101 },
      'retention 0': { retention_months: 0 },
      'budget 0': { ai_monthly_budget_usd: 0 },
      'window ending first': { send_start: '17:00', send_end: '09:00' },
      'follow-ups not increasing': { follow_up_days: [10, 4] },
      'more follow-ups than days': { follow_up_days: [4], max_follow_ups: 2 },
      'day 7': { send_days: [7] },
      'upper-case alert email': { ai_alert_email: 'AHMAD@EXAMPLE.COM' },
      'another timezone': { send_timezone: 'UTC' },
      'an unknown priority service': { priority_services: ['financial-modeling', 'feasibility_study'] },
    };
    for (const [label, patch] of Object.entries(invalid)) {
      const { error } = await svc.from('growth_settings').update(patch).eq('id', TEST_ROW);
      check(`database refuses ${label}`, error?.code === '23514', error ? error.code : 'accepted');
    }
    const after = await settingsLib.getGrowthSettings(TEST_ROW);
    check('refused values changed nothing', JSON.stringify(after.settings) === JSON.stringify(original.settings));

    // Suppression against the live tables.
    const email = `zz-supp-${run}@example.invalid`;
    const domain = `zz-supp-${run}.example`;
    const a1 = await sup.addSuppression({ kind: 'email', value: email.toUpperCase(), reason: 'Verifier test' }, actor, { isTest: true });
    check('email suppressed (normalised)', a1.ok && a1.row.value === email);
    const a2 = await sup.addSuppression({ kind: 'domain', value: `https://www.${domain}/`, reason: 'Verifier domain' }, actor, { isTest: true });
    check('domain suppressed (normalised)', a2.ok && a2.row.value === domain);
    const dup = await sup.addSuppression({ kind: 'email', value: email, reason: 'Again' }, actor, { isTest: true });
    check('a second live entry is refused', !dup.ok && dup.status === 409);
    const { error: rawErr } = await svc.from('growth_suppressions').insert({ is_test: true, kind: 'email', value: `ZZ-SUPP-${run}-RAW@EXAMPLE.INVALID`, reason: 'raw', source: 'manual' });
    check('database refuses an un-normalised value', rawErr?.code === '23514');
    let r = await sup.checkSuppression(email);
    check('live check: suppressed email', r.suppressed && r.reasons.some((x) => x.source === 'manual'));
    r = await sup.checkSuppression(`someone@team.${domain}`);
    check('live check: suppressed domain catches a subdomain address', r.suppressed && r.reasons.some((x) => x.match === `domain ${domain}`));
    r = await sup.checkSuppression(`zz-clean-${run}@example.invalid`);
    check('live check: a clean email passes, reading every source', !r.suppressed && r.reasons.length === 0, JSON.stringify(r.reasons));
    // A Growth contact opts out after the import: caught live, never imported.
    const optEmail = `zz-supp-optout-${run}@example.invalid`;
    const { data: opt } = await svc.from('growth_contacts').insert({ is_test: true, full_name: `ZZ Settings Verify opt-out ${run}`, email: optEmail, consent_status: 'opted_out' }).select('id').single();
    r = await sup.checkSuppression(optEmail);
    check('live check: an opt-out made after the import is caught', r.suppressed && r.reasons.some((x) => x.source === 'growth_contact'));
    const { data: inList } = await svc.from('growth_suppressions').select('id').eq('value', optEmail);
    check('it was caught without being in the list', (inList ?? []).length === 0);
    if (opt) created.contacts.push(opt.id);

    const noReason = await sup.removeSuppression(a1.row.id, '  ', actor);
    check('removal without a reason refused by the app', !noReason.ok && noReason.status === 422);
    const { error: dbNoReason } = await svc.from('growth_suppressions').update({ removed_at: new Date().toISOString() }).eq('id', a1.row.id);
    check('removal without a reason refused by the database', dbNoReason?.code === '23514');
    const rem = await sup.removeSuppression(a1.row.id, 'Verifier removal', actor);
    check('removed with a reason, kept as history', rem.ok && rem.row.removed_reason === 'Verifier removal' && rem.row.removed_by_name === actor.name);
    r = await sup.checkSuppression(email);
    check('a removed entry no longer suppresses', !r.suppressed);
    const { error: editRemoved } = await svc.from('growth_suppressions').update({ reason: 'changed' }).eq('id', a1.row.id);
    check('a removed entry cannot be changed', Boolean(editRemoved));
    const readd = await sup.addSuppression({ kind: 'email', value: email, reason: 'Re-added' }, actor, { isTest: true });
    check('an email can be suppressed again after removal', readd.ok);
    const { data: supLog } = await svc.from('growth_activity').select('action, actor_id, is_test').like('action', 'suppression.%').gte('created_at', runStart).eq('is_test', true).order('created_at').order('seq');
    check('suppression adds and removal logged in order, as test rows', (supLog ?? []).map((l) => l.action).join() === 'suppression.added,suppression.added,suppression.removed,suppression.added', (supLog ?? []).map((l) => l.action).join());

    // Retention preview.
    const now = new Date();
    const past = (days) => new Date(now.getTime() - days * 86_400_000).toISOString();
    const { data: co } = await svc.from('growth_companies').insert({ is_test: true, name: `ZZ Settings Verify Co ${run}` }).select('id').single();
    if (co) created.companies.push(co.id);
    const mk = async (name, fields) => {
      const { data } = await svc.from('growth_contacts').insert({ is_test: true, full_name: `ZZ Settings Verify ${name} ${run}`, company_id: co?.id ?? null, ...fields }).select('id').single();
      if (data) created.contacts.push(data.id);
      return data?.id;
    };
    const oldNever = await mk('old never contacted', { created_at: past(800) });
    const oldContacted = await mk('old contacted', { created_at: past(900), last_contacted_at: past(500) });
    const oldReplied = await mk('old replied', { created_at: past(900), last_contacted_at: past(500) });
    const recent = await mk('recent', { created_at: past(900), last_contacted_at: past(10) });
    const { data: lead } = await svc.from('growth_leads').insert({ is_test: true, contact_id: oldReplied, company_id: co?.id ?? null, title: `ZZ Settings Verify lead ${run}`, source: 'outbound', stage: 'replied' }).select('id').single();
    if (lead) created.leads.push(lead.id);
    const before = await svc.from('growth_contacts').select('id, updated_at').in('id', created.contacts);
    const preview = await ret.retentionPreview(12, { includeTest: true });
    const ids = new Set(preview.rows.map((p) => p.id));
    check('retention preview lists old contacts who never replied', ids.has(oldNever) && ids.has(oldContacted), preview.error);
    check('retention preview leaves out contacts who replied, and recent contacts', !ids.has(oldReplied) && !ids.has(recent));
    check('retention preview hides test contacts by default', !(await ret.retentionPreview(12)).rows.some((p) => created.contacts.includes(p.id)));
    const afterPreview = await svc.from('growth_contacts').select('id, updated_at').in('id', created.contacts);
    check('retention preview changed nothing', JSON.stringify(before.data) === JSON.stringify(afterPreview.data));

    // Audit log.
    const base = { type: '', actor: '', from: '', to: '', related: '', includeTest: false, page: 1 };
    const hidden = await audit.listAudit({ ...base, from: runStart.slice(0, 10) });
    check('audit hides test rows by default', !hidden.rows.some((x) => x.is_test), hidden.error);
    const shown = await audit.listAudit({ ...base, includeTest: true, type: 'settings', from: runStart.slice(0, 10) });
    check('audit shows test rows on request, filtered by type', shown.rows.length >= 2 && shown.rows.every((x) => x.action.startsWith('settings.')));
    const ordered = shown.rows.map((x) => `${x.created_at}|${String(x.seq).padStart(12, '0')}`);
    check('audit is newest first in a reliable order', ordered.every((v, i) => i === 0 || ordered[i - 1] >= v));
    const byActor = await audit.listAudit({ ...base, includeTest: true, actor: 'admin', from: runStart.slice(0, 10) });
    check('audit filters by actor', byActor.rows.length > 0 && byActor.rows.every((x) => x.actor_type === 'admin'));
    const { data: kbItem } = await svc.from('growth_kb_items').select('id').eq('is_test', false).limit(1).single();
    if (kbItem) {
      const byKb = await audit.listAudit({ ...base, related: `kb:${kbItem.id}` });
      check('audit filters by related Knowledge Base item', byKb.rows.length > 0 && byKb.rows.every((x) => x.kb_item_id === kbItem.id));
    }
    const future = await audit.listAudit({ ...base, includeTest: true, from: '2999-01-01' });
    check('audit filters by date', future.rows.length === 0);
    const shownAll = await audit.listAudit({ ...base, includeTest: true });
    const paged = await audit.listAudit({ ...base, includeTest: true, page: Math.ceil((shownAll.total + 1) / audit.AUDIT_PAGE_SIZE) + 1 });
    check('a page past the end is empty, not an error', !paged.error && paged.rows.length === 0 && paged.total === shownAll.total, paged.error);

    // The public anon key.
    const anonUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (anonUrl && anonKey) {
      const anon = createClient(anonUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
      for (const t of ['growth_settings', 'growth_suppressions']) {
        const { data, error } = await anon.from(t).select('*').limit(5);
        check(`anon cannot read ${t}`, Boolean(error) || (Array.isArray(data) && data.length === 0));
      }
      const { error: upd } = await anon.from('growth_settings').update({ daily_cold_email_cap: 499 }).eq('id', 1);
      const { data: realStill } = await svc.from('growth_settings').select('daily_cold_email_cap').eq('id', 1).single();
      check('anon cannot change the settings', realStill?.daily_cold_email_cap === realBefore?.daily_cold_email_cap, upd?.message);
    } else check('anon key available', false);
  } finally {
    await cleanup();
    const { error: delRow } = await svc.from('growth_settings').delete().eq('id', TEST_ROW).eq('is_test', true);
    check('the test settings row is removed', !delRow, delRow?.message);
    const { data: realAfter } = await svc.from('growth_settings').select('*').eq('id', 1).single();
    check('the real settings row is untouched, field for field', JSON.stringify(realAfter) === JSON.stringify(realBefore), 'the real row changed');
    const leftovers = await Promise.all(['growth_companies', 'growth_contacts', 'growth_leads', 'growth_suppressions'].map((t) => svc.from(t).select('id', { count: 'exact' }).eq('is_test', true)));
    const acts = await svc.from('growth_activity').select('id', { count: 'exact' }).eq('is_test', true);
    check('no test rows remain in any Growth table', leftovers.every((l) => (l.count ?? 0) === 0) && (acts.count ?? 0) === 0, `${leftovers.map((l) => l.count).join(',')} activity ${acts.count}`);
    const { count: rows } = await svc.from('growth_settings').select('id', { count: 'exact' });
    check('only the real settings row remains', rows === 1, String(rows));
    const real = await svc.from('growth_suppressions').select('id, source', { count: 'exact' }).eq('is_test', false);
    console.log(`  Real suppression entries now: ${real.count ?? 0}.`);
  }
}

console.log(`\n${checks - failures} of ${checks} checks passed.`);
if (failures) {
  console.log(`${failures} FAILED`);
  process.exit(1);
}
