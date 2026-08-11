// scripts/seed-fmp-page-rebuild.mjs
//
// Applies migration 049_fmp_page_rebuild.sql through supabase-js.
//
// Rebuilds the Financial Modeler Pro page in full, for its new home at /fmp.
// Every card, bullet and chip is written here. Nothing is stubbed.
//
// Named `-rebuild` because `seed-fmp-page.mjs` already exists: that one is the
// executable record of migration 018, which seeded the four-section version of
// this page in Phase 9. Applied migrations and their companion scripts are
// never edited in this repo, so this is a new pair rather than a rewrite of
// that one.
//
// WHERE THE FACTS COME FROM
// The session counts, durations, levels, course titles and feature lists were
// read from the live FMP site and its database on 2026-08-11, not invented:
//
//   3SFM  "3-Statement Financial Modeling"  17 Sessions, 6 Hours, Beginner
//   BVM   "Business Valuation Modeling"      6 Lessons,  3 Hours, Intermediate
//
// Two things are worth recording because the sources disagreed.
//
// FMP's `courses` table holds 18 and 7 lesson rows, while its own certificate
// copy says "all 17 assessments" and "all 6 lesson assessments", and its
// public training page renders "17 Sessions" and "6 Lessons". The published
// figures are used, since those are what a reader can check.
//
// The `courses.title` column says "Business Valuation Methods", but the live
// page renders "Business Valuation Modeling". The rendered title is used.
//
// The Modeling Hub bullets come from the seven modules FMP currently marks
// live: Project Setup, Revenue, OpEx, Financials, Returns, Scenario Analysis
// and IC Presentation Builder. The Training Hub bullets come from FMP's own
// process timeline and certificate banner, including the 70% pass mark.
//
//   node scripts/seed-fmp-page-rebuild.mjs           apply
//   node scripts/seed-fmp-page-rebuild.mjs --dry-run report only
//   npm run seed-fmp-page-rebuild
//
// Cannot duplicate rows: it deletes this page's sections and reinserts. That
// also means a re-run restores this copy over later edits to this page.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const DRY_RUN = process.argv.includes('--dry-run');

/** The CMS slug is unchanged; only the public route moved to /fmp. */
const PAGE = 'financial-modeler-pro';

const FMP = 'https://app.financialmodelerpro.com';
const COURSE_3SFM = `${FMP}/training/00000000-0000-0000-0000-0000000035f0`;
const COURSE_BVM = `${FMP}/training/00000000-0000-0000-0000-00000000b600`;

