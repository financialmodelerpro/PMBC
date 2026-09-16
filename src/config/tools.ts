/**
 * The free tools registry: which tools exist, and everything about them that is
 * code rather than content.
 *
 * WHAT THIS DOES NOT DECIDE
 * Whether a tool is public. That is the `tool_visibility` table, switched per
 * tool at /admin/tools, and it defaults to Hidden. See
 * `src/lib/tools/visibility.ts`, which is the only place the two are combined.
 *
 * `build` says whether the tool can be switched on at all. A `draft` entry is
 * hidden whatever the database says and cannot be toggled, so an entry can be
 * added ahead of its component without anything showing.
 *
 * ADDING A TOOL (see CLAUDE.md "Free tools")
 *   1. An entry here with `build: 'draft'`.
 *   2. Its component in `src/components/tools/toolComponents.ts`.
 *   3. Its engine and data under `src/lib/tools/<slug>/`.
 *   4. `build: 'ready'`, deploy, then switch it Live at /admin/tools.
 */

export type ToolBuild = 'ready' | 'draft';

export type ToolEntry = {
  /** URL segment under /tools, and the key stored on each lead and visibility row. */
  slug: string;
  name: string;
  /** One sentence, shown on the hub card and used as the meta description. */
  summary: string;
  /** Short label above the name on the hub card. */
  eyebrow: string;
  /** Roughly how long it takes, shown on the hub card. */
  duration: string;
  build: ToolBuild;
  /** Hero copy used when the tool's CMS page has no hero section yet. */
  hero: { eyebrow: string; headline: string; tagline: string };
  /**
   * A call to action placed on a service detail page, shown only while this
   * tool is Live. The copy is here rather than in a page section so that one
   * visibility switch governs it: a section has its own visible flag, and two
   * switches for one promise is how a live page ends up linking to a 404.
   */
  serviceCta?: {
    /** The `services/<slug>` page it appears on. */
    serviceSlug: string;
    eyebrow: string;
    headline: string;
    body: string;
    label: string;
  };
};

export const TOOLS: ToolEntry[] = [
  {
    slug: 'business-valuation',
    name: 'Business Valuation',
    summary:
      'An indicative equity value range from a DCF and a comparables check, using Damodaran market data for your industry and country.',
    eyebrow: 'DCF and comparables',
    duration: 'About 10 minutes',
    build: 'ready',
    hero: {
      eyebrow: 'Free tool',
      headline: 'Value your business with a DCF and comparables',
      tagline:
        'Enter three years of history and a five year forecast. The tool builds free cash flow, a cost of capital from Damodaran market data, and a comparables check, then shows where your value lands.',
    },
    serviceCta: {
      serviceSlug: 'business-valuation',
      eyebrow: 'Free tool',
      headline: 'Try our free valuation tool',
      body: 'An indicative equity value range from a DCF and a comparables check, using Damodaran market data for your industry and country. About ten minutes, with a report you can keep.',
      label: 'Open the valuation tool',
    },
  },
  {
    slug: 'investor-readiness-scorecard',
    name: 'Investor Readiness Scorecard',
    summary: 'How ready your business is for an equity raise, scored across the areas investors test first.',
    eyebrow: 'Scorecard',
    duration: 'About 5 minutes',
    build: 'draft',
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

/** The footer link, shown only while at least one tool is Live. */
export const TOOLS_FOOTER_LINK = { id: 'tools', label: 'Free Tools', href: '/tools' } as const;

export function findTool(slug: string): ToolEntry | null {
  return TOOLS.find((t) => t.slug === slug) ?? null;
}

export function readyTools(): ToolEntry[] {
  return TOOLS.filter((t) => t.build === 'ready');
}

export function toolPath(slug: string): string {
  return `/tools/${slug}`;
}

/** The CMS page carrying a tool's hero and metadata. Served at `toolPath`. */
export function toolPageSlug(slug: string): string {
  return `tool-${slug}`;
}
