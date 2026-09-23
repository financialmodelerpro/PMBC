// scripts/lib/growthFixtures.mjs
//
// Shared fixtures for the Growth end-to-end run and verifiers (2026-09-23):
// approved Knowledge Base items marked is_test, which only test AI calls can
// see, and a sweep that removes every test row tied to a name prefix in
// dependency order.

import { load, serviceClient } from './growthVerify.mjs';

const svc = serviceClient();
const kbm = await load('src/lib/growth/kbModel.ts');
const L = { kbm };

// ---------------------------------------------------------------------------
// Test Knowledge Base (is_test, approved, seen only by test calls)
// ---------------------------------------------------------------------------
export async function addTestKnowledge(prefix) {
  const now = new Date().toISOString();
  const items = [
    { kind: 'service', item_key: 'refm', title: 'Real Estate Financial Modeling', site_service_slug: 'refm', content: { description: 'Development and investment models for real estate projects.', ideal_client: 'Developers and investors in KSA.', use_cases: ['Lender review', 'Off-plan escrow'], deliverables: ['Excel model', 'Summary'], sectors: ['Real estate'] } },
    { kind: 'service', item_key: 'business-valuation', title: 'Business Valuation', site_service_slug: 'business-valuation', content: { description: 'Independent valuations.', ideal_client: 'Owners and investors.', use_cases: ['Stake sale'], deliverables: ['Valuation report'], sectors: ['All'] } },
    { kind: 'offer', item_key: 'feasibility_study', title: 'Feasibility study', related_service_slugs: ['refm', 'financial-modeling', 'project-finance'], content: { scope: 'A scoped feasibility update.', suits: 'Developers before a lender review.', upsell_path: 'Full development model.' } },
    { kind: 'messaging', item_key: null, title: `${prefix} tone`, content: { tone: 'Senior, calm and plain.', use_phrases: ['If useful'], avoid_phrases: ['Guaranteed'] } },
    { kind: 'disallowed', item_key: null, title: `${prefix} prices`, content: { detail: 'Never quote fees or ranges.', instead: 'Offer a call with Ahmad.' } },
    { kind: 'qualification', item_key: null, title: `${prefix} questions`, content: { questions: ['What is the project?', 'How large is it?', 'When do you decide?'], offer_meeting_when: 'Above SAR 50 million with a decision within six months.' } },
    { kind: 'escalation', item_key: null, title: `${prefix} escalation`, content: { handover: 'Pass pricing, legal and complaints to Ahmad.' } },
    { kind: 'faq', item_key: null, title: `${prefix} how engagements start`, content: { answer: 'With a short scoping call.' } },
    { kind: 'targeting', item_key: null, title: `${prefix} decision-makers`, content: { decision_maker_titles: ['CFO', 'Chief Financial Officer', 'Head of Investments'], excluded_work: ['statutory audit'], notes: '' } },
  ];
  const rows = items.map((i) => {
    const draft = { kind: i.kind, title: i.title, content: i.content, site_service_slug: i.site_service_slug ?? null, case_study_id: null, related_service_slugs: i.related_service_slugs ?? [] };
    return { is_test: true, kind: i.kind, item_key: i.item_key, title: i.title, content: i.content, site_service_slug: i.site_service_slug ?? null, related_service_slugs: i.related_service_slugs ?? [], status: 'approved', approved_title: i.title, approved_content: L.kbm.approvedSnapshot(draft), approved_at: now, approved_by_name: 'End-to-end test', updated_by_name: 'End-to-end test' };
  });
  const { data, error } = await svc.from('growth_kb_items').insert(rows).select('id');
  if (error) throw new Error(`test Knowledge Base: ${error.message}`);
  return data.map((d) => d.id);
}

