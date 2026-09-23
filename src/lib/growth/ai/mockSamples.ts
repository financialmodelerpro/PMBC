/**
 * Structured sample answers for the mock provider (from Phase 2, 2026-09-23).
 *
 * Agents that ask for JSON get JSON here, in the shape the agent's parser
 * expects, so every flow can be exercised without a key. Every sample names
 * made-up companies and people, uses `example.invalid` links (a domain that can
 * never resolve), and never states a PaceMakers fact. The mock provider still
 * puts MOCK_LABEL before the JSON, and agents keep the mock flag on whatever
 * they store, so none of it can pass for real data.
 */

import type { ProviderRequest } from './provider';

type Sample = (req: ProviderRequest) => unknown;

const lastUser = (req: ProviderRequest) => [...req.messages].reverse().find((m) => m.role === 'user')?.content ?? '';

export const JSON_SAMPLES: Record<string, Sample> = {
  prospect_research: () => ({
    summary: {
      value: 'Sample Developments Co. (a made-up company) develops mid-market residential communities in Riyadh and Jeddah.',
      sources: ['https://example.invalid/sample-company-profile'],
    },
    sector: { value: 'Real estate development', sources: ['https://example.invalid/sample-company-profile'] },
    city: { value: 'Riyadh', sources: ['https://example.invalid/sample-company-profile'] },
    projects: [
      {
        name: 'Sample Gardens (made up)',
        detail: 'A 380-unit residential project announced for north Riyadh.',
        scale_sar: 450000000,
        sources: ['https://example.invalid/sample-project-news'],
      },
    ],
    recent_triggers: [
      {
        trigger_type: 'off_plan_registration',
        date: '2026-09-01',
        summary: 'Sample Gardens registered for off-plan sales (sample).',
        sources: ['https://example.invalid/sample-registration'],
      },
    ],
    decision_makers: [
      { name: 'Sample Person', title: 'Chief Financial Officer', sources: ['https://example.invalid/sample-leadership'] },
    ],
    likely_service: { value: 'refm', reason: 'An off-plan registration usually needs a lender-ready development model.' },
    entry_offer: { value: 'feasibility_study', reason: 'A feasibility update is a small first step before escrow drawdowns.' },
    reasoning: 'Sample reasoning: residential developer with a registered project above the minimum size.',
    unknowns: ['Current lenders', 'Whether a model already exists'],
  }),
  signal_feed: () => ({
    signals: [
      {
        company_name: 'Sample Logistics Holding (made up)',
        trigger_type: 'fundraising_debt',
        signal_date: new Date().toISOString().slice(0, 10),
        summary: 'Sample: the company announced a SAR 600 million sukuk to fund new warehouses.',
        evidence_url: 'https://example.invalid/sample-sukuk',
        source_name: 'Sample News',
      },
      {
        company_name: 'Sample Hospitality Group (made up)',
        trigger_type: 'new_project',
        signal_date: new Date().toISOString().slice(0, 10),
        summary: 'Sample: a 250-key hotel project announced in AlUla.',
        evidence_url: '',
        source_name: 'Sample Wire',
      },
    ],
  }),
  outreach_email: () => ({
    subject: 'Your registered project in north Riyadh',
    body: 'Dear [First name],\n\nI saw that [Company] registered [Project] for off-plan sales this month. Lenders and escrow agents usually ask for an updated development model at this stage, and we help developers prepare one that holds up to their review.\n\nIf useful, I would be glad to share how we approached a similar project. Our real estate modelling work is outlined here: [Link]\n\nKind regards,\nAhmad Din',
  }),
  outreach_linkedin: () => ({
    subject: '',
    body: 'Hello [First name], I noticed [Company] registered [Project] recently. We help developers in KSA prepare lender-ready models at this stage. Happy to share how we approach it if useful.',
  }),
  outreach_follow_up: () => ({
    subject: 'Re: Your registered project in north Riyadh',
    body: 'Dear [First name],\n\nFollowing up on my note about [Project]. If an updated model is on your list for the next quarter, I would be glad to walk you through how we structure them. You can choose a time here: [Booking link]\n\nKind regards,\nAhmad Din',
  }),
  chat_reply: (req) => {
    const said = lastUser(req).slice(0, 80);
    return {
      reply: `Sample reply from the mock provider. You said: "${said}". Could you share roughly how large the project or transaction is, in SAR?`,
      qualification: { service: null, sector: null, project_type: null, size_sar: null, purpose: null, timeline: null, decision_role: null, pain_point: null },
      intent: 'continue',
      escalate: null,
      wants_meeting: false,
    };
  },
  meeting_brief: () => ({
    company: 'Sample Developments Co. (made up): residential developer, Riyadh.',
    trigger: 'Sample: off-plan registration of a 380-unit project.',
    activity: 'Sample: two emails sent, one reply asking for a call.',
    requirement: 'Sample: lender-ready development model; about SAR 450 million.',
    likely_services: ['refm', 'financial-modeling'],
    open_questions: ['Who owns the current model?', 'What do the lenders require, and by when?', 'Who signs off the engagement?'],
    next_action: 'Offer a scoped feasibility update as a first step.',
  }),
  meeting_recap: () => ({
    subject: 'Thank you for your time today',
    body: 'Dear [First name],\n\nThank you for the conversation today (sample recap from the mock provider). As agreed, the next step is [next step]. If a follow-up call would help, choose a time here: [Booking link]\n\nKind regards,\nAhmad Din',
  }),
  no_show: () => ({
    subject: 'Finding another time',
    body: 'Dear [First name],\n\nSorry we missed each other today (sample text from the mock provider). If it is still useful, you can choose another time here: [Booking link]\n\nKind regards,\nAhmad Din',
  }),
};

/** Every https link in a sample, as a real search would report its sources. */
export function sampleUrls(value: unknown): string[] {
  const found = JSON.stringify(value).match(/https:\/\/[^"\s]+/g) ?? [];
  return [...new Set(found)];
}
