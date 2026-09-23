// scripts/verify-growth-outreach.mjs
//
// Proves Phase 3, Outreach and Pipeline (Units 3.1 to 3.5, migration 089):
//
//   1. Offline, always: the sending window and daily cap in Riyadh time,
//      follow-up timing, placeholder checks, the email body (tracked link and
//      opt-out line on the site's own domain, HTML escaped), reply opt-out
//      words, safe redirect paths, the Lead Score (meeting request always Hot,
//      the SAR 50 million cap wins, engagement required), the mock drafts
//      through the real parser, migration 089 and the static gates.
//   2. Only with --write-test-rows, once 089 is applied: with is_test rows
//      only, a draft is approved (placeholders refused first), scheduled when
//      outside the window, sent in mock mode inside it (nothing delivered, the
//      lead not marked contacted, the sequence started), refused for a
//      suppressed address, a mock draft refused for real sending by the
//      database, a tracked click recorded and scored, a reply stopping the
//      sequence, an opt-out suppressing the contact, a lost opportunity needing
//      a reason, and tasks. Everything is removed afterwards.
//
//   npm run verify-growth-outreach
//   npm run verify-growth-outreach -- --write-test-rows

import { randomUUID } from 'node:crypto';

import { WRITE, adminOnlyGates, check, dashed, finish, load, markPending, migrationChecks, publicChanges, read, serviceClient, tableReady, walk } from './lib/growthVerify.mjs';

const om = await load('src/lib/growth/outreachModel.ts');
const lead = await load('src/lib/growth/scoring/lead.ts');
const links = await load('src/lib/growth/links.ts');
const mock = await load('src/lib/growth/ai/mock.ts');
const json = await load('src/lib/growth/agents/json.ts');
const out = await load('src/lib/growth/outreach.ts');
const eng = await load('src/lib/growth/engineSettingsModel.ts');

const S = { send_days: [0, 1, 2, 3, 4], send_start: '09:00', send_end: '17:00', daily_cold_email_cap: 10, follow_up_days: [4, 10, 20], max_follow_ups: 3 };
// 2026-09-27 is a Sunday. Riyadh is UTC+3.
const at = (iso) => new Date(iso);

console.log('1. Sending window, cap and follow-ups (offline)');
check('Sunday 10:00 Riyadh is inside the window', om.inSendingWindow(S, at('2026-09-27T07:00:00Z')));
check('Sunday 08:59 and 17:00 Riyadh are outside', !om.inSendingWindow(S, at('2026-09-27T05:59:00Z')) && !om.inSendingWindow(S, at('2026-09-27T14:00:00Z')));
check('Friday is outside', !om.inSendingWindow(S, at('2026-09-25T07:00:00Z')));
check('after Thursday 17:00 the next window is Sunday 09:00 Riyadh', om.nextWindowStart(S, at('2026-10-01T15:00:00Z')).toISOString() === '2026-10-04T06:00:00.000Z');
check('before 09:00 the next window is the same morning', om.nextWindowStart(S, at('2026-09-27T03:00:00Z')).toISOString() === '2026-09-27T06:00:00.000Z');
const inside = at('2026-09-27T07:00:00Z');
check('inside the window and under the cap: send', om.sendDecision(S, 3, inside, { paused: false, counts: true }).action === 'send');
const capped = om.sendDecision(S, 10, inside, { paused: false, counts: true });
check("at the cap: wait for tomorrow's window", capped.action === 'schedule' && capped.at.toISOString() === '2026-09-28T06:00:00.000Z');
check('the cap does not apply to a recap', om.sendDecision(S, 10, inside, { paused: false, counts: false }).action === 'send');
check('paused refuses', om.sendDecision(S, 0, inside, { paused: true, counts: true }).action === 'refuse');
check('follow-ups on days 4, 10 and 20 after the first send', om.followUpDue('2026-09-27T07:00:00Z', 1, S).toISOString() === '2026-10-01T07:00:00.000Z' && om.followUpDue('2026-09-27T07:00:00Z', 3, S).toISOString() === '2026-10-17T07:00:00.000Z');
check('no follow-up beyond the maximum', om.followUpDue('2026-09-27T07:00:00Z', 4, S) === null && om.followUpDue('2026-09-27T07:00:00Z', 2, { ...S, max_follow_ups: 1 }) === null);
check('Riyadh day bounds run from 21:00 UTC', om.riyadhDayBounds(inside).start.toISOString() === '2026-09-26T21:00:00.000Z');

