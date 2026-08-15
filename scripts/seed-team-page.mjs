// scripts/seed-team-page.mjs
//
// Applies migration 059_team_page.sql through supabase-js.
//
// Three parts, in order:
//   1. The founding partner's card in `team_members`, derived from the
//      founder_hero section of /about/ahmad-din rather than retyped.
//   2. The footer's Team link flipped visible in (footer_settings, links).
//   3. A `site_pages` row for /team, placed one step ahead of Contact.
//
//   node scripts/seed-team-page.mjs           apply
//   node scripts/seed-team-page.mjs --dry-run report only
//   npm run seed-team-page
//
// Safe on re-run. Each part is guarded and reports "skip" when its work is
// already done, so this cannot duplicate the card or the nav row, and cannot
// overwrite a card an operator has since edited. Every write is read back and
// checked before success is reported.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const DRY_RUN = process.argv.includes('--dry-run');

const FOUNDER_PAGE_SLUG = 'about-ahmad-din';
const FOUNDER_SECTION = 'founder_hero';
// Not derived from the profile: see the migration header for why.
const FOUNDER_ROLE = 'Founding Partner';
const TEAM_HREF = '/team';
const TEAM_LABEL = 'Team';
const FOOTER_LINK_ID = 'team';

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

const norm = (s) => String(s ?? '').trim().toLowerCase();

/* ------------------------------------------------------------------ */
/* 1. The founding partner's card                                      */
/* ------------------------------------------------------------------ */

