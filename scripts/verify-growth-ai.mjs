// scripts/verify-growth-ai.mjs
//
// Proves the Growth AI layer (Unit 1.5, migration 087):
//
//   1. Offline, always: prices and cost arithmetic, Riyadh month bounds, the
//      budget and threshold rules, mock mode switching on the key, mock output
//      labelled as mock, integration status, the shared-domain and public
//      suffix guards, and the migration's safeguards.
//   2. Read only: both tables exist.
//   3. Only with --write-test-rows: every call runs against an isolated test
//      settings row (id 2) and is recorded as a test call. Proves a mock call
//      returns labelled sample output, is recorded at zero cost and appears in
//      the audit log under AI; an empty budget, a reached budget, missing
//      Knowledge Base content, an unknown model, a provider failure and a model
//      refusal are each refused and recorded; the threshold alert is sent once
//      a month and never twice, and a failed send is retried; spend is counted
//      in Riyadh months; shared email domains need confirming; the anon key
//      reads nothing; real spend and the real settings row are untouched. Then
//      removes every test row.
//
// No real email is sent: the alert sender is a stand-in. No real AI call is
// made: without ANTHROPIC_API_KEY the layer is in mock mode, and the priced
// calls use a stand-in provider. Approved by Ahmad for Growth test rows.
//
//   npm run verify-growth-ai                      (offline and read only)
//   npm run verify-growth-ai -- --write-test-rows (full)

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
const pricing = await jiti.import(path.join(root, 'src/lib/growth/ai/pricing.ts'));
const provider = await jiti.import(path.join(root, 'src/lib/growth/ai/provider.ts'));
const mock = await jiti.import(path.join(root, 'src/lib/growth/ai/mock.ts'));
const integ = await jiti.import(path.join(root, 'src/lib/growth/integrations.ts'));
const sup = await jiti.import(path.join(root, 'src/lib/growth/suppression.ts'));

let checks = 0, failures = 0;
function check(label, ok, detail = '') {
  checks++;
  if (ok) return;
  failures++;
  console.log(`  FAIL  ${label}${detail ? `: ${detail}` : ''}`);
}