// ---------------------------------------------------------------------------
// Cleanup: every test row tied to a name prefix, in dependency order
// ---------------------------------------------------------------------------
export async function sweep({ namePrefix, emailPrefix, kbIds = [], conversationIds = [], importPrefix = null, partnerPrefix = null }) {
  const ids = async (table, build) => ((await build(svc.from(table).select('id')))?.data ?? []).map((r) => r.id);
  const inList = (list) => `(${list.join(',')})`;
  const companies = await ids('growth_companies', (q) => q.eq('is_test', true).like('name', `${namePrefix}%`));
  const contacts = [
    ...new Set([
      ...(await ids('growth_contacts', (q) => q.eq('is_test', true).like('email', `${emailPrefix}%`))),
      ...(companies.length ? await ids('growth_contacts', (q) => q.eq('is_test', true).in('company_id', companies)) : []),
    ]),
  ];
  const leads = [
    ...new Set([
      ...(await ids('growth_leads', (q) => q.eq('is_test', true).like('title', `${namePrefix}%`))),
      ...(companies.length ? await ids('growth_leads', (q) => q.eq('is_test', true).in('company_id', companies)) : []),
      ...(contacts.length ? await ids('growth_leads', (q) => q.eq('is_test', true).in('contact_id', contacts)) : []),
    ]),
  ];
  const signals = [
    ...new Set([
      ...(await ids('growth_signals', (q) => q.eq('is_test', true).like('summary', `${namePrefix}%`))),
      ...(companies.length ? await ids('growth_signals', (q) => q.eq('is_test', true).in('company_id', companies)) : []),
    ]),
  ];
  const orParts = (cols) => cols.filter(([, list]) => list.length).map(([c, list]) => `${c}.in.${inList(list)}`).join(',');
  const byOwners = async (table, cols) => {
    const f = orParts(cols);
    return f ? ids(table, (q) => q.eq('is_test', true).or(f)) : [];
  };
  const messages = await byOwners('growth_messages', [['lead_id', leads], ['contact_id', contacts], ['company_id', companies]]);
  const trackedLinks = await byOwners('growth_tracked_links', [['lead_id', leads], ['contact_id', contacts], ['message_id', messages]]);
  const meetings = await byOwners('growth_meetings', [['lead_id', leads], ['contact_id', contacts]]);
  const convs = [...new Set([...conversationIds, ...(await byOwners('growth_conversations', [['lead_id', leads], ['contact_id', contacts]]))])];
  const partners = partnerPrefix ? await ids('growth_partners', (q) => q.eq('is_test', true).like('name', `${partnerPrefix}%`)) : [];
  const imports = importPrefix ? await ids('growth_imports', (q) => q.eq('is_test', true).like('filename', `${importPrefix}%`)) : [];
  const del = async (table, col, list) => {
    for (let k = 0; k < list.length; k += 150) {
      const { error } = await svc.from(table).delete().eq('is_test', true).in(col, list.slice(k, k + 150));
      if (error && !/does not exist|schema cache/.test(error.message)) console.log(`    cleanup ${table}: ${error.message}`);
    }
  };
  await del('growth_link_clicks', 'link_id', trackedLinks);
  await del('growth_brevo_events', 'message_id', messages);
  await del('growth_brevo_events', 'contact_id', contacts);
  await del('growth_chat_messages', 'conversation_id', convs);
  await del('growth_conversations', 'id', convs);
  await del('growth_tracked_links', 'id', trackedLinks);
  await del('growth_messages', 'id', messages);
  await del('growth_meetings', 'id', meetings);
  await del('growth_introductions', 'partner_id', partners);
  await del('growth_partner_checkins', 'partner_id', partners);
  await del('growth_opportunities', 'lead_id', leads);
  await del('growth_tasks', 'lead_id', leads);
  await del('growth_tasks', 'company_id', companies);
  await del('growth_research_briefs', 'company_id', companies);
  await del('growth_activity', 'signal_id', signals);
  await del('growth_signals', 'id', signals);
  await del('growth_activity', 'company_id', companies);
  await del('growth_activity', 'contact_id', contacts);
  await del('growth_activity', 'lead_id', leads);
  await del('growth_activity', 'signal_id', signals);
  await del('growth_activity', 'kb_item_id', kbIds);
  await del('growth_ai_usage', 'company_id', companies);
  await del('growth_ai_usage', 'lead_id', leads);
  await del('growth_leads', 'id', leads);
  await del('growth_partners', 'id', partners);
  await del('growth_contacts', 'id', contacts);
  await del('growth_companies', 'id', companies);
  await del('growth_imports', 'id', imports);
  await del('growth_kb_items', 'id', kbIds);
  const { data: sup } = await svc.from('growth_suppressions').select('id, value').eq('is_test', true).like('value', `${emailPrefix}%`);
  await del('growth_suppressions', 'id', (sup ?? []).map((s) => s.id));
  return { companies: companies.length, contacts: contacts.length, leads: leads.length, messages: messages.length, meetings: meetings.length, conversations: convs.length };
}

