// scripts/seed-network-page.mjs
// JS-side equivalent of supabase/migrations/017_seed_network_page_content.sql.
// Replaces all page_sections rows for page_slug='network' (the Phase 6 smoke
// network_partners) with the Phase 9 production content (4 sections,
// display_order 10..40). Safe to re-run; the DELETE + INSERT is idempotent.
//
// All copy is em-dash and en-dash free per the Content Style Rules in CLAUDE.md.
// Partner facts (Sky Gulf in Al Khobar, Lynkers in Manama and an equity
// shareholder) are drawn from the home page network seed. Partner website URLs
// are unknown, so `link` is left empty rather than fabricated.
//
// Run: node scripts/seed-network-page.mjs

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

loadEnvLocal();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local');
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const SECTIONS = [
  {
    display_order: 10,
    section_type: 'hero',
    content: {
      badge_text: 'STRATEGIC NETWORK',
      headline: 'Reach extended through partners we trust.',
      subtitle:
        'PaceMakers is deliberately lean, but never narrow. Two long-standing relationships extend our reach across the Gulf, giving clients regional presence and execution depth without the overhead of a large firm.',
      cta_label: 'Start a Conversation',
      cta_href: '/contact',
      cta_secondary_label: 'About the Firm',
      cta_secondary_href: '/about',
      background_style: 'light',
    },
  },
  {
    display_order: 20,
    section_type: 'network_partners',
    content: {
      eyebrow: 'THE NETWORK',
      heading: 'Two partners, one standard.',
      intro:
        'We work alongside people we have known for years and whose judgment we trust with our clients. The bar for the network is the same bar we hold ourselves to.',
      partners: [
        {
          logo_url: '',
          name: 'Sky Gulf',
          location: 'Al Khobar, Saudi Arabia',
          role_tag: 'Execution Partner',
          description:
            'Headquartered in the Eastern Province, Sky Gulf brings industrial and project-execution depth to mandates on the ground in Saudi Arabia. The relationship gives clients local presence where the assets and the counterparties actually are.',
          link: '',
        },
        {
          logo_url: '',
          name: 'Lynkers',
          location: 'Manama, Bahrain',
          role_tag: 'Equity Shareholder',
          description:
            'Based in Manama and a strategic equity shareholder in PaceMakers, Lynkers provides Bahrain market access and capital-markets insight. The partnership connects clients to the regional banking and investor network that moves Gulf transactions.',
          link: '',
        },
      ],
    },
  },
  {
    display_order: 30,
    section_type: 'text_image',
    content: {
      eyebrow: 'WHY IT MATTERS',
      heading: 'Boutique judgment, regional reach.',
      body_html:
        '<p>A large firm sells you its logo and staffs you with whoever is available. A network like ours works the opposite way: senior people who choose to work together, brought in only where they add something real.</p><p>For clients, that means the partner you hire stays accountable for the mandate, while the network supplies on-the-ground presence, sector contacts, and capital-markets access exactly where a transaction needs them.</p>',
      image_url: '',
      image_alt: 'PaceMakers strategic network across the GCC',
      image_caption: '',
      image_position: 'right',
      cta_label: 'How we work',
      cta_href: '/approach',
    },
  },
  {
    display_order: 40,
    section_type: 'cta_block',
    content: {
      headline: 'Have a transaction that needs regional reach?',
      subhead:
        'Tell us what you are working on. We will bring the right people to the table, and no one you do not need.',
      cta_primary_label: 'Start a Conversation',
      cta_primary_href: '/contact',
      cta_secondary_label: 'View Services',
      cta_secondary_href: '/services',
      background_style: 'dark',
    },
  },
];

async function main() {
  console.log('Phase 9: Seeding network page sections');

  console.log('  Deleting existing network page_sections rows...');
  const { error: delErr, count: delCount } = await sb
    .from('page_sections')
    .delete({ count: 'exact' })
    .eq('page_slug', 'network');
  if (delErr) throw delErr;
  console.log(`  Deleted ${delCount ?? 0} rows.`);

  console.log(`  Inserting ${SECTIONS.length} new sections...`);
  const rows = SECTIONS.map((s) => ({
    page_slug: 'network',
    section_type: s.section_type,
    content: s.content,
    styles: {},
    display_order: s.display_order,
    visible: true,
  }));
  const { data: inserted, error: insErr } = await sb
    .from('page_sections')
    .insert(rows)
    .select('section_type, display_order');
  if (insErr) throw insErr;
  console.log(`  Inserted ${inserted?.length ?? 0} rows.`);

  console.log('  Bumping cms_pages.updated_at for network...');
  const { error: pageErr } = await sb
    .from('cms_pages')
    .update({ updated_at: new Date().toISOString() })
    .eq('slug', 'network');
  if (pageErr) throw pageErr;

  console.log('\nVerifying page_sections (page_slug=network)...');
  const { data: verify, error: verifyErr } = await sb
    .from('page_sections')
    .select('display_order, section_type')
    .eq('page_slug', 'network')
    .order('display_order', { ascending: true });
  if (verifyErr) throw verifyErr;
  for (const row of verify ?? []) {
    console.log(`  ${String(row.display_order).padStart(3, ' ')}  ${row.section_type}`);
  }
  console.log(`Total rows: ${verify?.length ?? 0}`);

  console.log('\nDone.');
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
