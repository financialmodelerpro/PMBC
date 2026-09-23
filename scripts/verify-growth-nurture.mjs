// scripts/verify-growth-nurture.mjs
//
// Proves Phase 6, Nurture and Referrals (Units 6.1 to 6.3, migration 092):
//
//   1. Offline, always: nurture is real only with its own list id (the site's
//      Brevo key alone is not enough), Growth events are recognised by their
//      header, the webhook refuses without its token, migration 092, gates.
//   2. Only with --write-test-rows, once 092 is applied: a contact must have
//      opted in to be subscribed (code and database); a step and a lead magnet
//      must be approved (placeholders refused); with nurture off or in mock
//      mode nothing is sent or advanced; Brevo events apply once, an opened
//      event dates the message, an unsubscribe suppresses the address and
//      opts the contact out; partners get a next check-in, a check-in moves
//      it, an introduction opens a lead with the partner as its referral
//      source, and a won introduction wins the lead.
//
//   npm run verify-growth-nurture
//   npm run verify-growth-nurture -- --write-test-rows

import { WRITE, adminOnlyGates, check, dashed, finish, load, markPending, migrationChecks, publicChanges, read, serviceClient, tableReady, walk } from './lib/growthVerify.mjs';

const nurture = await load('src/lib/growth/nurture.ts');
const integ = await load('src/lib/growth/integrations.ts');

console.log('1. Rules (offline)');
check('nurture needs BREVO_API_KEY, EMAIL_FROM_DEFAULT and a numeric GROWTH_BREVO_LIST_ID', nurture.nurtureConfigured({ BREVO_API_KEY: 'k', EMAIL_FROM_DEFAULT: 'a@b.co', GROWTH_BREVO_LIST_ID: '12' }) && !nurture.nurtureConfigured({ BREVO_API_KEY: 'k', EMAIL_FROM_DEFAULT: 'a@b.co' }) && !nurture.nurtureConfigured({ BREVO_API_KEY: 'k', EMAIL_FROM_DEFAULT: 'a@b.co', GROWTH_BREVO_LIST_ID: 'abc' }));
check('Brevo nurture shows Mock mode with only the site Brevo key', integ.integrationStatus({ BREVO_API_KEY: 'k', EMAIL_FROM_DEFAULT: 'a@b.co' }).find((i) => i.key === 'brevo_nurture').state === 'mock');
check('a Growth event is recognised by its header', nurture.growthMessageId({ 'X-Mailin-custom': 'growth:0f8fad5b-d9cb-469f-a165-70867728950e' }) === '0f8fad5b-d9cb-469f-a165-70867728950e' && nurture.growthMessageId({ 'X-Mailin-custom': 'lead:0f8fad5b-d9cb-469f-a165-70867728950e|kind:results' }) === null && nurture.growthMessageId({}) === null);
{
  const route = read('src/app/api/growth/brevo-events/route.ts');
  check('the events webhook refuses without its token, and with a wrong one', route.includes("if (!expected) return NextResponse.json({ error: 'Not configured' }, { status: 503 });") && route.includes('tokenMatches(extractToken('));
  const src = read('src/lib/growth/nurture.ts');
  check('every nurture send checks suppression first', /const sup = await checkSuppression\(c\.email\);\s*\n\s*if \(sup\.suppressed\)/.test(src));
  check('every nurture email carries an opt-out link', src.includes('optOutUrl(links.optOut.token)'));
  check('mock or off never sends', src.includes("if (!state.on) return { mode: 'off'") && src.includes("if (!real) return { mode: 'mock_preview'"));
  const sql = migrationChecks('092_growth_nurture_partners.sql', ['growth_nurture_steps', 'growth_lead_magnets', 'growth_brevo_events', 'growth_partners', 'growth_partner_checkins', 'growth_introductions']);
  check('092: a subscription needs opted-in consent', sql.includes("CHECK (nurture_status <> 'subscribed' OR consent_status = 'opted_in')"));
  check('092: nurture is off by default', sql.includes('nurture_enabled BOOLEAN NOT NULL DEFAULT false'));
  check('092: each Brevo event once', sql.includes('ON growth_brevo_events (dedupe_key)'));
  check('092: steps and magnets record approval', sql.includes('growth_nurture_steps_approval') && sql.includes('growth_lead_magnets_approval'));
  check('the daily run syncs, sends the sequence and reminds check-ins', /nurture-sync[\s\S]*nurture-sequence[\s\S]*partner-checkins/.test(read('src/lib/growth/daily.ts')));
  adminOnlyGates();
  const files = [...walk('src/lib/growth'), ...walk('src/app/admin/growth'), ...walk('src/app/api/admin/growth'), ...walk('src/app/api/growth'), ...walk('src/components/admin/growth'), 'supabase/migrations/092_growth_nurture_partners.sql', 'scripts/verify-growth-nurture.mjs'];
  const d = dashed(files);
  check('no em or en dash in any Growth file', d.length === 0, d.join(', '));
  const pub = publicChanges(['src/app/(public)/layout.tsx']);
  check('the public site is untouched apart from the inert chat mount', pub.length === 0, pub.join(', '));
}