console.log('2. Message rules (offline)');
check('placeholders other than [Link] block approval', JSON.stringify(om.unresolvedPlaceholders('Dear [First name], see [Link] about [Project]')) === JSON.stringify(['[First name]', '[Project]']));
check('known placeholders are filled', out.fillKnown('Dear [First name] at [Company], [Sender]', { firstName: 'Sara', company: 'Acme' }) === 'Dear Sara at Acme, Ahmad Din');
const e = om.buildEmail({ body: 'Hello <b>there</b>\n\nRead [Link]', linkUrl: om.trackedUrl('tok123'), optOutUrl: om.optOutUrl('opt456') });
check('the link placeholder becomes the tracked link', e.text.includes('https://www.pacemakersglobal.com/api/growth/l/tok123') && !e.text.includes('[Link]'));
check('every email ends with the opt-out line and link', e.text.includes(om.OPT_OUT_LINE) && e.html.includes('https://www.pacemakersglobal.com/api/growth/o/opt456'));
check('HTML is escaped', e.html.includes('&lt;b&gt;there&lt;/b&gt;') && !e.html.includes('<b>there'));
const noPlaceholder = om.buildEmail({ body: 'Hello', linkUrl: om.trackedUrl('abc'), optOutUrl: om.optOutUrl('x') });
check('a draft without a placeholder still carries the link', noPlaceholder.text.includes('/api/growth/l/abc'));
check('stop words in a reply are an opt-out', ['Please unsubscribe me', 'remove me from your list', 'Opt out', 'do not contact us again'].every((t) => om.OPT_OUT_REPLY.test(t)) && !om.OPT_OUT_REPLY.test('Happy to talk, subscribe me to updates'));
check('redirects stay on the site', links.safeSitePath('/services/refm') === '/services/refm' && links.safeSitePath('//evil.example') === '/' && links.safeSitePath('https://evil.example') === '/' && links.safeSitePath('/\\evil') === '/');
check('rejecting needs a reason', !om.messageActionSchema.safeParse({ action: 'reject', reason: '' }).success);
for (const purpose of ['outreach_email', 'outreach_linkedin', 'outreach_follow_up']) {
  const r = await mock.mockProvider.call({ model: 'mock', messages: [{ role: 'user', content: 'x' }], maxTokens: 1500, purpose, agent: 'outreach-writer' });
  const parsed = json.extractJsonObject(r.text);
  check(`the mock ${purpose.replace('outreach_', '')} draft is labelled and readable`, r.text.startsWith(mock.MOCK_LABEL) && typeof parsed?.body === 'string' && parsed.body.length > 20);
}
check('relevant page: the lead service, else the company service, else /services', out.relevantPath({ recommended_service: 'refm' }, { likely_service: 'business-valuation' }) === '/services/refm' && out.relevantPath({ recommended_service: null }, { likely_service: 'business-valuation' }) === '/services/business-valuation' && out.relevantPath({ recommended_service: null }, null) === '/services');

