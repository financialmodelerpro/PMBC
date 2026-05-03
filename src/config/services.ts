export type ServiceConfig = {
  slug: string;
  number: string;
  title: string;
  summary: string;
};

export const SERVICES: ServiceConfig[] = [
  {
    slug: 'financial-modeling',
    number: '01',
    title: 'Financial Modeling',
    summary:
      'Institutional-grade three-statement, project, and scenario models built for board, lender, and investor scrutiny.',
  },
  {
    slug: 'business-valuation',
    number: '02',
    title: 'Business Valuation',
    summary:
      'DCF, comparable transactions, and precedent-based valuations used for negotiations, fairness opinions, and strategic planning.',
  },
  {
    slug: 'financial-due-diligence',
    number: '03',
    title: 'Financial Due Diligence',
    summary:
      'Buy-side and sell-side quality of earnings, working capital, and net debt analyses with defendable findings.',
  },
  {
    slug: 'transaction-advisory',
    number: '04',
    title: 'Transaction Advisory',
    summary:
      'End-to-end deal support from screening to close, including structuring, negotiation, and closing mechanics.',
  },
  {
    slug: 'mergers-acquisitions',
    number: '05',
    title: 'M&A Advisory',
    summary:
      'Sell-side mandates, buy-side searches, and strategic combinations for owners and investors across the GCC and beyond.',
  },
  {
    slug: 'real-estate-modeling',
    number: '06',
    title: 'Real Estate Modeling',
    summary:
      'Hospitality, residential, mixed-use, and master-plan models with phased construction draws, IRR waterfalls, and exit scenarios.',
  },
  {
    slug: 'project-finance',
    number: '07',
    title: 'Project Finance',
    summary:
      'Bankable models for infrastructure, energy, and industrial projects, structured for senior-debt sizing and DSCR covenants.',
  },
  {
    slug: 'investment-memorandums',
    number: '08',
    title: 'Investment Memorandums',
    summary:
      'Information memoranda, teasers, and pitch decks calibrated to family offices, strategics, and institutional capital.',
  },
  {
    slug: 'cfo-advisory',
    number: '09',
    title: 'CFO Advisory',
    summary:
      'Fractional CFO engagements covering FP&A, treasury, capital structure, and board reporting for growth-stage companies.',
  },
];
