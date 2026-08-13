// scripts/seed-email-branding.mjs
//
// Applies migration 056_email_branding_and_templates.sql through supabase-js.
//
//   node scripts/seed-email-branding.mjs           apply
//   node scripts/seed-email-branding.mjs --dry-run report only
//   npm run seed-email-branding
//
// Seeds the email signature and footer, and rebuilds both transactional
// templates. See the migration header for what was wrong and why the logo is
// deliberately not seeded here.
//
// The two branding rows are written only while blank, so an operator edit is
// never overwritten. The two templates are replaced outright, which is the
// intent: both still held the migration 008 placeholder text.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const DRY_RUN = process.argv.includes('--dry-run');

const MIGRATION = path.join(
  projectRoot,
  'supabase',
  'migrations',
  '056_email_branding_and_templates.sql',
);

/**
 * The four values, read out of the migration file rather than duplicated here.
 *
 * Two copies of several hundred characters of HTML is two things to keep in
 * step, and the one that drifts is always the one nobody reads. The migration
 * is the source; this script parses the four literals out of it.
 */
function extractFromMigration() {
  const sql = fs.readFileSync(MIGRATION, 'utf8');

  const grab = (label, re, source = sql) => {
    const m = source.match(re);
    if (!m) throw new Error(`could not find ${label} in the migration file`);
    // SQL escapes a single quote by doubling it.
    return m[1].replace(/''/g, "'");
  };

  /**
   * Isolates one UPDATE statement before reading fields out of it.
   *
   * Matching `body_html = '...'` against the whole file does not work: the
   * pattern is non-greedy from the first occurrence, so reading the second
   * template swallows the first one plus everything between them. The first
   * attempt here did exactly that and produced an acknowledgement body twice
   * the size of the real one, which is why the extraction is split in two.
   */
  const statementFor = (templateKey) => {
    const blocks = sql.split(/(?=UPDATE email_templates\b)/);
    const block = blocks.find((b) =>
      new RegExp(`WHERE template_key = '${templateKey}'`).test(b),
    );
    if (!block) throw new Error(`no UPDATE block for ${templateKey}`);
    return block;
  };

  const notification = statementFor('contact_notification');
  const ack = statementFor('contact_acknowledgement');

  return {
    signature: grab('signature_html', /SET signature_html = '([\s\S]*?)',\n\s*updated_at/),
    footer: grab('footer_html', /SET footer_html = '([\s\S]*?)',\n\s*updated_at/),
    notificationSubject: grab('notification subject', /SET subject = '([\s\S]*?)',\n/, notification),
    notificationBody: grab(
      'notification body',
      /body_html = '([\s\S]*?)',\n\s*updated_at = NOW\(\)/,
      notification,
    ),
    ackSubject: grab('acknowledgement subject', /SET subject = '([\s\S]*?)',\n/, ack),
    ackBody: grab(
      'acknowledgement body',
      /body_html = '([\s\S]*?)',\n\s*updated_at = NOW\(\)/,
      ack,
    ),
  };
}

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

let changes = 0;
const act = (msg) => {
  changes += 1;
  console.log(`  ${DRY_RUN ? 'would ' : ''}${msg}`);
};

