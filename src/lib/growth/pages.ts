/**
 * The Growth Engine's admin pages, in sub-navigation order (Unit 1.1, 2026-09-22).
 *
 * One list, read by the sub-navigation and by every page, so a page's title,
 * purpose and delivery phase are stated once. Later units replace a page's
 * empty state with the real screen; the entry here stays as its navigation label.
 */

export type GrowthPageKey =
  | 'home'
  | 'signals'
  | 'prospects'
  | 'outreach'
  | 'pipeline'
  | 'conversations'
  | 'meetings'
  | 'partners'
  | 'knowledge-base'
  | 'analytics'
  | 'settings';

export type GrowthPage = {
  key: GrowthPageKey;
  title: string;
  href: string;
  purpose: string;
  phase: string;
};

export const GROWTH_BASE_PATH = '/admin/growth';

export const GROWTH_PAGES: readonly GrowthPage[] = [
  {
    key: 'home',
    title: 'Home',
    href: GROWTH_BASE_PATH,
    purpose: 'Your daily priorities, approvals and pipeline summary.',
    phase: 'Arrives in Phase 7 (Intelligence). Basic view from Phase 1.',
  },
  {
    key: 'signals',
    title: 'Signals',
    href: `${GROWTH_BASE_PATH}/signals`,
    purpose: 'Trigger events that suggest a company may need PMBC services.',
    phase: 'Arrives in Phase 2 (Prospecting).',
  },
  {
    key: 'prospects',
    title: 'Prospects',
    href: `${GROWTH_BASE_PATH}/prospects`,
    purpose: 'Researched companies and their decision-makers.',
    phase: 'Arrives in Phase 2 (Prospecting).',
  },
  {
    key: 'outreach',
    title: 'Outreach',
    href: `${GROWTH_BASE_PATH}/outreach`,
    purpose: 'Draft, approve and track personalised outreach.',
    phase: 'Arrives in Phase 3 (Outreach).',
  },
  {
    key: 'pipeline',
    title: 'Pipeline',
    href: `${GROWTH_BASE_PATH}/pipeline`,
    purpose: 'Every lead and opportunity from first contact to won or lost.',
    phase: 'Arrives in Phase 3 (Pipeline).',
  },
  {
    key: 'conversations',
    title: 'Conversations',
    href: `${GROWTH_BASE_PATH}/conversations`,
    purpose: 'Website chat transcripts and qualification answers.',
    phase: 'Arrives in Phase 4 (Website AI).',
  },
  {
    key: 'meetings',
    title: 'Meetings',
    href: `${GROWTH_BASE_PATH}/meetings`,
    purpose: 'Booked discovery calls, meeting briefs and follow-ups.',
    phase: 'Arrives in Phase 5 (Meetings).',
  },
  {
    key: 'partners',
    title: 'Partners',
    href: `${GROWTH_BASE_PATH}/partners`,
    purpose: 'Referral partners, past clients and introductions.',
    phase: 'Arrives in Phase 6 (Referrals).',
  },
  {
    key: 'knowledge-base',
    title: 'Knowledge Base',
    href: `${GROWTH_BASE_PATH}/knowledge-base`,
    purpose: 'Approved services, offers, case studies and AI rules.',
    phase: 'Arrives in Phase 1 (Foundation).',
  },
  {
    key: 'analytics',
    title: 'Analytics',
    href: `${GROWTH_BASE_PATH}/analytics`,
    purpose: 'Funnel performance by source, sector, trigger and service.',
    phase: 'Arrives in Phase 7 (Intelligence).',
  },
  {
    key: 'settings',
    title: 'Settings',
    href: `${GROWTH_BASE_PATH}/settings`,
    purpose: 'Send limits, suppression list, AI budget and audit log.',
    phase: 'Arrives in Phase 1 (Foundation).',
  },
];

export function growthPage(key: GrowthPageKey): GrowthPage {
  const page = GROWTH_PAGES.find((p) => p.key === key);
  if (!page) throw new Error(`Unknown Growth page: ${key}`);
  return page;
}
