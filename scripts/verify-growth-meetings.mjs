// scripts/verify-growth-meetings.mjs
//
// Proves Phase 5, Meetings (Units 5.1 to 5.3, migration 091):
//
//   1. Offline, always: Bookings needs all five variables and is otherwise a
//      labelled preview that saves nothing, the outcome to stage mapping, the
//      mock brief, recap and no-show samples through the parser, migration
//      091 and the gates.
//   2. Only with --write-test-rows, once 091 is applied: a call added by hand
//      moves its lead to Meeting Booked and counts as engagement; an attendee
//      not on file becomes a contact and lead; briefs and drafts refuse
//      without approved knowledge or a budget (nothing saved); an outcome
//      needs the call held (code and database); a proposal request moves the
//      lead to Proposal; a recap needs a held call and a rebooking a no-show.
//
//   npm run verify-growth-meetings
//   npm run verify-growth-meetings -- --write-test-rows

import { WRITE, adminOnlyGates, check, dashed, finish, load, markPending, migrationChecks, publicChanges, read, serviceClient, tableReady, walk } from './lib/growthVerify.mjs';

const graph = await load('src/lib/growth/graph.ts');
const meet = await load('src/lib/growth/meetings.ts');
const mock = await load('src/lib/growth/ai/mock.ts');
const json = await load('src/lib/growth/agents/json.ts');
const integ = await load('src/lib/growth/integrations.ts');

console.log('1. Rules (offline)');
const all = { MS_GRAPH_TENANT_ID: 'x', MS_GRAPH_CLIENT_ID: 'x', MS_GRAPH_CLIENT_SECRET: 'x', MS_GRAPH_SENDER: 'a@b.co', MS_BOOKINGS_BUSINESS_ID: 'x' };
check('Bookings needs all five variables', graph.graphBookingsConfigured(all) && !graph.graphBookingsConfigured({ ...all, MS_BOOKINGS_BUSINESS_ID: '' }) && !graph.graphBookingsConfigured({}));
check('mail needs the four Graph variables only', graph.graphMailConfigured({ ...all, MS_BOOKINGS_BUSINESS_ID: undefined }));
const by = (k, list) => list.find((i) => i.key === k);
check('Bookings shows Mock mode without its variables and Configured with them', by('microsoft_bookings', integ.integrationStatus({})).state === 'mock' && by('microsoft_bookings', integ.integrationStatus(all)).state === 'configured');
if (!graph.graphBookingsConfigured()) {
  const sync = await meet.syncBookings({});
  check('without Bookings the sync is a preview that saves nothing', sync.ok && sync.value.mode === 'mock_preview' && sync.value.created === 0 && sync.value.preview.length > 0 && sync.value.preview.every((p) => p.customerEmail.endsWith('example.invalid')));
} else console.log('  Bookings is configured here: the preview check does not apply.');
const stage = (o) => meet.MEETING_OUTCOMES.find((x) => x.value === o).stage;
check('outcomes move the lead: positive to Opportunity, proposal to Proposal, not a fit to Lost', stage('positive') === 'opportunity' && stage('proposal_requested') === 'proposal' && stage('not_a_fit') === 'lost' && stage('other') === null);
for (const purpose of ['meeting_brief', 'meeting_recap', 'no_show']) {
  const r = await mock.mockProvider.call({ model: 'mock', messages: [{ role: 'user', content: 'x' }], maxTokens: 1500, purpose, agent: 'x' });
  const parsed = json.extractJsonObject(r.text);
  check(`the mock ${purpose.replace('_', ' ')} is labelled and readable`, r.text.startsWith(mock.MOCK_LABEL) && parsed && (purpose === 'meeting_brief' ? Array.isArray(parsed.open_questions) && parsed.next_action : typeof parsed.body === 'string'));
}
{
  const sql = migrationChecks('091_growth_meetings.sql', ['growth_meetings']);
  check('091: an outcome needs the call held', sql.includes("CHECK (outcome IS NULL OR status = 'completed')"));
  check('091: one row per Bookings appointment', sql.includes('ON growth_meetings (external_id) WHERE external_id IS NOT NULL'));
  check('091: a mock row is never a Bookings row', sql.includes("CHECK (NOT (is_mock AND source = 'bookings'))"));
  check('091: the bookings link is https or empty', sql.includes("bookings_url = '' OR bookings_url ~* '^https://"));
  const src = read('src/lib/growth/meetings.ts');
  check('test and mock meetings never alert', src.includes('if (m.is_test || m.is_mock) return;'));
  check('the daily run syncs Bookings and prepares briefs', /bookings-sync[\s\S]*meeting-briefs/.test(read('src/lib/growth/daily.ts')));
  adminOnlyGates();
  const files = [...walk('src/lib/growth'), ...walk('src/app/admin/growth'), ...walk('src/app/api/admin/growth'), ...walk('src/components/admin/growth'), 'supabase/migrations/091_growth_meetings.sql', 'scripts/verify-growth-meetings.mjs'];
  const d = dashed(files);
  check('no em or en dash in any Growth file', d.length === 0, d.join(', '));
  const pub = publicChanges(['src/app/(public)/layout.tsx']);
  check('the public site is untouched apart from the inert chat mount', pub.length === 0, pub.join(', '));
}

