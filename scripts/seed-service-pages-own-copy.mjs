// scripts/seed-service-pages-own-copy.mjs
//
// Applies migration 067_service_pages_own_copy.sql through supabase-js.
//
// Moves the nine service_<slug> namespaces out of cms_content and into a
// service_detail section on each service page:
//
//   cms_content service_<slug>  ->  page_sections service_detail on service-<slug>
//
//   node scripts/seed-service-pages-own-copy.mjs           apply
//   node scripts/seed-service-pages-own-copy.mjs --dry-run report only
//   npm run seed-service-pages-own-copy
//
// Values are carried at whatever they hold now, never reseeded from a literal,
// so an edit made in the admin survives the move. Two keys change shape rather
// than value: `full_description` becomes `full_description_html`, the name the
// section renderer already used, and `deliverables` becomes a real JSONB array
// instead of a JSON string in a TEXT column.
//
// `show_header` is seeded false. The route used to pass that as a prop because
// the page opens with a hero carrying the same number, title and summary; the
// section registry passes no props beyond the row, so it has to live in it.
//
// Idempotent. Sections are created when absent and adopted when present, and a
// cms_content row is deleted only once the section demonstrably carries the
// value, so an interrupted run cannot leave a page with copy in neither place.
//
// Every write is read back and compared before success is reported.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const DRY_RUN = process.argv.includes('--dry-run');

const SLUGS = [
  'financial-modeling',
  'business-valuation',
  'financial-due-diligence',
  'transaction-advisory',
  'mergers-acquisitions',
  'refm',
  'project-finance',
  'investment-memorandums',
  'cfo-advisory',
];

/** cms_content key -> section content key. Everything else keeps its name. */
const RENAMES = { full_description: 'full_description_html' };

const MEDIA_KEYS = [
  'media_url',
  'media_type',
  'media_poster_url',
  'media_position',
  'media_caption',
];

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

/**
 * The same parser the public route used while this content lived in
 * cms_content: JSON first, newline-split as a fallback, empty lines dropped.
 * Reproduced rather than imported because this script cannot load TypeScript,
 * and a shape change is exactly where a quiet difference would hurt.
 */