const SECTIONS = [
  // 10 ---------------------------------------------------------------------
  {
    order: 10,
    type: 'hero',
    content: {
      badge_text: 'THE PLATFORM ARM OF PACEMAKERS',
      headline: 'Where financial modeling meets real-world execution',
      subtitle:
        'Built by a practitioner with twelve years on multi-billion riyal deals, now available as free certification training and institutional-grade modeling tools.',
      cta_label: 'Visit Financial Modeler Pro',
      cta_href: 'https://www.financialmodelerpro.com',
      cta_secondary_label: 'Speak to the firm',
      cta_secondary_href: '/contact',
    },
  },

  // 15 ---------------------------------------------------------------------
  {
    order: 15,
    type: 'founder_credentials',
    content: {
      heading: '',
      intro: '',
      display: 'pills',
      items: [
        'Real Estate Models',
        'Business Valuation',
        'Project Finance',
        'Renewable Energy',
        'FP&A',
        'Capital Structuring',
        'Debt Sizing',
        'M&A Advisory',
      ],
    },
  },

  // 20 ---------------------------------------------------------------------
  {
    order: 20,
    type: 'prose_checklist',
    content: {
      eyebrow: 'THE PLATFORM',
      heading: 'What is Financial Modeler Pro.',
      list_heading: 'What you get',
      html:
        '<p>Financial Modeler Pro is the software and training arm of PaceMakers Business Consultants. It takes the modeling frameworks the firm uses on live transactions and makes them directly usable, as structured tools rather than as a consulting engagement.</p>' +
        '<p>It runs as two halves that share one standard of work. The <strong>Training Hub</strong> teaches the method: assessed video courses that end in a verified certificate, free and without a paywall. The <strong>Modeling Hub</strong> is the method in software: guided workflows that build a complete model module by module, from project setup through revenue, costs and financing to returns.</p>' +
        '<p>Every model on the platform is structured for real-world use rather than for a classroom. Assumptions are flagged where they are made and stay traceable to the outputs they drive, so a reviewer can follow any number back to its source. What comes out is a formula-linked Excel workbook that can be taken apart and rebuilt, and an investor-ready PDF that can go to a lender, a board or an investment committee without reformatting.</p>',
      items: [
        {
          title: 'Multi-discipline modeling',
          description:
            'Real estate development, business valuation, project finance, FP&A and corporate finance, each with its own workflow rather than one generic template.',
        },
        {
          title: 'Structured workflows',
          description:
            'A model is built module by module in a fixed order, so nothing is left undefined and no assumption is buried in a cell nobody opens.',
        },
        {
          title: 'Monthly or annual periods',
          description:
            'Choose the periodicity the transaction actually needs. Monthly for construction draws and cash sweeps, annual for long-horizon valuation.',
        },
        {
          title: 'Formula-linked Excel and investor PDF export',
          description:
            'The workbook exports with its formulas intact, not as pasted values, alongside a clean PDF report ready to circulate.',
        },
        {
          title: 'Free certification',
          description:
            'Both certification paths are free, with no subscription and no paywall, and the certificate carries a unique ID that anyone can verify.',
        },
        {
          title: 'Built by a practitioner, not a software company',
          description:
            'Every module reflects how a deal was actually structured. When a live mandate exposes a structure the tools handle badly, the tools change.',
        },
      ],
    },
  },

  // 30 ---------------------------------------------------------------------
  {
    order: 30,
    type: 'service_cards',
    content: {
      eyebrow: 'WHO IT IS FOR',
      headline: 'Built for the people who have to defend the numbers.',
      intro:
        'The platform assumes a working knowledge of finance and no patience for a course that never reaches a model.',
      cards: [
        {
          number: '01',
          title: 'Financial Analysts',
          description:
            'Build a complete, balanced model without starting from an empty workbook every time. The structure, the schedules and the checks are already in place, so the work goes into the assumptions rather than into wiring up the mechanics.',
          link: '',
        },
        {
          number: '02',
          title: 'Investment Professionals',
          description:
            'Screen and underwrite opportunities on a consistent basis. Scenario analysis compares cases side by side, and the IC presentation builder turns the result into a deck whose figures stay linked to the model behind it.',
          link: '',
        },
        {
          number: '03',
          title: 'Real Estate Developers',
          description:
            'Model a phased, multi-asset development properly: mixed unit programmes, construction drawn against a facility with interest capitalised during the build, instalment revenue, and an equity waterfall that survives a lender review.',
          link: '',
        },
        {
          number: '04',
          title: 'Family Offices',
          description:
            'Review your own holdings rather than outsourcing the review. Test a sponsor case yourself, see which assumptions carry the return, and hold an independent view before committing capital.',
          link: '',
        },
        {
          number: '05',
          title: 'Lenders and Banks',
          description:
            'Interrogate a borrower model on your own terms. DSCR, debt sizing, sculpting and covenant headroom are computed explicitly, so a credit team can stress the case rather than accept a sponsor summary.',
          link: '',
        },
        {
          number: '06',
          title: 'Students and Aspiring Analysts',
          description:
            'Learn the method that firms actually use, then prove it. Both certification paths are free, assessed rather than attendance-based, and end in a certificate an employer can verify online.',
          link: '',
        },
      ],
    },
  },

  // 40 ---------------------------------------------------------------------
  {
    order: 40,
    type: 'feature_cards',
    content: {
      eyebrow: 'THE TWO HALVES',
      heading: 'Two platforms. One destination.',
      intro:
        'One teaches the method and one runs it. Both are free to start and both open on the Financial Modeler Pro site.',
      cards: [
        {
          title: 'Modeling Hub',
          code: 'BUILD',
          description:
            'The modeling engine. A guided workflow takes a model from project setup through to investor returns, one module at a time, with every calculation traceable to the input that drives it. Real Estate Financial Modeling is live now, with business valuation and equity research in build.',
          meta: ['Live now', 'Free to start'],
          bullets: [
            'Project setup covering structure, land allocation, costs and financing',
            'Revenue modelling across unit sales, hospitality and retail, with cohort-based collection',
            'Operating expense, payroll and fixed-cost schedules across the operating window',
            'A full three-statement output: P&L, cash flow and balance sheet, linked and balanced',
            'Returns analysis with IRR, NPV, MoIC, DSCR, equity multiples and stabilised yield',
            'Scenario analysis and an IC presentation builder whose figures stay linked to the model',
          ],
          note: 'Exports to a formula-linked Excel workbook and an investor-ready PDF.',
          cta_label: 'Explore Modeling Hub',
          cta_href: `${FMP}/modeling`,
        },
        {
          title: 'Training Hub',
          code: 'LEARN',
          description:
            'The method, taught and assessed. Video sessions build the model with you, each one ending in a quiz you have to pass before the next unlocks, and the path finishes with a certification exam. Free, and it stays free.',
          meta: ['2 certification paths', '100% free'],
          bullets: [
            'Two paths: 3-Statement Financial Modeling and Business Valuation Modeling',
            'Sessions delivered on the platform, each ending in an assessment',
            'A 70% pass mark on each session before the next one unlocks',
            'A final certification exam covering the whole path',
            'A verified certificate with a unique ID, QR code and a permanent verification link',
            'No fees, no subscription and no paywall on any course or certificate',
          ],
          note: 'Employers and institutions can verify any certificate online at any time.',
          cta_label: 'Browse Free Courses',
          cta_href: `${FMP}/training`,
        },
      ],
    },
  },

  // 50 ---------------------------------------------------------------------
  {
    order: 50,
    type: 'feature_cards',
    content: {
      eyebrow: 'CERTIFICATION',
      heading: 'Two paths, both free, both assessed.',
      intro:
        'Certification is earned on assessment rather than attendance. Each path ends in an exam and a certificate carrying a unique ID.',
      cards: [
        {
          title: '3-Statement Financial Modeling',
          code: '3SFM',
          description:
            'The complete integrated model, built from zero: income statement, balance sheet and cash flow statement, linked and balanced. The foundation every other discipline on the platform assumes you have.',
          meta: ['17 Sessions', '6 Hours', 'Beginner'],
          bullets: [
            'Build a fully integrated income statement, balance sheet and cash flow statement',
            'Model capex, depreciation, working capital and debt schedules',
            'Create revenue models with capacity planning and production forecasts',
            'Build COGS, payroll, overhead and tax models from scratch',
            'Link all three statements and balance the balance sheet',
            'Apply the Excel techniques used in investment banking and corporate finance',
          ],
          note: 'Verified certificate with a unique ID on passing all 17 assessments and the final exam.',
          cta_label: 'View the 3SFM course',
          cta_href: COURSE_3SFM,
        },
        {
          title: 'Business Valuation Modeling',
          code: 'BVM',
          description:
            'The three core valuation methodologies used by investment bankers, corporate finance teams and equity researchers, built from scratch in Excel and presented as a professional football field chart.',
          meta: ['6 Lessons', '3 Hours', 'Intermediate'],
          bullets: [
            'Apply DCF valuation using both FCFF and FCFE',
            'Build a rolling WACC model and reconcile FCFF against FCFE',
            'Construct a comparable companies valuation model',
            'Calculate and apply EV/EBITDA, P/E and EV/Revenue multiples',
            'Apply control premium and DLOM adjustments',
            'Build a football field chart showing the valuation range',
          ],
          note: 'Verified certificate with a unique ID on passing all 6 lesson assessments and the final exam.',
          cta_label: 'View the BVM course',
          cta_href: COURSE_BVM,
        },
      ],
    },
  },

  // 60 ---------------------------------------------------------------------
  {
    order: 60,
    type: 'cta_block',
    content: {
      eyebrow: 'GET STARTED',
      headline: 'Start on the platform. Come to the firm when it stops being a modeling question.',
      subhead:
        'Registration is free, the Modeling Hub is open and both certification paths cost nothing. When the question moves past the model and becomes a judgment call, PaceMakers takes it from there.',
      cta_primary_label: 'Go to Financial Modeler Pro',
      cta_primary_href: 'https://www.financialmodelerpro.com',
      cta_secondary_label: 'Speak to the firm',
      cta_secondary_href: '/contact',
    },
  },
];