console.log('1. Rules (offline)');
check('Opus 5: 1M input plus 1M output costs USD 30', pricing.costUsd('claude-opus-5', { inputTokens: 1_000_000, outputTokens: 1_000_000 }) === 30);
check('cache writes at 1.25x and reads at 0.1x the input rate', pricing.costUsd('claude-opus-5', { inputTokens: 0, outputTokens: 0, cacheWriteTokens: 1_000_000, cacheReadTokens: 1_000_000 }) === 6.75);
check('Sonnet 5 and Haiku 4.5 priced', pricing.costUsd('claude-sonnet-5', { inputTokens: 1_000_000, outputTokens: 0 }) === 2 && pricing.costUsd('claude-haiku-4-5', { inputTokens: 0, outputTokens: 1_000_000 }) === 5);
check('an unknown model has no price', pricing.costUsd('claude-unknown', { inputTokens: 1, outputTokens: 1 }) === null);
check('default model is Claude Opus 5', pricing.DEFAULT_MODEL === 'claude-opus-5');
{
  const before = pricing.riyadhMonth(new Date('2026-09-30T20:59:59Z'));
  const after = pricing.riyadhMonth(new Date('2026-09-30T21:00:00Z'));
  check('23:59:59 on 30 September in Riyadh is still September', before.key === '2026-09');
  check('midnight on 1 October in Riyadh is October', after.key === '2026-10');
  check('Riyadh month bounds are 21:00 UTC the evening before', after.start.toISOString() === '2026-09-30T21:00:00.000Z' && after.end.toISOString() === '2026-10-31T21:00:00.000Z');
  check('December rolls into January', pricing.riyadhMonth(new Date('2026-12-31T22:00:00Z')).key === '2027-01');
}
check('no budget refuses', pricing.budgetDecision(null, 0).ok === false && pricing.budgetDecision(null, 0).reason === 'no_budget');
check('a reached budget refuses', pricing.budgetDecision(10, 10).reason === 'budget_reached' && pricing.budgetDecision(10, 9.99).ok === true);
check('threshold crossed at exactly the percentage', pricing.crossedThreshold(10, 8, 80) && !pricing.crossedThreshold(10, 7.99, 80) && !pricing.crossedThreshold(null, 100, 80));
check('mock mode exactly when no key is set', provider.isMockMode({}) && provider.isMockMode({ ANTHROPIC_API_KEY: '  ' }) && !provider.isMockMode({ ANTHROPIC_API_KEY: 'sk-test' }));
{
  const out = await mock.mockProvider.call({ model: 'mock', messages: [{ role: 'user', content: 'hello' }], maxTokens: 500, purpose: 'signal_research', agent: 'x' });
  check('mock output starts with its label', out.text.startsWith(mock.MOCK_LABEL) && out.model === 'mock' && out.inputTokens > 0 && out.outputTokens > 0);
  check('the mock label says it is not Claude', mock.MOCK_LABEL.includes('MOCK') && mock.MOCK_LABEL.includes('not written by Claude'));
  const other = await mock.mockProvider.call({ model: 'mock', messages: [{ role: 'user', content: 'x' }], maxTokens: 500, purpose: 'anything', agent: 'x' });
  check('unknown purposes still get a labelled sample', other.text.startsWith(mock.MOCK_LABEL));
}
{
  const SECRET = 'sk-zz-never-shown';
  const withKey = integ.integrationStatus({ ANTHROPIC_API_KEY: SECRET });
  const without = integ.integrationStatus({});
  check('Claude shows Mock mode without a key', without.find((i) => i.key === 'claude').state === 'mock');
  check('Claude shows Configured with a key', withKey.find((i) => i.key === 'claude').state === 'configured');
  check('integration status never contains the key', !JSON.stringify(withKey).includes(SECRET));
}
check('gmail.com, outlook.com, hotmail.com and yahoo.com are shared domains', ['gmail.com', 'outlook.com', 'hotmail.com', 'yahoo.com'].every(sup.isSharedEmailDomain) && !sup.isSharedEmailDomain('acme.com'));
check('com.sa is a public suffix, acme.com.sa is not', sup.isPublicSuffix('com.sa') && !sup.isPublicSuffix('acme.com.sa'));
{
  const sql = fs.readFileSync(path.join(root, 'supabase/migrations/087_growth_ai_usage.sql'), 'utf8');
  check('087: SAFE TO APPLY, RLS and revoke', /^-- SAFE TO APPLY:/m.test(sql) && sql.includes('ALTER TABLE growth_ai_usage ENABLE ROW LEVEL SECURITY;') && sql.includes('ALTER TABLE growth_ai_alerts ENABLE ROW LEVEL SECURITY;') && sql.includes('REVOKE ALL ON TABLE growth_ai_usage, growth_ai_alerts FROM anon, authenticated;'));
  check('087: mock calls are free by constraint', sql.includes('CHECK (NOT is_mock OR cost_usd = 0)'));
  check('087: one alert per month by unique key', sql.includes('ON growth_ai_alerts (month, is_test)'));
  check('087: only row 1 real and row 2 test', sql.includes('(id = 1 AND NOT is_test) OR (id = 2 AND is_test)'));
  check('087: every call logged with actor ai', sql.includes("'ai',\n    NEW.agent,"));
  const files = ['supabase/migrations/087_growth_ai_usage.sql', 'src/lib/growth/ai/pricing.ts', 'src/lib/growth/ai/provider.ts', 'src/lib/growth/ai/mock.ts', 'src/lib/growth/ai/anthropic.ts', 'src/lib/growth/ai/run.ts', 'src/app/api/admin/growth/ai/test/route.ts', 'src/components/admin/growth/settings/AiTestCall.tsx', 'src/lib/growth/suppression.ts', 'src/lib/growth/integrations.ts'];
  const dirty = files.filter((f) => DASHES.test(fs.readFileSync(path.join(root, f), 'utf8')));
  check('no em or en dash in any Unit 1.5 file', dirty.length === 0, dirty.join(', '));
  check('the test call API is admin-only', fs.readFileSync(path.join(root, 'src/app/api/admin/growth/ai/test/route.ts'), 'utf8').includes('await requireOwner()'));
  const direct = fs.readdirSync(path.join(root, 'src'), { recursive: true }).filter((f) => /\.(ts|tsx)$/.test(f)).filter((f) => fs.readFileSync(path.join(root, 'src', f), 'utf8').includes('@anthropic-ai/sdk'));
  check('only the provider file imports the Anthropic SDK', direct.length === 1 && direct[0].replace(/\\/g, '/') === 'lib/growth/ai/anthropic.ts', direct.join(', '));
}