function parseDeliverables(raw) {
  const text = (raw ?? '').trim();
  if (!text) return [];
  if (text.startsWith('[')) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        return parsed
          .map((v) => (typeof v === 'string' ? v.trim() : ''))
          .filter((v) => v.length > 0);
      }
    } catch {
      // Fall through to the newline split.
    }
  }
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function buildContent(slug, kv) {
  const content = {
    service_slug: slug,
    show_header: false,
    full_description_html: kv.full_description ?? '',
    deliverables: parseDeliverables(kv.deliverables ?? ''),
    timeline_text: kv.timeline_text ?? '',
    target_audience_text: kv.target_audience_text ?? '',
  };
  for (const k of MEDIA_KEYS) {
    if (k in kv) content[k] = kv[k] ?? '';
  }
  return content;
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

  for (const slug of SLUGS) {
    const section = `service_${slug}`;
    const pageSlug = `service-${slug}`;

    const { data: rows, error } = await db
      .from('cms_content')
      .select('key, value')
      .eq('section', section);
    if (error) throw new Error(`cms_content read (${section}) failed: ` + error.message);
    const kv = Object.fromEntries((rows ?? []).map((r) => [r.key, r.value ?? '']));

    const { data: existing, error: secErr } = await db
      .from('page_sections')
      .select('id, content, styles, display_order')
      .eq('page_slug', pageSlug)
      .eq('section_type', 'service_detail')
      .maybeSingle();
    if (secErr) throw new Error(`page_sections read (${pageSlug}) failed: ` + secErr.message);

    if (Object.keys(kv).length === 0 && !existing) {
      console.log(`skip  ${pageSlug}: no namespace rows and no section. Nothing to do.`);
      continue;
    }

    let content = existing?.content ?? null;

    if (Object.keys(kv).length === 0) {
      console.log(`skip  ${pageSlug}: already moved, section carries the copy`);
    } else if (existing) {
      // The Phase 6 smoke-test row on business-valuation. Adopt it rather than
      // adding a second section to the same page.
      const next = { ...(existing.content ?? {}), ...buildContent(slug, kv) };
      const nextStyles = { ...(existing.styles ?? {}) };
      const hadSmoke = 'smoke' in nextStyles;
      delete nextStyles.smoke;

      if (DRY_RUN) {
        console.log(
          `would adopt ${pageSlug}: existing section at order ${existing.display_order}, refreshed from the namespace${hadSmoke ? ', smoke marker cleared' : ''}`,
        );
        content = next;
      } else {
        const { data: updated, error: upErr } = await db
          .from('page_sections')
          .update({
            content: next,
            styles: nextStyles,
            display_order: 10,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .select('id, content');
        if (upErr) throw new Error(`${pageSlug} update failed: ` + upErr.message);
        if (!updated || updated.length !== 1) {
          throw new Error(`${pageSlug} update matched ${updated?.length ?? 0} rows, expected 1`);
        }
        content = updated[0].content;
        console.log(
          `adopt ${pageSlug}: existing section refreshed, order 10${hadSmoke ? ', smoke marker cleared' : ''}`,
        );
      }
    } else if (DRY_RUN) {
      content = buildContent(slug, kv);
      console.log(
        `would create ${pageSlug}: ${content.deliverables.length} deliverable(s), ${Object.keys(kv).length} key(s) from the namespace`,
      );
    } else {
      const built = buildContent(slug, kv);
      const { data: created, error: insErr } = await db
        .from('page_sections')
        .insert({
          page_slug: pageSlug,
          section_type: 'service_detail',
          content: built,
          styles: {},
          display_order: 10,
          visible: true,
        })
        .select('id, content');
      if (insErr) throw new Error(`${pageSlug} insert failed: ` + insErr.message);
      if (!created || created.length !== 1) {
        throw new Error(`${pageSlug} insert matched ${created?.length ?? 0} rows, expected 1`);
      }
      content = created[0].content;
      console.log(
        `create ${pageSlug}: ${built.deliverables.length} deliverable(s) from the namespace`,
      );
    }

    // ---- Retire the namespace -------------------------------------------
    // A key is removable only once the section carries its value under
    // whichever name it now goes by.
    const carried = (k) => {
      const target = RENAMES[k] ?? k;
      return content !== null && target in content;
    };
    const removable = Object.keys(kv).filter(carried);
    const stranded = Object.keys(kv).filter((k) => !carried(k));

    for (const k of stranded) {
      console.log(`keep  (${section}, ${k}): the section does not carry it, left in place`);
    }
    if (removable.length === 0) {
      if (Object.keys(kv).length > 0) console.log(`skip  (${section}): nothing to delete`);
    } else if (DRY_RUN) {
      console.log(`would delete ${removable.length} (${section}) row(s)`);
    } else {
      const { error: delErr } = await db
        .from('cms_content')
        .delete()
        .eq('section', section)
        .in('key', removable);
      if (delErr) throw new Error(`cms_content delete (${section}) failed: ` + delErr.message);
      console.log(`delete ${removable.length} (${section}) row(s)`);
    }
  }

  if (DRY_RUN) {
    console.log('\nDry run, nothing written.');
    return;
  }

  // ---- Read-back verification --------------------------------------------
  console.log('\nVerifying...');
  const failures = [];

  for (const slug of SLUGS) {
    const pageSlug = `service-${slug}`;
    const { data: secs } = await db
      .from('page_sections')
      .select('id, content, visible, display_order')
      .eq('page_slug', pageSlug)
      .eq('section_type', 'service_detail');

    if (!secs || secs.length === 0) {
      failures.push(`${pageSlug} has no service_detail section`);
      continue;
    }
    if (secs.length > 1) {
      failures.push(`${pageSlug} has ${secs.length} service_detail sections, expected 1`);
      continue;
    }
    const c = secs[0].content ?? {};

    if (!secs[0].visible) failures.push(`${pageSlug} section is hidden`);
    if (c.service_slug !== slug) {
      failures.push(`${pageSlug} service_slug is ${JSON.stringify(c.service_slug)}`);
    }
    // False, not falsy: an absent key reads as true in the renderer and would
    // print the service title a second time under the hero.
    if (c.show_header !== false) {
      failures.push(`${pageSlug} show_header is ${JSON.stringify(c.show_header)}, expected false`);
    }
    if (typeof c.full_description_html !== 'string' || c.full_description_html.trim() === '') {
      failures.push(`${pageSlug} has no full_description_html`);
    }
    if (!Array.isArray(c.deliverables) || c.deliverables.length === 0) {
      failures.push(`${pageSlug} deliverables is ${JSON.stringify(c.deliverables)}`);
    }
    for (const k of ['timeline_text', 'target_audience_text']) {
      if (typeof c[k] !== 'string' || c[k].trim() === '') {
        failures.push(`${pageSlug} has no ${k}`);
      }
    }

    const { data: left } = await db
      .from('cms_content')
      .select('key')
      .eq('section', `service_${slug}`);
    if ((left ?? []).length > 0) {
      failures.push(
        `cms_content (service_${slug}) still has: ${(left ?? []).map((r) => r.key).join(', ')}`,
      );
    }
  }

  // Nothing outside the nine namespaces should have moved.
  const { data: remaining } = await db.from('cms_content').select('section');
  const sections = new Set((remaining ?? []).map((r) => r.section));
  for (const s of ['header_settings', 'footer_settings', 'contact_info', 'seo_defaults']) {
    if (!sections.has(s)) failures.push(`cms_content (${s}) was disturbed`);
  }
  const strayService = [...sections].filter((s) => s.startsWith('service_'));
  if (strayService.length > 0) {
    failures.push(`service namespaces remain: ${strayService.join(', ')}`);
  }

  if (failures.length) {
    for (const f of failures) console.error('  FAIL ' + f);
    console.error(`\n${failures.length} check(s) failed.`);
    process.exitCode = 1;
    return;
  }
  console.log(`  All checks passed across ${SLUGS.length} service pages. COMPLETE`);
}

main().catch((err) => {
  console.error('seed-service-pages-own-copy failed:', err.message);
  process.exitCode = 1;
});