console.log('2. Live database, test rows');
const svc = serviceClient();
if (!svc) console.log('  SKIP  no SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
else if (!(await tableReady(svc, 'growth_meetings'))) markPending('live meetings, matching, outcomes and drafts', '091_growth_meetings.sql');
else if (!WRITE) console.log('  Write phase skipped (pass --write-test-rows to run it).');
else await live(svc);

async function live(svc) {
  const pros = await load('src/lib/growth/prospects.ts');
  const tag = `ZZ-GROWTH-P5-${Date.now()}`;
  const actor = { id: 'verify-growth-meetings', name: 'Meetings verifier' };
  const started = new Date(Date.now() - 1000).toISOString();
  async function cleanup() {
    const { data: ms } = await svc.from('growth_meetings').select('id, lead_id, contact_id, company_id').eq('is_test', true).gte('created_at', started);
    const { data: cos } = await svc.from('growth_companies').select('id').eq('is_test', true).like('name', 'ZZ-GROWTH-P5-%');
    const { data: cts } = await svc.from('growth_contacts').select('id').eq('is_test', true).like('email', 'zz-growth-p5-%');
    const leadIds = [...new Set((ms ?? []).map((m) => m.lead_id).filter(Boolean))];
    const contactIds = [...new Set([...(ms ?? []).map((m) => m.contact_id).filter(Boolean), ...(cts ?? []).map((c) => c.id)])];
    const companyIds = [...new Set([...(cos ?? []).map((c) => c.id)])];
    const { data: moreLeads } = contactIds.length ? await svc.from('growth_leads').select('id').in('contact_id', contactIds) : { data: [] };
    const allLeads = [...new Set([...leadIds, ...(moreLeads ?? []).map((l) => l.id)])];
    if ((ms ?? []).length) {
      await svc.from('growth_messages').delete().eq('is_test', true).in('meeting_id', ms.map((m) => m.id));
      await svc.from('growth_meetings').delete().eq('is_test', true).in('id', ms.map((m) => m.id));
    }
    await svc.from('growth_activity').delete().eq('is_test', true).gte('created_at', started);
    if (allLeads.length) {
      await svc.from('growth_ai_usage').delete().eq('is_test', true).in('lead_id', allLeads);
      await svc.from('growth_activity').delete().eq('is_test', true).in('lead_id', allLeads);
      await svc.from('growth_leads').delete().eq('is_test', true).in('id', allLeads);
    }
    if (companyIds.length) await svc.from('growth_ai_usage').delete().eq('is_test', true).in('company_id', companyIds);
    if (contactIds.length) {
      await svc.from('growth_activity').delete().eq('is_test', true).in('contact_id', contactIds);
      await svc.from('growth_contacts').delete().eq('is_test', true).in('id', contactIds);
    }
    if (companyIds.length) {
      await svc.from('growth_activity').delete().eq('is_test', true).in('company_id', companyIds);
      await svc.from('growth_companies').delete().eq('is_test', true).in('id', companyIds);
    }
  }
  await cleanup();
  try {
    const co = await pros.createCompany({ name: `${tag} Co`, sector: 'Real estate', country: 'Saudi Arabia' }, actor, { isTest: true });
    const ct = await pros.createContact(co.value.id, { full_name: 'Test Attendee', email: `zz-growth-p5-${Date.now()}@example.invalid`, is_decision_maker: true }, actor, { isTest: true });
    const ld = await pros.createLead(co.value.id, { title: `${tag} lead`, contact_id: ct.value.id, stage: 'replied', deal_size_sar: 200_000_000 }, actor, { isTest: true });
    const when = new Date(Date.now() + 2 * 86_400_000).toISOString();
    const m = await meet.createManualMeeting({ lead_id: ld.value.id, starts_at: when }, actor, { isTest: true });
    const { data: leadAfter } = await svc.from('growth_leads').select('stage, lead_score, lead_temperature').eq('id', ld.value.id).single();
    check('a call added by hand moves the lead to Meeting Booked', m.ok && leadAfter.stage === 'meeting_booked');
    check('a booked call is engagement: the Lead Score is set', typeof leadAfter.lead_score === 'number');
    check('the attendee is taken from the lead contact', m.value.attendee_name === 'Test Attendee' && m.value.attendee_email?.startsWith('zz-growth-p5-'));
    const fresh = await meet.createManualMeeting({ attendee_name: 'New Person', attendee_email: `zz-growth-p5-new-${Date.now()}@example.invalid`, starts_at: when }, actor, { isTest: true });
    const { data: newContact } = fresh.ok && fresh.value.contact_id ? await svc.from('growth_contacts').select('consent_source').eq('id', fresh.value.contact_id).single() : { data: null };
    const { data: newLead } = fresh.ok && fresh.value.lead_id ? await svc.from('growth_leads').select('stage, source').eq('id', fresh.value.lead_id).single() : { data: null };
    check('an attendee not on file becomes a contact and a Meeting Booked lead', newContact?.consent_source === 'Booked a call with Ahmad' && newLead?.stage === 'meeting_booked');
    const brief = await meet.generateBrief(m.value.id, { actor });
    const { data: noBrief } = await svc.from('growth_meetings').select('brief').eq('id', m.value.id).single();
    check('without approved services or a budget the brief is refused and nothing saved', !brief.ok && noBrief.brief === null);
    const early = await meet.draftMeetingEmail(m.value.id, 'recap', actor);
    check('a recap needs the call held first', !early.ok && early.status === 409);
    const noOutcome = await meet.recordOutcome(m.value.id, { status: 'completed' }, actor);
    check('a held call needs an outcome', !noOutcome.ok && noOutcome.status === 422);
    const { error: dbOutcome } = await svc.from('growth_meetings').update({ outcome: 'positive' }).eq('id', m.value.id).eq('is_test', true);
    check('the database refuses an outcome before the call is held', dbOutcome?.code === '23514');
    const held = await meet.recordOutcome(m.value.id, { status: 'completed', outcome: 'proposal_requested', notes: 'Wants a proposal for a feasibility update' }, actor);
    const { data: prop } = await svc.from('growth_leads').select('stage').eq('id', ld.value.id).single();
    check('a proposal request moves the lead to Proposal', held.ok && prop.stage === 'proposal');
    const recap = await meet.draftMeetingEmail(m.value.id, 'recap', actor);
    check('the recap draft refuses without approved messaging or a budget', !recap.ok && ['kb_not_ready', 'no_budget'].includes(recap.code));
    const ns = await meet.recordOutcome(fresh.value.id, { status: 'no_show' }, actor);
    const nsDraft = await meet.draftMeetingEmail(fresh.value.id, 'no_show', actor);
    check('a no-show is recorded and its rebooking draft goes through the same AI rules', ns.ok && ns.value.status === 'no_show' && !nsDraft.ok && nsDraft.code);
    const notFit = await meet.recordOutcome(fresh.value.id, { status: 'completed', outcome: 'not_a_fit' }, actor);
    check('not a fit needs a reason', !notFit.ok);
  } finally {
    await cleanup();
    const { count } = await svc.from('growth_meetings').select('id', { count: 'exact', head: true }).eq('is_test', true).gte('created_at', started);
    check('every test row removed', count === 0);
  }
}

finish('verify-growth-meetings');