console.log('3. Lead Score (offline)');
{
  const base = { lead: { requirement: 'Lender-ready development model for a 400 unit project', recommended_service: 'refm', deal_size_sar: 300_000_000, timeline: 'within 2 months', stage: 'replied' }, company: { country: 'Saudi Arabia', city: 'Riyadh', sector: 'Real estate' }, contact: { is_decision_maker: true, role_title: 'CFO' }, engagement: { replied: true, clicks: 1, chats: 0, meetings: 0 } };
  const hot = lead.scoreLead(base);
  check('a KSA real estate CFO who replied, with need, size and timeline, is Hot', hot.temperature === 'hot' && hot.score >= 71 && hot.engaged, `${hot.score}`);
  check('thresholds: Hot 71, Warm 41 to 70, Cold 40 and under', lead.temperatureFor(71) === 'hot' && lead.temperatureFor(70) === 'warm' && lead.temperatureFor(41) === 'warm' && lead.temperatureFor(40) === 'cold');
  const weak = lead.scoreLead({ ...base, lead: { ...base.lead, requirement: null, recommended_service: null, deal_size_sar: null, timeline: null, meeting_requested: true }, company: null, contact: null, engagement: { replied: false, clicks: 0, chats: 0, meetings: 0 } });
  check('a meeting request is always Hot', weak.temperature === 'hot' && weak.score >= 71 && weak.reasons.some((r) => r.includes('meeting')));
  const small = lead.scoreLead({ ...base, lead: { ...base.lead, deal_size_sar: 20_000_000, meeting_requested: true } });
  check('under SAR 50 million caps at Cold, even with a meeting request', small.temperature === 'cold' && small.score <= 40 && small.reasons[0].includes('SAR 50 million'));
  const quiet = lead.scoreLead({ ...base, lead: { ...base.lead, stage: 'contacted' }, engagement: { replied: false, clicks: 0, chats: 0, meetings: 0 } });
  check('no engagement: not scored yet', quiet.engaged === false);
  check('timelines are read from plain words', lead.timelineMonths('decision within 3 months') === 3 && lead.timelineMonths('ASAP') === 0.5 && lead.timelineMonths('next quarter') === 3 && lead.timelineMonths('') === null && lead.timelineMonths('6 weeks') < 2);
  check('lead weights default 25, 20, 15, 15, 10, 10, 5 and must sum to 100', eng.DEFAULT_LEAD_WEIGHTS.icp_fit === 25 && eng.DEFAULT_LEAD_WEIGHTS.meeting_intent === 5 && eng.leadWeightsSchema.safeParse(eng.DEFAULT_LEAD_WEIGHTS).success && !eng.leadWeightsSchema.safeParse({ ...eng.DEFAULT_LEAD_WEIGHTS, icp_fit: 30 }).success);
}