console.log('2. Live database, test rows');
const svc = serviceClient();
if (!svc) console.log('  SKIP  no SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
else if (!(await tableReady(svc, 'growth_partners'))) markPending('live subscriptions, content approval, events and partners', '092_growth_nurture_partners.sql');
else if (!WRITE) console.log('  Write phase skipped (pass --write-test-rows to run it).');
else await live(svc);

async function live(svc) {
  const pros = await load('src/lib/growth/prospects.ts');
  const partners = await load('src/lib/growth/partners.ts');
  const tag = `ZZ-GROWTH-P6-${Date.now()}`;
  const actor = { id: 'verify-growth-nurture', name: 'Nurture verifier' };
  const started = new Date(Date.now() - 1000).toISOString();
  const email = `zz-growth-p6-${Date.now()}@example.invalid`;
  async function cleanup() {
    const { data: cts } = await svc.from('growth_contacts').select('id, email').eq('is_test', true).like('email', 'zz-growth-p6-%');
    const ids = (cts ?? []).map((c) => c.id);
    const { data: ps } = await svc.from('growth_partners').select('id').eq('is_test', true).like('name', 'ZZ-GROWTH-P6-%');
    const pids = (ps ?? []).map((p) => p.id);
    const { data: lds } = await svc.from('growth_leads').select('id').eq('is_test', true).like('title', 'ZZ-GROWTH-P6-%');
    const lids = (lds ?? []).map((l) => l.id);
    const { data: msgs } = ids.length ? await svc.from('growth_messages').select('id').in('contact_id', ids) : { data: [] };
    const mids = (msgs ?? []).map((m) => m.id);
    if (mids.length) await svc.from('growth_brevo_events').delete().eq('is_test', true).in('message_id', mids);
    if (ids.length) await svc.from('growth_brevo_events').delete().in('contact_id', ids).eq('is_test', true);
    if (mids.length) await svc.from('growth_messages').delete().eq('is_test', true).in('id', mids);
    if (pids.length) {
      await svc.from('growth_introductions').delete().eq('is_test', true).in('partner_id', pids);
      await svc.from('growth_partner_checkins').delete().eq('is_test', true).in('partner_id', pids);
    }
    await svc.from('growth_nurture_steps').delete().eq('is_test', true);
    await svc.from('growth_lead_magnets').delete().eq('is_test', true);
    await svc.from('growth_activity').delete().eq('is_test', true).gte('created_at', started);
    if (lids.length) {
      await svc.from('growth_activity').delete().eq('is_test', true).in('lead_id', lids);
      await svc.from('growth_leads').delete().eq('is_test', true).in('id', lids);
    }
    if (pids.length) await svc.from('growth_partners').delete().eq('is_test', true).in('id', pids);
    const emails = (cts ?? []).map((c) => c.email);
    if (emails.length) await svc.from('growth_suppressions').delete().eq('is_test', true).in('value', emails);
    if (ids.length) {
      await svc.from('growth_activity').delete().eq('is_test', true).in('contact_id', ids);
      await svc.from('growth_contacts').delete().eq('is_test', true).in('id', ids);
    }
  }
  await cleanup();
  try {
    const ct = await pros.createContact(null, { full_name: 'Nurture Tester', email, consent_status: 'legitimate_interest' }, actor, { isTest: true });
    const refused = await nurture.setSubscription(ct.value.id, true, actor);
    check('a contact who has not opted in cannot be subscribed', !refused.ok && refused.code === 'no_opt_in');
    const { error: dbSub } = await svc.from('growth_contacts').update({ nurture_status: 'subscribed' }).eq('id', ct.value.id).eq('is_test', true);
    check('the database refuses it too', dbSub?.code === '23514');
    await pros.updateContact(ct.value.id, { consent_status: 'opted_in' }, actor);
    const sub = await nurture.setSubscription(ct.value.id, true, actor);
    check('an opted-in contact is subscribed, due now', sub.ok && sub.value.nurture_status === 'subscribed' && sub.value.nurture_next_at);
    const step = await nurture.saveStep(null, { step: 1, delay_days: 0, subject: `${tag} welcome`, body: 'Dear [First name], here is [Project] and a useful note. [Link]', link_path: '/insights' }, actor, { isTest: true });
    const blocked = await nurture.actOnContent('growth_nurture_steps', step.value.id, 'approve', actor);
    check('a step with a placeholder cannot be approved', !blocked.ok && blocked.error.includes('[Project]'));
    const fixed = await nurture.saveStep(step.value.id, { step: 1, delay_days: 0, subject: `${tag} welcome`, body: 'Dear [First name], here is a short note on feasibility studies. [Link]', link_path: '/insights' }, actor);
    const ok = await nurture.actOnContent('growth_nurture_steps', fixed.value.id, 'approve', actor);
    check('a clean step is approved; editing returns it to draft', ok.ok && fixed.value.status === 'draft');
    const magnet = await nurture.saveMagnet(null, { title: `${tag} guide`, url: 'https://files.example.com/guide.pdf', email_subject: 'Your guide', email_body: 'Dear [First name], the guide you asked for is here. [Link]' }, actor, { isTest: true });
    const early = await nurture.sendLeadMagnet(ct.value.id, magnet.value.id, actor);
    check('a lead magnet must be approved before it is sent', !early.ok && early.status === 409);
    await nurture.actOnContent('growth_lead_magnets', magnet.value.id, 'approve', actor);
    const { data: realSetting } = await svc.from('growth_settings').select('nurture_enabled').eq('id', 1).single();
    const send = await nurture.sendLeadMagnet(ct.value.id, magnet.value.id, actor);
    const { count: sent } = await svc.from('growth_messages').select('id', { count: 'exact', head: true }).eq('contact_id', ct.value.id);
    check('with nurture off (or in mock mode) a lead magnet is a preview and nothing is sent', realSetting.nurture_enabled === false && send.ok && send.value.mode === 'mock_preview' && sent === 0);
    const { data: msg } = await svc.from('growth_messages').insert({ is_test: true, contact_id: ct.value.id, channel: 'email', kind: 'nurture', subject: 's', body: 'b', status: 'sent', approved_at: new Date().toISOString(), sent_at: new Date().toISOString(), send_mode: 'mock' }).select('id').single();
    const open = { event: 'opened', email, 'X-Mailin-custom': `growth:${msg.id}`, 'message-id': `<zz-${tag}@brevo>`, ts_event: 1760000000 };
    const first = await nurture.handleBrevoEvent(open);
    const again = await nurture.handleBrevoEvent(open);
    const { data: opened } = await svc.from('growth_messages').select('opened_at').eq('id', msg.id).single();
    check('an event is applied once, and an open dates the message', first === 'applied' && again === 'duplicate' && opened.opened_at);
    const unsub = await nurture.handleBrevoEvent({ event: 'unsubscribed', email, 'X-Mailin-custom': `growth:${msg.id}`, 'message-id': `<zz-${tag}@brevo>`, ts_event: 1760000100 });
    const { data: after } = await svc.from('growth_contacts').select('nurture_status, consent_status').eq('id', ct.value.id).single();
    const { data: supRow } = await svc.from('growth_suppressions').select('id').eq('value', email).is('removed_at', null);
    check('an unsubscribe suppresses the address and opts the contact out', unsub === 'applied' && after.nurture_status === 'unsubscribed' && after.consent_status === 'opted_out' && (supRow ?? []).length === 1);
    check('an event for no Growth record is ignored', (await nurture.handleBrevoEvent({ event: 'opened', email: 'nobody-zz@example.invalid', ts_event: 1 })) === 'ignored');

    const p = await partners.savePartner(null, { name: `${tag} Partner`, type: 'referral_partner', checkin_every_days: 30 }, actor, { isTest: true });
    const in30 = new Date(Date.now() + 3 * 3_600_000 + 30 * 86_400_000).toISOString().slice(0, 10);
    check('a new partner gets its first check-in date from its cadence', p.ok && p.value.next_checkin_due === in30);
    const c = await partners.logCheckin(p.value.id, 'Coffee', actor);
    check('a check-in is logged and moves the next one', c.ok && c.value.last_checkin_at && c.value.next_checkin_due === in30);
    const intro = await partners.saveIntroduction(p.value.id, null, { company_name: `${tag} Target`, introduced_on: '2026-09-20', direction: 'to_us', outcome: 'pending', open_lead: true }, actor);
    const { data: lead } = intro.ok && intro.value.lead_id ? await svc.from('growth_leads').select('*').eq('id', intro.value.lead_id).single() : { data: null };
    check('an introduction opens a lead with the partner as its referral source', intro.ok && lead?.referral_partner_id === p.value.id && lead.source === 'partner' && lead.referral_source.includes(p.value.name));
    const won = await partners.saveIntroduction(p.value.id, intro.value.id, { company_name: `${tag} Target`, introduced_on: '2026-09-20', direction: 'to_us', outcome: 'won', lead_id: intro.value.lead_id }, actor);
    const { data: wonLead } = await svc.from('growth_leads').select('stage').eq('id', intro.value.lead_id).single();
    check('a won introduction wins the lead', won.ok && wonLead.stage === 'won');
  } finally {
    await cleanup();
    const { count } = await svc.from('growth_partners').select('id', { count: 'exact', head: true }).like('name', 'ZZ-GROWTH-P6-%');
    check('every test row removed', count === 0);
  }
}

finish('verify-growth-nurture');