console.log('2. Tables (read only)');
const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.log('  SKIP  no SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
} else {
  const svc = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const u = await svc.from('growth_ai_usage').select('id').limit(1);
  const a = await svc.from('growth_ai_alerts').select('id').limit(1);
  if (u.error || a.error) {
    console.log(`  tables missing or unreadable: ${(u.error ?? a.error).message}`);
    if (WRITE) check('tables exist before the write phase', false, 'apply 087_growth_ai_usage.sql first');
  } else if (!WRITE) {
    console.log('  Write phase skipped (pass --write-test-rows to run it).');
  } else {
    console.log('3. Live database, test rows');
    await writePhase(svc);
  }
}

async function writePhase(svc) {
  const run = await jiti.import(path.join(root, 'src/lib/growth/ai/run.ts'));
  const settingsLib = await jiti.import(path.join(root, 'src/lib/growth/settings.ts'));
  const audit = await jiti.import(path.join(root, 'src/lib/growth/audit.ts'));
  const TEST_ROW = settingsLib.TEST_SETTINGS_ROW;
  const actor = { id: 'verify-growth-ai', name: 'AI verifier' };
  const runStart = new Date(Date.now() - 1000).toISOString();
  const tag = randomUUID().slice(0, 8);
  const agent = `verify-ai-${tag}`;
  const { data: realRow } = await svc.from('growth_settings').select('*').eq('id', 1).single();
  const realSpendBefore = await run.monthSpend({ isTest: false });

  async function cleanup() {
    await svc.from('growth_activity').delete().eq('is_test', true).gte('created_at', runStart);
    await svc.from('growth_ai_usage').delete().eq('is_test', true).like('agent', 'verify-ai-%');
    await svc.from('growth_ai_alerts').delete().eq('is_test', true);
    await svc.from('growth_suppressions').delete().eq('is_test', true).in('value', ['gmail.com']);
    await svc.from('growth_settings').delete().eq('id', TEST_ROW).eq('is_test', true);
  }

  await cleanup();
  try {
    check('the layer is in mock mode (no key in this environment)', provider.isMockMode(process.env));
    const { error: rowErr } = await svc.from('growth_settings').insert({ id: TEST_ROW, is_test: true });
    check('isolated test settings row created', !rowErr, rowErr?.message);
    const opts = { settingsRowId: TEST_ROW };
    const ask = (over = {}) => ({ agent, purpose: 'signal_research', messages: [{ role: 'user', content: 'Find one signal.' }], maxTokens: 400, requireKnowledge: false, isTest: true, ...over });

    // Empty budget.
    let r = await run.runAi(ask(), opts);
    check('an empty budget refuses the call, with a clear message', !r.ok && r.reason === 'no_budget' && /Set one in Growth Settings/.test(r.message), JSON.stringify(r));
    check('the refusal is recorded', Boolean(r.usageId));

    // A mock call.
    const set = await settingsLib.updateGrowthSettings({ ...(await settingsLib.getGrowthSettings(TEST_ROW)).settings, ai_monthly_budget_usd: 10, ai_alert_threshold_pct: 80 }, actor, { rowId: TEST_ROW });
    check('test budget set to USD 10, alert at 80%', set.ok, set.error);
    r = await run.runAi(ask(), opts);
    check('a mock call returns labelled sample output', r.ok && r.mock && r.text.startsWith(mock.MOCK_LABEL), JSON.stringify(r).slice(0, 200));
    const { data: usage } = await svc.from('growth_ai_usage').select('*').eq('id', r.usageId).single();
    check('the mock call is recorded at zero cost, as mock, with tokens', usage && usage.is_mock && usage.provider === 'mock' && Number(usage.cost_usd) === 0 && usage.status === 'succeeded' && usage.input_tokens > 0 && usage.is_test);
    const { data: act } = await svc.from('growth_activity').select('action, actor_type, actor_id, metadata').eq('is_test', true).eq('actor_id', agent).order('created_at').order('seq');
    check('each call is in the activity log with actor ai', (act ?? []).map((a) => a.action).join() === 'ai.refused,ai.call' && act.every((a) => a.actor_type === 'ai'), (act ?? []).map((a) => a.action).join());
    const shown = await audit.listAudit({ type: 'ai', actor: 'ai', from: runStart.slice(0, 10), to: '', related: '', includeTest: true, page: 1 });
    check('the audit log shows it under AI calls and actor AI', shown.rows.some((x) => x.action === 'ai.call' && x.metadata?.usage_id === r.usageId));
    const hidden = await audit.listAudit({ type: 'ai', actor: '', from: runStart.slice(0, 10), to: '', related: '', includeTest: false, page: 1 });
    check('test calls are hidden from the audit log by default', !hidden.rows.some((x) => x.actor_id === agent));
    const { error: paid } = await svc.from('growth_ai_usage').insert({ is_test: true, agent, provider: 'mock', is_mock: true, model: 'mock', cost_usd: 1, status: 'succeeded' });
    check('the database refuses a mock call with a cost', paid?.code === '23514');

    // Knowledge Base gate.
    r = await run.runAi(ask({ requireKnowledge: true, requireKnowledgeKinds: ['faq'] }), opts);
    check('an agent needing approved FAQs is refused while there are none', !r.ok && r.reason === 'kb_not_ready' && r.message.includes('faq'), JSON.stringify(r));

    // Priced calls with a stand-in provider: USD 5 each at Opus 5 rates.
    let sent = 0;
    const counting = async () => { sent++; return true; };
    const failing = async () => false;
    const priced = (over = {}) => ({ name: 'anthropic', isMock: false, async call() { return { text: 'priced answer', model: 'claude-opus-5', inputTokens: 1_000_000, outputTokens: 0, cacheWriteTokens: 0, cacheReadTokens: 0, refused: false, ...over }; } });
    r = await run.runAi(ask(), { ...opts, provider: priced(), alertSender: counting });
    check('a priced call costs USD 5 and is recorded as real', r.ok && r.costUsd === 5 && !r.mock, JSON.stringify(r));
    check('USD 5 of 10 (50%) sends no alert', sent === 0);
    r = await run.runAi(ask(), { ...opts, provider: priced(), alertSender: failing });
    check('the second call brings spend to USD 10', r.ok && (await run.monthSpend({ isTest: true })).spentUsd === 10);
    const { count: afterFail } = await svc.from('growth_ai_alerts').select('id', { count: 'exact' }).eq('is_test', true);
    check('a failed alert send releases the month so it can be retried', afterFail === 0, String(afterFail));
    const settingsNow = (await settingsLib.getGrowthSettings(TEST_ROW)).settings;
    const alert = (sender) => run.maybeSendBudgetAlert({ isTest: true, budgetUsd: settingsNow.ai_monthly_budget_usd, thresholdPct: settingsNow.ai_alert_threshold_pct, recipient: settingsNow.ai_alert_email, spentUsd: 10, sender });
    check('the alert then sends', (await alert(counting)) === 'sent' && sent === 1);
    check('a second attempt the same month does not send', (await alert(counting)) === 'already_sent' && sent === 1);
    const [a1, a2] = await Promise.all([alert(counting), alert(counting)]);
    check('two attempts at once still send nothing more', a1 === 'already_sent' && a2 === 'already_sent' && sent === 1);
    const { data: alertRow } = await svc.from('growth_ai_alerts').select('status, month, threshold_pct').eq('is_test', true).single();
    check('the alert is recorded as sent for this Riyadh month', alertRow?.status === 'sent' && alertRow?.month === pricing.riyadhMonth().key && alertRow?.threshold_pct === 80);
    const { data: alertLog } = await svc.from('growth_activity').select('action').eq('is_test', true).eq('action', 'ai.budget_alert').gte('created_at', runStart);
    check('the alert is in the activity log once', (alertLog ?? []).length === 1);
    r = await run.runAi(ask(), { ...opts, provider: priced(), alertSender: counting });
    check('a reached budget refuses the call, with a clear message', !r.ok && r.reason === 'budget_reached' && /budget of USD 10.00 is reached/.test(r.message), JSON.stringify(r));
    check('still only one alert sent', sent === 1);

    // Other failures, recorded.
    await settingsLib.updateGrowthSettings({ ...settingsNow, ai_monthly_budget_usd: 1000 }, actor, { rowId: TEST_ROW });
    r = await run.runAi(ask({ model: 'claude-unknown' }), { ...opts, provider: priced() });
    check('an unpriced model is refused', !r.ok && r.reason === 'unknown_model');
    r = await run.runAi(ask(), { ...opts, provider: { name: 'anthropic', isMock: false, async call() { throw new Error('connection reset'); } } });
    check('a provider failure is recorded as failed', !r.ok && r.reason === 'provider_error' && Boolean(r.usageId));
    r = await run.runAi(ask(), { ...opts, provider: priced({ text: '', refused: true, inputTokens: 10, outputTokens: 0 }) });
    check('a model refusal is recorded and not returned as text', !r.ok && r.reason === 'model_refused' && Boolean(r.usageId));
    const { data: statuses } = await svc.from('growth_ai_usage').select('status').eq('agent', agent).eq('is_test', true);
    check('every call, refused and failed included, is recorded', (statuses ?? []).length === 9, String(statuses?.length));

    // Riyadh month edges.
    const month = pricing.riyadhMonth();
    const spentBefore = (await run.monthSpend({ isTest: true })).spentUsd;
    await svc.from('growth_ai_usage').insert([
      { is_test: true, agent, provider: 'anthropic', is_mock: false, model: 'claude-opus-5', cost_usd: 100, status: 'succeeded', created_at: new Date(month.start.getTime() - 1000).toISOString() },
      { is_test: true, agent, provider: 'anthropic', is_mock: false, model: 'claude-opus-5', cost_usd: 1, status: 'succeeded', created_at: month.start.toISOString() },
    ]);
    const spentAfter = (await run.monthSpend({ isTest: true })).spentUsd;
    check('spend counts the first second of the Riyadh month and not the last second of the one before', Math.abs(spentAfter - spentBefore - 1) < 1e-9, `${spentBefore} to ${spentAfter}`);
    check('real spend is untouched by test calls', (await run.monthSpend({ isTest: false })).spentUsd === realSpendBefore.spentUsd);

    // Shared email domains.
    const shared = await sup.addSuppression({ kind: 'domain', value: 'gmail.com', reason: 'test' }, actor, { isTest: true });
    check('a shared email domain is not suppressed without confirmation', !shared.ok && shared.code === 'shared_domain' && shared.status === 409);
    const suffix = await sup.addSuppression({ kind: 'domain', value: 'com.sa', reason: 'test', confirmSharedDomain: true }, actor, { isTest: true });
    check('a public suffix is refused even when confirmed', !suffix.ok && suffix.code === 'public_suffix');
    const confirmed = await sup.addSuppression({ kind: 'domain', value: 'gmail.com', reason: 'Verifier: confirmed shared domain', confirmSharedDomain: true }, actor, { isTest: true });
    check('a shared domain can be suppressed once confirmed', confirmed.ok);

    // The anon key.
    const anonUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (anonUrl && anonKey) {
      const anon = createClient(anonUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
      for (const t of ['growth_ai_usage', 'growth_ai_alerts']) {
        const { data, error } = await anon.from(t).select('*').limit(5);
        check(`anon cannot read ${t}`, Boolean(error) || (Array.isArray(data) && data.length === 0));
      }
    } else check('anon key available', false);
  } finally {
    await cleanup();
    const counts = await Promise.all([
      svc.from('growth_ai_usage').select('id', { count: 'exact' }).eq('is_test', true),
      svc.from('growth_ai_alerts').select('id', { count: 'exact' }).eq('is_test', true),
      svc.from('growth_activity').select('id', { count: 'exact' }).eq('is_test', true),
      svc.from('growth_suppressions').select('id', { count: 'exact' }).eq('is_test', true),
      svc.from('growth_settings').select('id', { count: 'exact' }),
    ]);
    check('no test rows remain; only the real settings row', counts[0].count === 0 && counts[1].count === 0 && counts[2].count === 0 && counts[3].count === 0 && counts[4].count === 1, counts.map((c) => c.count).join(','));
    const { data: realAfter } = await svc.from('growth_settings').select('*').eq('id', 1).single();
    check('the real settings row is untouched, field for field', JSON.stringify(realAfter) === JSON.stringify(realRow));
  }
}

console.log(`\n${checks - failures} of ${checks} checks passed.`);
if (failures) {
  console.log(`${failures} FAILED`);
  process.exit(1);
}
