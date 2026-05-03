// scripts/seed-service-content.mjs
// JS-side equivalent of supabase/migrations/010_seed_service_detail_content.sql.
// Lets dev runs (`npm run seed-service-content`) seed the 9 service-detail
// cms_content namespaces without touching the Supabase SQL editor. The
// migration file remains the source of truth for production deploys.
//
// Idempotent: uses upsert on (section, key) so re-running the script is a
// no-op once rows exist. To force a refresh in dev, pass --force, which
// deletes prior rows for each section before inserting.

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

const FORCE = process.argv.includes('--force');

const SERVICES = [
  {
    slug: 'financial-modeling',
    full_description:
      '<p>Institutional-grade financial models built for board, lender, and investor scrutiny. Three-statement, project-finance, and scenario models calibrated to the decision the model is meant to inform — not to a generic template.</p><p>Every workbook ships with a written methodology note, a transparent assumption sheet, and the live sensitivities a sophisticated reviewer will ask for.</p>',
    deliverables: [
      'Three-statement integrated model',
      'Scenario and sensitivity layer',
      'Documented assumption sheet',
      'Methodology note',
      'Driver-based summary outputs',
      'Live model walk-through with the team',
    ],
    timeline_text:
      'Typical engagement: 4–6 weeks for an institutional model, depending on data-room readiness and review cycles.',
    target_audience_text:
      'Family offices, corporates, and lenders who need a model that survives diligence and supports a real decision — not a polished spreadsheet.',
  },
  {
    slug: 'business-valuation',
    full_description:
      '<p>Independent business valuations for transactions, fairness opinions, dispute settings, shareholder buyouts, and strategic planning. Every valuation triangulates DCF with comparable transactions and trading multiples — and explains, in writing, where the methods agree and disagree.</p><p>Reports are written for a board, lender, or court audience. Methodology is defensible. Assumptions are sourced. Sensitivities are real.</p>',
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
  {
    slug: 'financial-due-diligence',
    full_description:
      '<p>Buy-side and sell-side quality-of-earnings, working-capital, and net-debt analyses. We go beyond reconciling the trial balance to the audited statements — we surface the accounting treatments, one-off items, and run-rate adjustments that actually change the deal price.</p><p>Findings are written for the deal team. No filler. No 200-page decks no one reads.</p>',
    deliverables: [
      'Quality-of-earnings analysis with adjustments',
      'Working capital normalisation',
      'Net debt and debt-like items schedule',
      'Customer / revenue concentration analysis',
      'Findings memo focused on price and structure',
    ],
    timeline_text:
      'Typical engagement: 4–8 weeks, scaled to data-room volume and target complexity.',
    target_audience_text:
      'Buy-side acquirers, sell-side sponsors, and lenders evaluating credit quality of an underwriting target.',
  },
  {
    slug: 'transaction-advisory',
    full_description:
      '<p>End-to-end deal support from screening through close. We sit on the deal team — not adjacent to it — and own the analytical workstream from term sheet through definitive documents.</p><p>This is the engagement clients return for: senior involvement at every step, no hand-offs to junior teams, and a single accountable advisor through closing.</p>',
    deliverables: [
      'Target screening and prioritisation',
      'Indicative bid modelling and structuring',
      'Deal-team analytical support through diligence',
      'Negotiation support on price and terms',
      'Close-mechanics modelling (working capital, leakage)',
    ],
    timeline_text:
      'Engagement length tracks the deal — typically 3–9 months from mandate to close.',
    target_audience_text:
      "Family offices, corporates, and sponsors who want a senior advisor embedded in the deal — not a vendor running a process at arm's length.",
  },
  {
    slug: 'mergers-acquisitions',
    full_description:
      '<p>Sell-side mandates, buy-side searches, and strategic combinations across the GCC and worldwide. We run focused, well-prepared processes — not auctions optimised for headline volume.</p><p>For sellers: a defensible information memorandum, a curated buyer list, and disciplined process management. For buyers: targeted searches calibrated to a specific investment thesis.</p>',
    deliverables: [
      'Information memorandum or buyer thesis document',
      'Curated counterparty list',
      'Process management through term sheet and SPA',
      'Negotiation support on price, structure, and reps',
      'Closing coordination with legal and tax advisors',
    ],
    timeline_text:
      'Sell-side: 6–12 months from mandate to close. Buy-side searches: 3–9 months to first qualified term sheet.',
    target_audience_text:
      'Owners considering an exit, corporates pursuing strategic acquisitions, and family offices building or rationalising portfolios.',
  },
  {
    slug: 'real-estate-modeling',
    full_description:
      '<p>Hospitality, residential, mixed-use, and master-plan models with phased construction draws, IRR waterfalls, and exit scenarios. Built to the standard a sophisticated lender or institutional partner will accept without rework.</p><p>Includes residual land valuation, development feasibility, and portfolio cash-flow models for owners and operators across the GCC.</p>',
    deliverables: [
      'Development cash-flow model with phased draws',
      'Equity / debt waterfall and IRR distribution',
      'Residual land valuation (where applicable)',
      'Sensitivities on cost, sales pace, and exit cap',
      'Lender and partner-ready output summary',
    ],
    timeline_text:
      'Typical engagement: 3–6 weeks per asset, longer for master-plans and portfolio rollups.',
    target_audience_text:
      'Real estate developers, family-office principals, and institutional investors underwriting GCC real estate.',
  },
  {
    slug: 'project-finance',
    full_description:
      '<p>Bankable models for infrastructure, energy, and industrial projects, structured for senior-debt sizing, DSCR covenants, and reserve accounts. Built to lender-modelling standards from day one — not converted from a corporate template.</p><p>Includes construction draw scheduling, debt service waterfalls, and the covenant testing lenders require during credit-committee review.</p>',
    deliverables: [
      'Bankable project finance model',
      'Senior-debt sizing and DSCR sculpting',
      'Reserve account and waterfall mechanics',
      'Lender Q&A support through credit committee',
      'Sensitivity and stress testing per lender requirements',
    ],
    timeline_text:
      'Typical engagement: 6–10 weeks to first bankable draft, plus iteration through lender diligence.',
    target_audience_text:
      'Project sponsors, developers, and lenders underwriting infrastructure, energy, and industrial projects across the GCC.',
  },
  {
    slug: 'investment-memorandums',
    full_description:
      '<p>Information memoranda, teasers, and pitch decks calibrated to family offices, strategics, and institutional capital. Written by people who have been on the receiving end — we know what gets read, what gets skipped, and what raises a flag.</p><p>Each document is built backward from the questions a sophisticated investor will ask in the first thirty minutes.</p>',
    deliverables: [
      'Investor-ready information memorandum',
      'One-page teaser for outreach',
      'Management presentation deck',
      'Q&A document anticipating diligence questions',
      'Distribution and outreach support',
    ],
    timeline_text:
      'Typical engagement: 4–8 weeks depending on the depth of supporting materials and management availability.',
    target_audience_text:
      'Founders, owners, and CFOs raising capital or running a sale process who need credible, investor-ready materials.',
  },
  {
    slug: 'cfo-advisory',
    full_description:
      '<p>Fractional CFO engagements covering FP&amp;A, treasury, capital structure, and board reporting for growth-stage companies and family-office portfolio assets. Senior involvement on the cadence the business actually needs — not a templated weekly checklist.</p><p>Engagements typically run on a multi-quarter retainer with clearly scoped deliverables and review cadence.</p>',
    deliverables: [
      'Monthly board pack and KPI dashboard',
      'Rolling 12-month forecast and cash management',
      'Capital structure and debt facility review',
      'Audit and statutory reporting coordination',
      'Strategic finance input on key decisions',
    ],
    timeline_text:
      'Multi-quarter retainer; typical engagements run 6–18 months with quarterly review cycles.',
    target_audience_text:
      'Growth-stage companies and family-office portfolio assets that need senior finance leadership without a full-time hire.',
  },
];

function rowsForService(s) {
  const section = `service_${s.slug}`;
  return [
    { section, key: 'full_description', value: s.full_description },
    { section, key: 'deliverables', value: JSON.stringify(s.deliverables, null, 2) },
    { section, key: 'timeline_text', value: s.timeline_text },
    { section, key: 'target_audience_text', value: s.target_audience_text },
  ];
}

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

  for (const s of SERVICES) {
    const section = `service_${s.slug}`;

    if (FORCE) {
      const { error: delErr } = await supabase
        .from('cms_content')
        .delete()
        .eq('section', section);
      if (delErr) throw new Error(`[${section}] delete failed: ${delErr.message}`);
    }

    const rows = rowsForService(s);
    // Upsert on (section, key); idempotent without --force.
    const { error: upErr } = await supabase
      .from('cms_content')
      .upsert(rows, { onConflict: 'section,key', ignoreDuplicates: !FORCE });
    if (upErr) throw new Error(`[${section}] upsert failed: ${upErr.message}`);
    console.log(`[${section}] ${rows.length} rows ${FORCE ? 'replaced' : 'upserted'}`);
  }

  console.log('---');
  console.log(
    FORCE
      ? 'Service detail content REPLACED for all 9 services.'
      : 'Service detail content seeded for all 9 services (existing rows preserved).',
  );
  process.exit(0);
}

main().catch((err) => {
  console.error('seed-service-content failed:', err.message);
  process.exit(1);
});