async function main() {
  loadEnvLocal();
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  const db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const v = extractFromMigration();
  console.log(
    `read from the migration: signature ${v.signature.length} chars, footer ${v.footer.length}, ` +
      `notification ${v.notificationBody.length}, acknowledgement ${v.ackBody.length}\n`,
  );

  // ---- 1 and 2. branding ----------------------------------------------------
  const { data: branding, error: brandingError } = await db
    .from('email_branding')
    .select('signature_html, footer_html, logo_url')
    .eq('id', 1)
    .maybeSingle();
  if (brandingError) throw new Error('read email_branding: ' + brandingError.message);

  const blank = (s) => !s || !s.trim();
  const patch = {};
  if (blank(branding?.signature_html)) {
    act('write the email signature');
    patch.signature_html = v.signature;
  } else {
    console.log('  skip  the signature is already set, leaving it alone');
  }
  if (blank(branding?.footer_html)) {
    act('write the email footer with contact details and the registration line');
    patch.footer_html = v.footer;
  } else {
    console.log('  skip  the footer is already set, leaving it alone');
  }

  if (!DRY_RUN && Object.keys(patch).length > 0) {
    const { error } = await db
      .from('email_branding')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', 1);
    if (error) throw new Error('update email_branding: ' + error.message);
  }

  // ---- 3 and 4. templates ---------------------------------------------------
  const templates = [
    {
      key: 'contact_notification',
      subject: v.notificationSubject,
      body: v.notificationBody,
      what: 'the admin notification',
    },
    {
      key: 'contact_acknowledgement',
      subject: v.ackSubject,
      body: v.ackBody,
      what: 'the enquirer acknowledgement',
    },
  ];

  for (const t of templates) {
    const { data: row } = await db
      .from('email_templates')
      .select('body_html')
      .eq('template_key', t.key)
      .maybeSingle();
    if (!row) {
      console.error(`  FAIL  no ${t.key} row to update`);
      process.exitCode = 1;
      return;
    }
    if (row.body_html === t.body) {
      console.log(`  skip  ${t.what} is already the current version`);
      continue;
    }
    act(`rebuild ${t.what} (${row.body_html.length} chars to ${t.body.length})`);
    if (!DRY_RUN) {
      const { error } = await db
        .from('email_templates')
        .update({
          subject: t.subject,
          body_html: t.body,
          updated_at: new Date().toISOString(),
        })
        .eq('template_key', t.key);
      if (error) throw new Error(`update ${t.key}: ` + error.message);
    }
  }

  if (DRY_RUN) {
    console.log(`\nDry run, nothing written. ${changes} change(s) pending.`);
    return;
  }

  // ---- verify ---------------------------------------------------------------
  console.log('\nVerifying...');
  const failures = [];

  const { data: after } = await db
    .from('email_branding')
    .select('signature_html, footer_html, logo_url')
    .eq('id', 1)
    .maybeSingle();

  if (blank(after?.signature_html)) failures.push('the signature is still blank');
  if (blank(after?.footer_html)) failures.push('the footer is still blank');
  if (!(after?.footer_html ?? '').includes('LLP Act, 2017')) {
    failures.push('the footer does not carry the registration line');
  }
  if (!(after?.footer_html ?? '').includes('advisory@pacemakersglobal.com')) {
    failures.push('the footer does not carry a contact address');
  }
  // Deliberately NULL: the shell falls back to branding_config.logo_dark_url,
  // which is the mark made for a dark header and is already uploaded. This
  // asserts the fallback is reachable rather than that a URL was copied.
  if (after?.logo_url) {
    console.log('  note  an email-specific logo is set, so it overrides the site dark logo');
  } else {
    const { data: site } = await db
      .from('branding_config')
      .select('logo_dark_url, logo_url')
      .eq('id', 1)
      .maybeSingle();
    if (!site?.logo_dark_url && !site?.logo_url) {
      failures.push('no logo is reachable: email logo, site dark logo and site logo are all unset');
    } else {
      console.log(`  ok    header logo resolves to ${site.logo_dark_url ? 'the site dark logo' : 'the site logo'}`);
    }
  }

  const { data: tpls } = await db
    .from('email_templates')
    .select('template_key, subject, body_html, enabled');
  for (const t of templates) {
    const row = (tpls ?? []).find((r) => r.template_key === t.key);
    if (!row) {
      failures.push(`${t.key} is missing`);
      continue;
    }
    if (row.body_html !== t.body) failures.push(`${t.key} body did not take`);
    if (row.subject !== t.subject) failures.push(`${t.key} subject did not take`);
    if (!row.enabled) failures.push(`${t.key} is disabled, so it will not send`);
    // The placeholder markup this replaces.
    if (/<p><strong>Name:<\/strong>/.test(row.body_html)) {
      failures.push(`${t.key} still holds the migration 008 placeholder`);
    }
  }

  const ack = (tpls ?? []).find((r) => r.template_key === 'contact_acknowledgement');
  if (ack && !ack.body_html.includes('/confidentiality')) {
    failures.push('the acknowledgement does not link to the confidentiality statement');
  }
  if (ack && !ack.body_html.includes('/book')) {
    failures.push('the acknowledgement does not offer a booking link');
  }

  const notif = (tpls ?? []).find((r) => r.template_key === 'contact_notification');
  if (notif && !notif.body_html.includes('{{message_html}}')) {
    failures.push('the notification does not use the line-break-preserving message variable');
  }

  // Every variable the templates reference must be one the route supplies,
  // since an unknown one renders as a literal {{placeholder}} in a live email.
  const SUPPLIED = new Set([
    'name', 'email', 'company', 'phone', 'country', 'service_interest',
    'source_page', 'message', 'message_html', 'submission_id', 'company_suffix',
  ]);
  for (const row of tpls ?? []) {
    const used = [...`${row.subject} ${row.body_html}`.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)]
      .map((m) => m[1]);
    for (const name of new Set(used)) {
      if (!SUPPLIED.has(name)) {
        failures.push(`${row.template_key} uses {{${name}}}, which the contact route does not supply`);
      }
    }
  }

  // Written as escapes rather than the literal characters, so this file
  // itself passes the repository's em-dash gate.
  const DASHES = new RegExp('[\u2013\u2014]');
  for (const row of tpls ?? []) {
    if (DASHES.test(row.subject) || DASHES.test(row.body_html)) {
      failures.push(`${row.template_key} contains an em or en dash`);
    }
  }
  if (DASHES.test(after?.signature_html ?? '') || DASHES.test(after?.footer_html ?? '')) {
    failures.push('the signature or footer contains an em or en dash');
  }

  if (failures.length) {
    for (const f of failures) console.error('  FAIL ' + f);
    process.exitCode = 1;
    return;
  }
  console.log(`  ${changes} change(s) applied. Both emails branded and every variable resolvable. COMPLETE`);
}

main().catch((err) => {
  console.error('seed-email-branding failed:', err.message);
  process.exitCode = 1;
});