async function seedFounderCard(db) {
  console.log('\n1. Founding partner card');

  const { data: section, error: sectionErr } = await db
    .from('page_sections')
    .select('content')
    .eq('page_slug', FOUNDER_PAGE_SLUG)
    .eq('section_type', FOUNDER_SECTION)
    .order('display_order', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (sectionErr) throw new Error('founder_hero read failed: ' + sectionErr.message);

  if (!section) {
    // Not fatal. The other two parts still apply, and a card can be added by
    // hand. Failing the whole run over it would leave the nav and footer
    // half-configured for no gain.
    console.log(`  SKIP no ${FOUNDER_SECTION} section on /${FOUNDER_PAGE_SLUG}. Nothing to derive from.`);
    return { seeded: false, name: null };
  }

  const content = section.content ?? {};
  const name = String(content.name ?? '').trim();
  if (!name) {
    console.log('  SKIP the founder_hero section has no name. Nothing to derive from.');
    return { seeded: false, name: null };
  }

  const intro = String(content.intro ?? '').trim();
  const card = {
    name,
    role: FOUNDER_ROLE,
    credentials: String(content.credentials_line ?? '').trim() || null,
    // Wrapped so `.pmbc-prose p` applies. See the migration header.
    bio: intro ? `<p>${intro}</p>` : null,
    photo: String(content.photo_url ?? '').trim() || null,
    display_order: 0,
    visible: true,
  };

  const { data: existingRows, error: existErr } = await db
    .from('team_members')
    .select('id, name');
  if (existErr) throw new Error('team_members read failed: ' + existErr.message);

  const already = (existingRows ?? []).find((r) => norm(r.name) === norm(name));
  if (already) {
    console.log(`  skip  "${name}" is already in the team list. Left exactly as it is.`);
    return { seeded: false, name };
  }

  console.log(`  derived from /${FOUNDER_PAGE_SLUG} ${FOUNDER_SECTION}:`);
  console.log(`    name           ${card.name}`);
  console.log(`    role           ${card.role}  (not derived, see the migration header)`);
  console.log(`    qualifications ${card.credentials ?? '(none on the profile)'}`);
  console.log(`    experience     ${intro ? intro.slice(0, 72) + (intro.length > 72 ? '...' : '') : '(none on the profile)'}`);
  console.log(`    photo          ${card.photo ?? '(none yet, renders a monogram panel)'}`);

  if (DRY_RUN) {
    console.log('  would insert the card.');
    return { seeded: false, name };
  }

  const { error } = await db.from('team_members').insert(card);
  if (error) throw new Error('team_members insert failed: ' + error.message);
  console.log('  insert done.');
  return { seeded: true, name };
}

/* ------------------------------------------------------------------ */
/* 2. The footer's Team link                                           */
/* ------------------------------------------------------------------ */

async function seedFooterLink(db) {
  console.log('\n2. Footer Team link');

  const { data: row, error: readErr } = await db
    .from('cms_content')
    .select('value')
    .eq('section', 'footer_settings')
    .eq('key', 'links')
    .maybeSingle();
  if (readErr) throw new Error('footer links read failed: ' + readErr.message);

  if (!row || !String(row.value ?? '').trim()) {
    // The renderer falls back to DEFAULT_FOOTER_LINKS, where Team already ships
    // visible, so the footer is correct either way. Say so rather than writing a
    // whole array this migration is not the owner of.
    console.log('  SKIP no stored (footer_settings, links) row. The shipped defaults already show Team.');
    return;
  }

  let links;
  try {
    links = JSON.parse(row.value);
  } catch {
    throw new Error('(footer_settings, links) is not valid JSON. Fix it in /admin/content first.');
  }
  if (!Array.isArray(links)) {
    throw new Error('(footer_settings, links) is not an array. Fix it in /admin/content first.');
  }

  const entry = links.find((l) => l && l.id === FOOTER_LINK_ID);
  if (!entry) {
    console.log(`  SKIP no "${FOOTER_LINK_ID}" entry in the stored list. Add it in /admin/footer-links.`);
    return;
  }
  if (entry.visible === true) {
    console.log('  skip  the Team link is already visible.');
    return;
  }
  if (DRY_RUN) {
    console.log('  would set the Team link visible.');
    return;
  }

  const next = links.map((l) =>
    l && l.id === FOOTER_LINK_ID ? { ...l, visible: true } : l,
  );
  const { error } = await db
    .from('cms_content')
    .update({ value: JSON.stringify(next), updated_at: new Date().toISOString() })
    .eq('section', 'footer_settings')
    .eq('key', 'links');
  if (error) throw new Error('footer links update failed: ' + error.message);
  console.log('  update done. The link still stays hidden until a member is published.');
}

/* ------------------------------------------------------------------ */
/* 3. The navbar row                                                   */
/* ------------------------------------------------------------------ */

async function seedNavRow(db) {
  console.log('\n3. Pages & Nav row');

  const { data: rows, error: readErr } = await db
    .from('site_pages')
    .select('id, label, href, display_order')
    .order('display_order', { ascending: true });
  if (readErr) throw new Error('site_pages read failed: ' + readErr.message);

  const all = rows ?? [];
  if (all.some((r) => norm(r.href) === TEAM_HREF)) {
    console.log(`  skip  a ${TEAM_HREF} row already exists.`);
    return;
  }

  const contact = all.find((r) => norm(r.href) === '/contact');
  const displayOrder = contact
    ? contact.display_order - 1
    : all.reduce((max, r) => Math.max(max, r.display_order ?? 0), 0) + 10;

  console.log(
    contact
      ? `  placing "${TEAM_LABEL}" at display_order ${displayOrder}, one ahead of Contact (${contact.display_order}).`
      : `  no /contact row found. Appending "${TEAM_LABEL}" at display_order ${displayOrder}.`,
  );

  if (DRY_RUN) {
    console.log('  would insert the nav row.');
    return;
  }

  const { error } = await db
    .from('site_pages')
    .insert({ label: TEAM_LABEL, href: TEAM_HREF, display_order: displayOrder, visible: true });
  if (error) throw new Error('site_pages insert failed: ' + error.message);
  console.log('  insert done. The item stays out of the navbar until a member is published.');
}

/* ------------------------------------------------------------------ */
/* Verification                                                        */
/* ------------------------------------------------------------------ */

async function verify(db) {
  console.log('\nVerifying...');
  let ok = true;

  const { data: members } = await db
    .from('team_members')
    .select('name, role, credentials, bio, photo, visible, display_order')
    .eq('visible', true)
    .order('display_order', { ascending: true });
  const published = members ?? [];
  if (published.length === 0) {
    console.error('  FAIL no published team member. /team would stay hidden everywhere.');
    ok = false;
  } else {
    console.log(`  ok    ${published.length} published member(s).`);
    for (const m of published) {
      const missing = [];
      if (!m.role) missing.push('role');
      if (!m.credentials) missing.push('qualifications');
      if (!m.bio) missing.push('experience');
      if (!m.photo) missing.push('photo');
      const note = missing.length ? `  (no ${missing.join(', ')})` : '';
      console.log(`        ${m.display_order}  ${m.name}, ${m.role ?? 'no role'}${note}`);
    }
    // A missing portrait renders an honest monogram panel, so this is a note
    // rather than a failure. It is still the thing most worth finishing.
    if (published.some((m) => !m.photo)) {
      console.log('  note  a member with no photo renders a navy monogram panel.');
    }
  }

  const { data: linkRow } = await db
    .from('cms_content')
    .select('value')
    .eq('section', 'footer_settings')
    .eq('key', 'links')
    .maybeSingle();
  if (linkRow && String(linkRow.value ?? '').trim()) {
    try {
      const entry = JSON.parse(linkRow.value).find((l) => l && l.id === FOOTER_LINK_ID);
      if (!entry) {
        console.log('  note  no Team entry in the stored footer list. The shipped default covers it.');
      } else if (entry.visible === true) {
        console.log('  ok    the footer Team link is visible.');
      } else {
        console.error('  FAIL the footer Team link is still hidden.');
        ok = false;
      }
    } catch {
      console.error('  FAIL (footer_settings, links) is not valid JSON.');
      ok = false;
    }
  } else {
    console.log('  note  no stored footer links row. The shipped defaults show Team.');
  }

  const { data: navRows } = await db
    .from('site_pages')
    .select('label, href, visible, display_order')
    .order('display_order', { ascending: true });
  const teamRow = (navRows ?? []).find((r) => norm(r.href) === TEAM_HREF);
  if (!teamRow) {
    console.error(`  FAIL no ${TEAM_HREF} row in site_pages. It cannot reach the navbar.`);
    ok = false;
  } else if (!teamRow.visible) {
    console.log('  note  the Team nav row exists but is hidden in Pages & Nav. That is an operator choice and is honoured.');
  } else {
    const order = (navRows ?? [])
      .filter((r) => r.visible)
      .map((r) => r.label)
      .join(' > ');
    console.log(`  ok    the Team nav row is visible. Menu order: ${order}`);
  }

  if (ok) {
    console.log('\nCOMPLETE. /team renders, and the navbar, footer and sitemap now offer it.');
  } else {
    process.exitCode = 1;
  }
}

async function main() {
  loadEnvLocal();
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  }
  const db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  await seedFounderCard(db);
  await seedFooterLink(db);
  await seedNavRow(db);

  if (DRY_RUN) {
    console.log('\nDry run, nothing written.');
    return;
  }
  await verify(db);
}

main().catch((err) => {
  console.error('seed-team-page failed:', err.message);
  process.exitCode = 1;
});
