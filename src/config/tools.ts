/**
 * The free tools registry.
 *
 * The /tools hub, the sitemap, each tool page's metadata and structured data,
 * and the page builder's route mapping all read this list, so a tool is listed
 * everywhere by adding one entry here and its component to
 * `src/components/tools/toolComponents.ts`. See CLAUDE.md "Free tools".
 *
 * `status` decides visibility. `live` tools are listed, routed and in the
 * sitemap. `draft` tools are none of those, and their route returns 404, so an
 * entry can be added ahead of the component being ready without anything
 * showing. The hub deliberately does not show "coming soon" cards: an empty
 * promise reads weaker than no card, the same reasoning that hides the footer
 * links to empty collections.
 */

export type ToolStatus = 'live' | 'draft';

export type ToolEntry = {
  /** URL segment under /tools, and the key stored on each lead. */
  slug: string;
  name: string;
  /** One sentence, shown on the hub card and used as the meta description. */
  summary: string;
  /** Short label above the name on the hub card. */
  eyebrow: string;
  /** Roughly how long it takes, shown on the hub card. */
  duration: string;
  status: ToolStatus;
  /** Hero copy used when the tool's CMS page has no hero section yet. */
  hero: { eyebrow: string; headline: string; tagline: string };
};

export const TOOLS: ToolEntry[] = [
  {
    slug: 'business-valuation',
    name: 'Business Valuation',
    summary:
      'An indicative equity value range from a DCF and a comparables check, using Damodaran market data for your industry and country.',
    eyebrow: 'DCF and comparables',
    duration: 'About 10 minutes',
    status: 'live',
    hero: {
      eyebrow: 'Free tool',
      headline: 'Value your business with a DCF and comparables',
      tagline:
        'Enter three years of history and a five year forecast. The tool builds free cash flow, a cost of capital from Damodaran market data, and a comparables check, then shows where your value lands.',
    },
  },
  {
    slug: 'investor-readiness-scorecard',
    name: 'Investor Readiness Scorecard',
    summary: 'How ready your business is for an equity raise, scored across the areas investors test first.',
    eyebrow: 'Scorecard',
    duration: 'About 5 minutes',
    status: 'draft',
    hero: {
      eyebrow: 'Free tool',
      headline: 'How ready is your business for investors?',
      tagline: 'Answer a short set of questions and see where an investor would push back.',
    },
  },
];

export const TOOLS_HUB_HERO = {
  eyebrow: 'Free tools',
  headline: 'Tools for owners and investors',
  tagline:
    'Practical calculators built on the same methods we use on mandates. Indicative results in minutes, with a report you can keep.',
};

export function liveTools(): ToolEntry[] {
  return TOOLS.filter((t) => t.status === 'live');
}

export function findLiveTool(slug: string): ToolEntry | null {
  return TOOLS.find((t) => t.slug === slug && t.status === 'live') ?? null;
}

export function toolPath(slug: string): string {
  return `/tools/${slug}`;
}

/** The CMS page carrying a tool's hero and metadata. Served at `toolPath`. */
export function toolPageSlug(slug: string): string {
  return `tool-${slug}`;
}