console.log('4. Migration 089 and static gates (offline)');
{
  const sql = migrationChecks('089_growth_outreach.sql', ['growth_messages', 'growth_tracked_links', 'growth_link_clicks', 'growth_opportunities', 'growth_tasks']);
  check('089: a mock draft can never be sent for real', sql.includes("CHECK (NOT (is_mock_ai AND send_mode IN ('graph', 'brevo')))"));
  check('089: a tracked link can only point at a site path', sql.includes("CHECK (target_path ~ '^/([^/].*)?$')"));
  check('089: rejection and lost need a reason', sql.includes('growth_messages_rejection_needs_reason') && sql.includes('growth_opportunities_lost_needs_reason'));
  check('089: a sent message records when and how', sql.includes('growth_messages_send_recorded'));
  check('089: every status change logged by trigger', sql.includes('AFTER INSERT OR UPDATE ON growth_messages'));
  check('089: lead weights checked to sum to 100', sql.includes('growth_lead_weights_ok'));
  adminOnlyGates();
  const optRoute = read('src/app/api/growth/o/[token]/route.ts');
  check('the opt-out link only acts on POST, so a mail scanner cannot trigger it', !/export async function GET[\s\S]*optOut\(/.test(optRoute.split('export async function POST')[0]) && optRoute.includes('export async function POST'));
  const linkRoute = read('src/app/api/growth/l/[token]/route.ts');
  check('the tracked link redirects on the same origin only', linkRoute.includes('new URL(path, origin)') && read('src/lib/growth/links.ts').includes('safeSitePath(link.target_path)'));
  check('the tracked-link cookie is httpOnly and secure', linkRoute.includes('httpOnly: true, secure: true'));
  const sender = read('src/lib/growth/outreach.ts');
  check('every send checks suppression first', /const sup = await checkSuppression\(contact\.email\);\s*\n\s*if \(sup\.suppressed\)/.test(sender));
  check('a mock draft is refused before any real send', sender.includes("if (real && m.is_mock_ai) return"));
  check('the Growth cron checks replies before drafting follow-ups and sending', /reply-check[\s\S]*follow-up-drafts[\s\S]*scheduled-sends/.test(read('src/lib/growth/daily.ts')));
  const files = [...walk('src/lib/growth'), ...walk('src/app/admin/growth'), ...walk('src/app/api/admin/growth'), ...walk('src/app/api/growth'), ...walk('src/components/admin/growth'), 'supabase/migrations/089_growth_outreach.sql', 'scripts/verify-growth-outreach.mjs'];
  const d = dashed(files);
  check('no em or en dash in any Growth file', d.length === 0, d.join(', '));
  const pub = publicChanges();
  check('the public site is untouched since Phase 1', pub.length === 0, pub.join(', '));
}

console.log('5. Live database, test rows');
const svc = serviceClient();
if (!svc) console.log('  SKIP  no SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
else if (!(await tableReady(svc, 'growth_messages'))) markPending('live drafts, approval, sending, clicks, replies, opt-out and pipeline', '089_growth_outreach.sql');
else if (!WRITE) console.log('  Write phase skipped (pass --write-test-rows to run it).');
else await live(svc);

async function live(svc) {
  const pros = await load('src/lib/growth/prospects.ts');
  const sigs = await load('src/lib/growth/signals.ts');
  const pipe = await load('src/lib/growth/pipeline.ts');
  const tag = `ZZ-GROWTH-P3-${randomUUID().slice(0, 8)}`;
  const email = `zz-growth-p3-${tag.toLowerCase()}@example.invalid`;
  const actor = { id: 'verify-growth-outreach', name: 'Outreach verifier' };
  const started = new Date(Date.now() - 1000).toISOString();
  const ids = { company: null, contact: null, lead: null };

  async function cleanup() {
    const { data: cos } = await svc.from('growth_companies').select('id').eq('is_test', true).like('name', 'ZZ-GROWTH-P3-%');
    const co = (cos ?? []).map((c) => c.id);
    if (!co.length) return;
    const { data: lds } = await svc.from('growth_leads').select('id').in('company_id', co);
    const ld = (lds ?? []).map((l) => l.id);
    const { data: cts } = await svc.from('growth_contacts').select('id, email').in('company_id', co);
    const ct = (cts ?? []).map((c) => c.id);
    const { data: lks } = ld.length ? await svc.from('growth_tracked_links').select('id').in('lead_id', ld) : { data: [] };
    const lk = (lks ?? []).map((l) => l.id);
    if (lk.length) await svc.from('growth_link_clicks').delete().eq('is_test', true).in('link_id', lk);
    if (ld.length) {
      await svc.from('growth_tracked_links').delete().eq('is_test', true).in('lead_id', ld);
      await svc.from('growth_messages').delete().eq('is_test', true).in('lead_id', ld);
      await svc.from('growth_opportunities').delete().eq('is_test', true).in('lead_id', ld);
      await svc.from('growth_tasks').delete().eq('is_test', true).in('lead_id', ld);
      await svc.from('growth_ai_usage').delete().eq('is_test', true).in('lead_id', ld);
    }
    await svc.from('growth_ai_usage').delete().eq('is_test', true).in('company_id', co);
    await svc.from('growth_activity').delete().eq('is_test', true).gte('created_at', started);
    for (const [col, list] of [['company_id', co], ['lead_id', ld], ['contact_id', ct]]) if (list.length) await svc.from('growth_activity').delete().eq('is_test', true).in(col, list);
    const emails = (cts ?? []).map((c) => c.email).filter(Boolean);
    if (emails.length) await svc.from('growth_suppressions').delete().eq('is_test', true).in('value', emails);
    await svc.from('growth_signals').delete().eq('is_test', true).in('company_id', co);
    if (ld.length) await svc.from('growth_leads').delete().eq('is_test', true).in('id', ld);
    await svc.from('growth_contacts').delete().eq('is_test', true).in('company_id', co);
    await svc.from('growth_companies').delete().eq('is_test', true).in('id', co);
  }

  await cleanup();
  try {
    const co = await pros.createCompany({ name: `${tag} Developer`, sector: 'Real estate', city: 'Riyadh', country: 'Saudi Arabia', likely_service: 'refm' }, actor, { isTest: true });
    ids.company = co.value.id;
    const ct = await pros.createContact(ids.company, { full_name: `${tag} Sara Person`, role_title: 'CFO', email, is_decision_maker: true }, actor, { isTest: true });
    ids.contact = ct.value.id;
    const ld = await pros.createLead(ids.company, { title: `${tag} lead`, contact_id: ids.contact, recommended_service: 'refm', deal_size_sar: 300_000_000 }, actor, { isTest: true });
    ids.lead = ld.value.id;
    const sg = await sigs.createSignal({ trigger_type: 'off_plan_registration', signal_date: '2026-09-20', summary: `${tag} registered a project`, evidence_url: `https://www.argaam.com/zz/${tag}`, company_id: ids.company }, actor, { isTest: true });
    check('test lead, contact and signal created', co.ok && ct.ok && ld.ok && sg.ok);
    check('the lead cites a real trigger', (await out.citableSignal(ids.company, ids.lead))?.id === sg.value.id);

    const draft = await out.draftOutreach(ids.lead, 'email', actor, { isTest: true });
    check('drafting refuses until the Knowledge Base messaging and disallowed rules are approved (or the budget is set)', !draft.ok && ['kb_not_ready', 'no_budget'].includes(draft.code), draft.ok ? 'drafted' : draft.code);

    const { data: m0 } = await svc.from('growth_messages').insert({ is_test: true, lead_id: ids.lead, company_id: ids.company, contact_id: ids.contact, signal_id: sg.value.id, channel: 'email', kind: 'initial', subject: 'Your registered project', body: 'Dear [First name],\n\nI read about your registration. [Link]\n\nAhmad Din', link_path: '/services/refm', is_mock_ai: true, status: 'draft' }).select('*').single();
    check('a draft row is logged by the trigger', Boolean(m0) && ((await svc.from('growth_activity').select('id').eq('lead_id', ids.lead).eq('action', 'outreach.draft')).data ?? []).length === 1);
    const blocked = await out.actOnMessage(m0.id, { action: 'approve' }, actor);
    check('approval is refused while a placeholder is left', !blocked.ok && blocked.code === 'placeholders');
    await out.editMessage(m0.id, { subject: 'Your registered project', body: 'Dear Sara,\n\nI read about your registration. [Link]\n\nAhmad Din' }, actor);
    const approved = await out.actOnMessage(m0.id, { action: 'approve' }, actor);
    check('approved once filled, with who and when', approved.ok && approved.value.status === 'approved' && approved.value.approved_by_name === actor.name);
    const outside = await out.sendMessage(m0.id, { now: at('2026-09-25T07:00:00Z') });
    check('outside the window it is scheduled for the next window', outside.ok && outside.value.status === 'scheduled' && outside.value.scheduled_for.startsWith('2026-09-27T06:00'));
    const sent = await out.sendMessage(m0.id, { now: at('2026-09-27T07:00:00Z') });
    check('inside the window it is sent in mock mode: nothing delivered', sent.ok && sent.value.status === 'sent' && sent.value.send_mode === 'mock');
    const { data: lks } = await svc.from('growth_tracked_links').select('*').eq('message_id', m0.id);
    check('a tracked link and an opt-out link were created', (lks ?? []).some((l) => l.kind === 'link' && l.target_path === '/services/refm') && (lks ?? []).some((l) => l.kind === 'opt_out'));
    const { data: leadAfter } = await svc.from('growth_leads').select('*').eq('id', ids.lead).single();
    check('a mock send starts the sequence but does not mark the lead contacted', leadAfter.sequence_status === 'active' && leadAfter.stage === 'prospect' && leadAfter.next_follow_up_at);
    const { error: realMock } = await svc.from('growth_messages').update({ send_mode: 'graph' }).eq('id', m0.id).eq('is_test', true);
    check('the database refuses a mock draft marked as sent through Graph', realMock?.code === '23514');

    const link = (lks ?? []).find((l) => l.kind === 'link');
    const click = await links.recordClick(link.token, new Headers({ 'x-forwarded-for': '203.0.113.9', 'user-agent': 'verifier' }));
    const { data: clicked } = await svc.from('growth_tracked_links').select('click_count').eq('id', link.id).single();
    const { data: scored } = await svc.from('growth_leads').select('lead_score, lead_temperature').eq('id', ids.lead).single();
    check('a click is recorded and redirects to the page', click.path === '/services/refm' && clicked.click_count === 1);
    check('a click is engagement: the Lead Score is set', typeof scored.lead_score === 'number' && scored.lead_temperature);
    const unknown = await links.recordClick('zz-not-a-real-token-000000', new Headers());
    check('an unknown token goes to the home page', unknown.path === '/' && unknown.link === null);

    const { data: fu } = await svc.from('growth_messages').insert({ is_test: true, lead_id: ids.lead, company_id: ids.company, contact_id: ids.contact, channel: 'email', kind: 'follow_up', sequence_step: 1, subject: 'Following up', body: 'Following up. [Link]', status: 'draft' }).select('*').single();
    const reply = await out.actOnMessage(m0.id, { action: 'mark_replied', note: 'Happy to talk next week' }, actor);
    const { data: afterReply } = await svc.from('growth_leads').select('*').eq('id', ids.lead).single();
    const { data: fuAfter } = await svc.from('growth_messages').select('status').eq('id', fu.id).single();
    check('a reply stops the sequence and cancels the waiting follow-up', reply.ok && afterReply.sequence_status === 'stopped' && afterReply.sequence_stopped_reason === 'replied' && fuAfter.status === 'cancelled');
    check('a reply moves the lead to Replied', afterReply.stage === 'replied');

    const opt = (lks ?? []).find((l) => l.kind === 'opt_out');
    const o = await links.optOut(opt.token);
    const { data: sup } = await svc.from('growth_suppressions').select('*').eq('value', email).is('removed_at', null);
    const { data: ctAfter } = await svc.from('growth_contacts').select('consent_status').eq('id', ids.contact).single();
    check('the opt-out link suppresses the address and marks the contact opted out', o.ok && (sup ?? []).length === 1 && ctAfter.consent_status === 'opted_out');
    const { data: m2 } = await svc.from('growth_messages').insert({ is_test: true, lead_id: ids.lead, company_id: ids.company, contact_id: ids.contact, channel: 'email', kind: 'initial', subject: 'Again', body: 'Hello again. [Link]', status: 'approved', approved_at: new Date().toISOString(), approved_by_name: 'x' }).select('*').single();
    const refused = await out.sendMessage(m2.id, { now: at('2026-09-27T07:00:00Z') });
    check('a suppressed address is never sent to: the message is cancelled', refused.ok && refused.value.status === 'cancelled' && refused.value.cancelled_reason.startsWith('Suppressed'));

    const lost = await pipe.saveOpportunity(ids.lead, null, { service: 'refm', value_band: '250k_500k', status: 'lost', lost_reason: '' }, actor);
    check('a lost opportunity needs a reason', !lost.ok);
    const opp = await pipe.saveOpportunity(ids.lead, null, { service: 'refm', value_band: '250k_500k', status: 'open', expected_close: '2026-12-31' }, actor);
    check('an opportunity opens with service, value band and close date', opp.ok && opp.value.value_band === '250k_500k');
    const { error: dbLost } = await svc.from('growth_opportunities').update({ status: 'lost', lost_reason: null }).eq('id', opp.value.id).eq('is_test', true);
    check('the database also refuses lost without a reason', dbLost?.code === '23514');
    const task = await pipe.createTask({ leadId: ids.lead, title: `${tag} call back`, due_date: '2026-10-01' }, actor);
    const done = await pipe.updateTask(task.value.id, { done: true }, actor);
    check('a task is added and ticked off', task.ok && done.ok && done.value.done_at && done.value.done_by_name === actor.name);
    const list = await pipe.listPipeline({ temperature: '', service: '', source: '', q: tag, includeTest: true, view: 'board' });
    check('the lead shows on the pipeline with its opportunity', list.leads.some((l) => l.id === ids.lead && l.openValue));
  } finally {
    await cleanup();
    const { count } = await svc.from('growth_companies').select('id', { count: 'exact', head: true }).like('name', 'ZZ-GROWTH-P3-%');
    check('every test row removed', count === 0);
  }
}

finish('verify-growth-outreach');
