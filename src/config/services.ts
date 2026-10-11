/**
 * The three practice groups, in page order, matching the firm profile deck.
 * Set 2026-10-11 by migration 106. The names here are fallbacks: the live
 * names are `group_<n>_name` on the `/services` grid section, editable in the
 * page builder. Membership is by slug, on each service below.
 */
export type ServiceGroupKey = 'modeling-valuation' | 'transactions' | 'capital-finance';

export type ServiceGroupConfig = {
  key: ServiceGroupKey;
  /** 1-based position; also the suffix of the section content key holding the name. */
  index: 1 | 2 | 3;
  name: string;
};

export const SERVICE_GROUPS: ServiceGroupConfig[] = [
  { key: 'modeling-valuation', index: 1, name: 'Modeling and Valuation' },
  { key: 'transactions', index: 2, name: 'Transactions' },
  { key: 'capital-finance', index: 3, name: 'Capital and Finance' },
];

export type ServiceConfig = {
  slug: string;
  number: string;
  title: string;
  summary: string;
  group: ServiceGroupKey;
};

// Order and numbering follow the practice groups (migration 106). Slugs never
// change with the order: they are join keys across four tables and live URLs.
export const SERVICES: ServiceConfig[] = [
  {
    slug: 'financial-modeling',
    number: '01',
    title: 'Financial Modeling',
    summary:
      'Institutional-grade three-statement, project, and scenario models built for board, lender, and investor scrutiny.',
    group: 'modeling-valuation',
  },
  {
    // Renamed 2026-08-11 by migration 047. The previous slug 301s to this one
    // in next.config.ts, which is the only file that still names it.
    slug: 'refm',
    number: '02',
    title: 'Real Estate Financial Modeling',
    summary:
      'Hospitality, residential, mixed-use, and master-plan models with phased construction draws, IRR waterfalls, and exit scenarios.',
    group: 'modeling-valuation',
  },
  {
    slug: 'business-valuation',
    number: '03',
    title: 'Business Valuation',
    summary:
      'DCF, comparable transactions, and precedent-based valuations used for negotiations, fairness opinions, and strategic planning.',
    group: 'modeling-valuation',
  },
  {
    slug: 'transaction-advisory',
    number: '04',
    title: 'Transaction Advisory',
    summary:
      'End-to-end deal support from screening to close, including structuring, negotiation, and closing mechanics.',
    group: 'transactions',
  },
  {
    slug: 'mergers-acquisitions',
    number: '05',
    title: 'M&A Advisory',
    summary:
      'Sell-side mandates, buy-side searches, and strategic combinations for owners and investors across the GCC and beyond.',
    group: 'transactions',
  },
  {
    slug: 'financial-due-diligence',
    number: '06',
    title: 'Financial Due Diligence',
    summary:
      'Buy-side and sell-side quality of earnings, working capital, and net debt analyses with defendable findings.',
    group: 'transactions',
  },
  {
    slug: 'project-finance',
    number: '07',
    title: 'Project Finance',
    summary:
      'Bankable models for infrastructure, energy, and industrial projects, structured for senior-debt sizing and DSCR covenants.',
    group: 'capital-finance',
  },
  {
    // Display name "Investment Memoranda" since migration 106; the slug keeps
    // the old plural so the indexed URL and the four join keys stay put.
    slug: 'investment-memorandums',
    number: '08',
    title: 'Investment Memoranda',
    summary:
      'Information memoranda, teasers, and pitch decks calibrated to family offices, strategics, and institutional capital.',
    group: 'capital-finance',
  },
  {
    slug: 'cfo-advisory',
    number: '09',
    title: 'CFO Advisory',
    summary:
      'Fractional CFO engagements covering FP&A, treasury, capital structure, and board reporting for growth-stage companies.',
    group: 'capital-finance',
  },
];

/**
 * The group a slug belongs to. A service added in the admin that is not in the
 * config joins the last group rather than disappearing from the grid.
 */
export function serviceGroupOf(slug: string): ServiceGroupKey {
  return SERVICES.find((s) => s.slug === slug)?.group ?? SERVICE_GROUPS[SERVICE_GROUPS.length - 1].key;
}

/**
 * Related services for a detail page: the other members of its practice group,
 * then the first service of the next group, so a reader sees its neighbours
 * before a step sideways.
 */
export function relatedServices(slug: string, limit = 3): ServiceConfig[] {
  const group = serviceGroupOf(slug);
  const siblings = SERVICES.filter((s) => s.group === group && s.slug !== slug);
  const gi = SERVICE_GROUPS.findIndex((g) => g.key === group);
  const rest: ServiceConfig[] = [];
  for (let step = 1; step < SERVICE_GROUPS.length; step++) {
    const next = SERVICE_GROUPS[(gi + step) % SERVICE_GROUPS.length].key;
    rest.push(...SERVICES.filter((s) => s.group === next));
  }
  return [...siblings, ...rest].slice(0, limit);
}