const META = {
  meta_title: 'Financial Modeler Pro | PaceMakers Business Consultants',
  meta_description:
    'Financial Modeler Pro is the platform arm of PaceMakers Business Consultants: guided institutional-grade modeling workflows and free assessed certification in financial modeling and business valuation.',
};

function loadEnvLocal() {
  const envPath = path.join(projectRoot, '.env.local');
  if (!fs.existsSync(envPath)) throw new Error('.env.local not found at ' + envPath);
  for (const rawLine of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
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
    if (!(key in process.env)) process.env[key] = value;
  }
}

async function main() {
  loadEnvLocal();
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: existing } = await db
    .from('page_sections')
    .select('section_type, display_order')
    .eq('page_slug', PAGE)
    .order('display_order');

  console.log(`=== ${PAGE} (served at /fmp) ===`);
  console.log(`  current: ${(existing ?? []).map((r) => r.section_type).join(', ') || 'none'}`);
  console.log(`  target:  ${SECTIONS.map((s) => s.type).join(', ')}`);

  const { data: navRows } = await db.from('site_pages').select('*').order('display_order');
  const navHit = (navRows ?? []).find(
    (n) => n.href === '/fmp' || n.href === '/financial-modeler-pro',
  );

  if (DRY_RUN) {
    console.log(
      `\n  nav: ${navHit ? `would repoint "${navHit.label}" to /fmp` : 'would add "Financial Modeler Pro" -> /fmp'}`,
    );
    console.log(
      `\nDry run, nothing written. Would replace ${existing?.length ?? 0} section(s) with ${SECTIONS.length}.`,
    );
    return;
  }

  const { error: delErr } = await db.from('page_sections').delete().eq('page_slug', PAGE);
  if (delErr) throw new Error('delete: ' + delErr.message);

  const { error: insErr } = await db.from('page_sections').insert(
    SECTIONS.map((s) => ({
      page_slug: PAGE,
      section_type: s.type,
      content: s.content,
      styles: {},
      display_order: s.order,
      visible: true,
    })),
  );
  if (insErr) throw new Error('insert: ' + insErr.message);

  const { error: metaErr } = await db
    .from('cms_pages')
    .update({ ...META, updated_at: new Date().toISOString() })
    .eq('slug', PAGE);
  if (metaErr) throw new Error('meta: ' + metaErr.message);

  // Navbar. Inserted before Contact so the firm's own pages stay leftmost and
  // the contact link keeps the last slot it has always had.
  if (navHit) {
    const { error } = await db
      .from('site_pages')
      .update({
        label: 'Financial Modeler Pro',
        href: '/fmp',
        visible: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', navHit.id);
    if (error) throw new Error('nav update: ' + error.message);
    console.log(`  nav: repointed "${navHit.label}" to /fmp`);
  } else {
    const contact = (navRows ?? []).find((n) => n.href === '/contact');
    const order = contact ? contact.display_order : ((navRows ?? []).length + 1) * 10;
    if (contact) {
      for (const n of (navRows ?? []).filter((r) => r.display_order >= order)) {
        await db
          .from('site_pages')
          .update({ display_order: n.display_order + 10 })
          .eq('id', n.id);
      }
    }
    const { error } = await db.from('site_pages').insert({
      label: 'Financial Modeler Pro',
      href: '/fmp',
      display_order: order,
      visible: true,
    });
    if (error) throw new Error('nav insert: ' + error.message);
    console.log('  nav: added "Financial Modeler Pro" -> /fmp');
  }

  // ---- verify --------------------------------------------------------------
  console.log('\nVerifying...');
  const failures = [];
  const { data: after } = await db
    .from('page_sections')
    .select('section_type, display_order, content')
    .eq('page_slug', PAGE)
    .order('display_order');

  console.log('  ' + (after ?? []).map((r) => `${r.display_order} ${r.section_type}`).join(' | '));
  if ((after ?? []).length !== SECTIONS.length) {
    failures.push(`expected ${SECTIONS.length} sections, found ${after?.length ?? 0}`);
  }

  const blob = JSON.stringify(after ?? []);

  // Nothing is stubbed. This is the check that would catch a placeholder
  // slipping through, which the brief was explicit about.
  for (const row of after ?? []) {
    const c = row.content ?? {};
    for (const card of Array.isArray(c.cards) ? c.cards : []) {
      if (!card.title || !card.description) {
        failures.push(`${row.section_type} has a card missing a title or description`);
      }
      if (row.section_type === 'feature_cards') {
        if ((card.bullets ?? []).length !== 6) {
          failures.push(
            `feature card "${card.title}" has ${(card.bullets ?? []).length} bullets, expected 6`,
          );
        }
        if (!card.cta_label || !card.cta_href) {
          failures.push(`feature card "${card.title}" is missing its CTA`);
        }
      }
    }
    for (const item of Array.isArray(c.items) ? c.items : []) {
      if (item && typeof item === 'object' && !item.title) {
        failures.push(`${row.section_type} has a checklist item with no title`);
      }
    }
  }

  const checklist = (after ?? []).find((r) => r.section_type === 'prose_checklist');
  if ((checklist?.content?.items ?? []).length !== 6) {
    failures.push(`checklist has ${(checklist?.content?.items ?? []).length} items, expected 6`);
  }
  const who = (after ?? []).find(
    (r) => r.section_type === 'service_cards' && r.content?.eyebrow === 'WHO IT IS FOR',
  );
  if ((who?.content?.cards ?? []).length !== 6) {
    failures.push(`"who it is for" has ${(who?.content?.cards ?? []).length} cards, expected 6`);
  }
  const tags = (after ?? []).find((r) => r.section_type === 'founder_credentials');
  if ((tags?.content?.items ?? []).length !== 8) {
    failures.push(`capability tags: ${(tags?.content?.items ?? []).length}, expected 8`);
  }

  for (const needle of [
    '17 Sessions',
    '6 Hours',
    'Beginner',
    '6 Lessons',
    '3 Hours',
    'Intermediate',
  ]) {
    if (!blob.includes(needle)) failures.push(`missing certification detail: ${needle}`);
  }
  for (const needle of [COURSE_3SFM, COURSE_BVM, `${FMP}/modeling`, `${FMP}/training`]) {
    if (!blob.includes(needle)) failures.push(`missing link: ${needle}`);
  }
  // Escaped rather than literal, so this detector does not trip the repo gate.
  if (/[\u2013\u2014]/.test(blob)) {
    failures.push('em or en dash in the seeded copy');
  }

  const { data: nav } = await db
    .from('site_pages')
    .select('label, href, visible')
    .order('display_order');
  console.log('  nav: ' + (nav ?? []).map((n) => `${n.label} -> ${n.href}`).join(', '));
  if (
    !(nav ?? []).some((n) => n.href === '/fmp' && n.label === 'Financial Modeler Pro' && n.visible)
  ) {
    failures.push('navbar is missing a visible Financial Modeler Pro item pointing at /fmp');
  }

  if (failures.length) {
    for (const f of failures) console.error('  FAIL ' + f);
    process.exitCode = 1;
    return;
  }
  console.log('  applied and verified. COMPLETE');
}

main().catch((err) => {
  console.error('seed-fmp-page-rebuild failed:', err.message);
  process.exitCode = 1;
});
