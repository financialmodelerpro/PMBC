// scripts/seed-phase6-sections.mjs
// Seeds Phase 6 smoke-test page_sections across existing CMS pages so each new
// section type renders on a public URL. Idempotent — every seeded row is tagged
// with styles.smoke = 'phase6'; the script deletes any prior rows with that
// marker before inserting fresh ones, so it can be re-run safely.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

function loadEnvLocal() {
  const envPath = path.join(projectRoot, '.env.local');
  if (!fs.existsSync(envPath)) {
    throw new Error('.env.local not found at ' + envPath);
  }
  const text = fs.readFileSync(envPath, 'utf8');
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

const SMOKE_TAG = { smoke: 'phase6' };

// Each entry: page_slug + ordered list of sections to seed.
// Order matters — display_order is assigned as 1000 + idx*10 so seeds sort
// after any pre-existing real sections.
const SEEDS = [
  {
    page_slug: 'approach',
    sections: [
      {
        section_type: 'process_steps',
        content: {
          heading: 'How we engage',
          intro:
            'Four phases. Senior-led from first call to final advice. No black-box deliverables, no junior pass-throughs.',
          steps: [
            {
              number: '01',
              title: 'Understand',
              description:
                'We start with the mandate, not the model. Sponsors, constraints, decision context, exit horizon.',
            },
            {
              number: '02',
              title: 'Analyse',
              description:
                'Data room walk-through, market triangulation, KPI normalisation, accounting hygiene.',
            },
            {
              number: '03',
              title: 'Model',
              description:
                'Three-statement, scenario, and sensitivity layers built for board, lender, and investor scrutiny.',
            },
            {
              number: '04',
              title: 'Advise',
              description:
                'Findings, recommendations, and negotiation support. Not just a deliverable, an opinion.',
            },
          ],
        },
      },
      {
        section_type: 'quote',
        content: {
          quote_text:
            'A model is a tool for thinking, not a tool for justifying what was already decided.',
          attribution_name: 'PMBC',
          attribution_role: 'Engagement principle',
          attribution_photo_url: '',
          alignment: 'center',
        },
      },
      {
        section_type: 'cta_block',
        content: {
          headline: 'Have a mandate to discuss?',
          subhead:
            'Tell us about the deal. We respond within 1–2 business days.',
          cta_primary_label: 'Start a conversation',
          cta_primary_href: '/contact',
          cta_secondary_label: 'See services',
          cta_secondary_href: '/services',
          background_style: 'dark',
        },
      },
    ],
  },
  {
    page_slug: 'sectors',
    sections: [
      {
        section_type: 'sector_grid',
        content: {
          heading: 'Sector coverage',
          intro:
            'Mandates we have led, contributed to, or actively underwrite for clients across KSA, the GCC, and worldwide.',
          sectors: [
            {
              icon_name: 'building2',
              title: 'Real estate & hospitality',
              description:
                'Master-plans, mixed-use, residential, hospitality, and residual land valuations.',
            },
            {
              icon_name: 'droplet',
              title: 'Oil, gas & energy',
              description:
                'Upstream, midstream, biofuel, and energy-transition transactions across the region.',
            },
            {
              icon_name: 'server',
              title: 'Data centers',
              description:
                'Hyperscale and enterprise builds: power, cooling, fit-out, and tenancy underwriting.',
            },
            {
              icon_name: 'factory',
              title: 'Industrial & manufacturing',
              description:
                'Process plants, capacity expansions, and roll-up acquisitions in industrial groups.',
            },
            {
              icon_name: 'wrench',
              title: 'Industrial services',
              description:
                'O&M, MRO, waste management, and adjacent service-economy mandates.',
            },
            {
              icon_name: 'hammer',
              title: 'Construction & contracting',
              description:
                'Backlog conversion analysis, claims modelling, and contractor financial review.',
            },
            {
              icon_name: 'banknote',
              title: 'Financial services',
              description:
                'Family offices, investment offices, and lender-side underwriting support.',
            },
            {
              icon_name: 'hospital',
              title: 'Healthcare',
              description:
                'Hospital, clinic-network, and healthcare-asset transactions.',
            },
            {
              icon_name: 'shopping_bag',
              title: 'Consumer & retail',
              description:
                'Retail roll-outs, F&B, and consumer-brand acquisitions across the GCC.',
            },
          ],
        },
      },
    ],
  },
  {
    page_slug: 'network',
    sections: [
      {
        section_type: 'network_partners',
        content: {
          heading: 'Strategic network',
          intro:
            'We extend our reach through partnerships with regional firms whose presence and expertise complement our own.',
          partners: [
            {
              logo_url: '',
              name: 'Sky Gulf',
              location: 'Al Khobar, Saudi Arabia',
              description:
                'Long-standing partner in the Eastern Province with deep relationships across KSA family groups, industrial clients, and lenders. Sky Gulf extends PMBC mandates into KSA on-the-ground execution.',
              role_tag: 'Strategic Partner',
              link: '',
            },
            {
              logo_url: '',
              name: 'Lynkers',
              location: 'Manama, Bahrain',
              description:
                'Bahrain-based corporate finance and advisory firm. Our shareholding relationship gives PMBC reach across Bahraini corporates, family holdings, and the broader Gulf banking network.',
              role_tag: 'Equity Shareholder',
              link: '',
            },
          ],
        },
      },
    ],
  },
  {
    page_slug: 'about',
    sections: [
      {
        section_type: 'founder_block',
        content: {
          photo_url: '',
          name: 'Ahmad Din',
          credentials_line: 'Founder · Corporate finance · Transaction advisory',
          bio_html:
            '<p>Ahmad founded PaceMakers to bring senior, analytically grounded advisory to mandates the bulge-bracket firms either skip or under-staff. His background spans biofuel, oil &amp; gas, waste management, data center, construction, and industrial services transactions across KSA and the GCC.</p><p>For the full professional bio (including platforms, prior firms, and selected mandates), see his page on Financial Modeler Pro.</p>',
          cta_primary_label: 'Full bio on FMP',
          cta_primary_href: 'https://www.financialmodelerpro.com/about/ahmad-din',
          cta_secondary_label: 'Start a conversation',
          cta_secondary_href: '/contact',
          layout: 'image_left',
        },
      },
      {
        section_type: 'text_image',
        content: {
          heading: 'A boutique by design',
          body_html:
            '<p>PaceMakers is deliberately small. Every engagement is led by a senior who has personally underwritten transactions on the buy-side, sell-side, and lender-side. We do not run a leverage model where work cascades to first-year analysts.</p><p>The result is fewer, deeper mandates, and clients who come back.</p>',
          image_url: '',
          image_alt: '',
          image_caption: '',
          image_position: 'right',
          cta_label: 'See our approach',
          cta_href: '/approach',
        },
      },
    ],
  },
  {
    page_slug: 'financial-modeler-pro',
    sections: [
      {
        section_type: 'fmp_intro',
        content: {
          heading: 'The platform built by practitioners',
          description_html:
            '<p>Financial Modeler Pro is PMBC&rsquo;s flagship platform: a learning environment, model library, and analyst toolkit built from the same engagement experience that drives the advisory practice.</p>',
          feature_points: [
            'Institutional-grade model templates',
            'Structured learning tracks for analysts',
            'Real engagement-derived case studies',
            'Built and maintained by working practitioners',
          ],
          cta_label: 'Visit Financial Modeler Pro',
          cta_href: 'https://www.financialmodelerpro.com',
          logo_url: '',
        },
      },
    ],
  },
  {
    page_slug: 'service-business-valuation',
    sections: [
      {
        section_type: 'service_detail',
        content: {
          service_slug: 'business-valuation',
          full_description_html:
            '<p>We deliver independent business valuations used in transactions, fairness opinions, dispute settings, shareholder buyouts, and strategic planning. Every valuation triangulates DCF with comparable transactions and trading multiples, and explains, in writing, where the methods agree and disagree.</p><p>Our reports are written for a board, lender, or court audience. Methodology is defensible. Assumptions are sourced. Sensitivities are real.</p>',
          deliverables: [
            'Three-method valuation with reconciliation',
            'Standalone written report (board-ready)',
            'Underlying DCF and comparables workbooks',
            'Sensitivity tornado and scenario tables',
            'Q&A support during negotiation or review',
          ],
          timeline_text:
            'Typical engagement: 3–5 weeks from kickoff, depending on data-room readiness and review cycles.',
          target_audience_text:
            'Family offices, corporates, and lenders requiring an independent, defensible value conclusion.',
        },
      },
    ],
  },
];

async function main() {
  loadEnvLocal();

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Delete any prior phase-6 smoke rows.
  const { error: delErr } = await supabase
    .from('page_sections')
    .delete()
    .filter('styles->>smoke', 'eq', 'phase6');

  if (delErr) throw new Error('Cleanup failed: ' + delErr.message);
  console.log('Cleared prior phase6 smoke rows.');

  // Insert fresh rows page-by-page.
  for (const { page_slug, sections } of SEEDS) {
    const rows = sections.map((s, idx) => ({
      page_slug,
      section_type: s.section_type,
      content: s.content,
      styles: SMOKE_TAG,
      display_order: 1000 + idx * 10,
      visible: true,
    }));
    const { error: insErr, data } = await supabase
      .from('page_sections')
      .insert(rows)
      .select('id, section_type');
    if (insErr) throw new Error(`Insert into ${page_slug} failed: ` + insErr.message);
    console.log(
      `[${page_slug}]`,
      data.map((r) => r.section_type).join(', '),
    );
  }

  console.log('---');
  console.log('Phase 6 smoke sections seeded.');
  console.log('Visit:');
  console.log('  /approach            → process_steps + quote + cta_block');
  console.log('  /sectors             → sector_grid');
  console.log('  /network             → network_partners');
  console.log('  /about               → founder_block + text_image');
  console.log('  /financial-modeler-pro → fmp_intro');
  console.log('  /service-business-valuation → service_detail');
  process.exit(0);
}

main().catch((err) => {
  console.error('seed-phase6-sections failed:', err.message);
  process.exit(1);
});
