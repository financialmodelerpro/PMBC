// scripts/verify-contact-and-legal.mjs
//
// Verifies the contact form's country controls, the two transactional email
// templates, and the confidentiality statement.
//
//   npm run build && npx next start -p 3999
//   npm run verify-contact-and-legal
//   VERIFY_BASE=http://localhost:3000 node scripts/verify-contact-and-legal.mjs
//
// The country module is imported directly, so composePhone is exercised rather
// than described. The form and the pages are read over HTTP from the running
// build. The email templates are read from the database, which is where they
// live and what the contact route will actually send.
//
// NOT COVERED, deliberately: the assembled email HTML. Rendering it means
// running the route, and running the route means sending real mail to the
// advisory inbox and writing a row into the live enquiry list. That is a live
// side effect, not a test. `npm run seed-email-branding` asserts the stored
// halves, and the shell's own composition rules are checked against its source
// below.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

import {
  COUNTRIES,
  DEFAULT_DIAL_COUNTRY,
  OTHER_COUNTRIES,
  PINNED_COUNTRIES,
  PINNED_COUNTRY_CODES,
  composePhone,
  findCountry,
} from '../src/lib/public/countries.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const BASE = process.env.VERIFY_BASE || 'http://localhost:3999';

let passed = 0;
const failures = [];
function ok(name, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log('  PASS  ' + name);
  } else {
    failures.push(name + (detail ? ' :: ' + detail : ''));
    console.log('  FAIL  ' + name + (detail ? ' :: ' + detail : ''));
  }
}

function loadEnvLocal() {
  const envPath = path.join(projectRoot, '.env.local');
  if (!fs.existsSync(envPath)) return;
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

  // ---- country data ---------------------------------------------------------
  console.log('\n=== country data');
  ok('the list is a full one, not the six GCC states', COUNTRIES.length > 190, String(COUNTRIES.length));
  ok(
    'every entry has a code, a name and a numeric dial code',
    COUNTRIES.every((c) => /^[A-Z]{2}$/.test(c.code) && c.name.length > 1 && /^\d{1,4}$/.test(c.dial)),
    COUNTRIES.filter((c) => !/^\d{1,4}$/.test(c.dial)).map((c) => c.code).join(', '),
  );
  const codes = COUNTRIES.map((c) => c.code);
  ok('no ISO code appears twice', new Set(codes).size === codes.length,
    codes.filter((c, i) => codes.indexOf(c) !== i).join(', '));
  const names = COUNTRIES.map((c) => c.name);
  ok('no country name appears twice', new Set(names).size === names.length,
    names.filter((n, i) => names.indexOf(n) !== i).join(', '));
  ok(
    'the full list is alphabetical',
    names.every((n, i) => i === 0 || names[i - 1].localeCompare(n) <= 0),
    'out of order',
  );
  ok('all seven pinned countries resolve', PINNED_COUNTRIES.every(Boolean) && PINNED_COUNTRIES.length === 7,
    String(PINNED_COUNTRIES.length));
  ok(
    'the pinned seven are the GCC six plus Pakistan',
    ['SA', 'AE', 'QA', 'KW', 'BH', 'OM', 'PK'].every((c) => PINNED_COUNTRY_CODES.includes(c)),
    PINNED_COUNTRY_CODES.join(', '),
  );
  ok('the remainder excludes the pinned seven', OTHER_COUNTRIES.length === COUNTRIES.length - 7,
    `${OTHER_COUNTRIES.length} vs ${COUNTRIES.length - 7}`);
  ok('the phone field defaults to Saudi Arabia', DEFAULT_DIAL_COUNTRY === 'SA', DEFAULT_DIAL_COUNTRY);
  ok('Saudi Arabia dials +966', findCountry('SA')?.dial === '966', findCountry('SA')?.dial);

  // A spot check against known codes. Wrong dial codes are the failure this
  // data can have that nothing else would catch: the form would look right and
  // produce an unreachable number.
  const KNOWN = { AE: '971', QA: '974', KW: '965', BH: '973', OM: '968', PK: '92',
    GB: '44', US: '1', IN: '91', EG: '20', SG: '65', DE: '49', CH: '41', TR: '90' };
  for (const [code, dial] of Object.entries(KNOWN)) {
    ok(`${code} dials +${dial}`, findCountry(code)?.dial === dial, String(findCountry(code)?.dial));
  }

  // ---- composePhone ---------------------------------------------------------
  console.log('\n=== phone composition');
  ok('an empty number stays empty, not a bare prefix', composePhone('SA', '') === '', composePhone('SA', ''));
  ok('whitespace only stays empty', composePhone('SA', '   ') === '', JSON.stringify(composePhone('SA', '   ')));
  ok('a plain number gets the dial code', composePhone('SA', '512345678') === '+966 512345678',
    composePhone('SA', '512345678'));
  ok('a national trunk zero is dropped', composePhone('SA', '0512345678') === '+966 512345678',
    composePhone('SA', '0512345678'));
  ok('a number already in full is left alone', composePhone('SA', '+971 50 123 4567') === '+971 50 123 4567',
    composePhone('SA', '+971 50 123 4567'));
  ok('a number of only zeroes does not become a bare prefix', composePhone('SA', '000') === '',
    JSON.stringify(composePhone('SA', '000')));
  ok('an unknown country code returns the number unchanged', composePhone('ZZ', '512345678') === '512345678',
    composePhone('ZZ', '512345678'));
  ok('another country composes correctly', composePhone('PK', '03001234567') === '+92 3001234567',
    composePhone('PK', '03001234567'));

  // ---- the form as it renders ----------------------------------------------
  console.log('\n=== contact form');
  const contact = await (await fetch(BASE + '/contact')).text();
  ok('the phone field has a country control',
    contact.includes('aria-label="Phone country code"'), 'control missing');
  // The dial-code control is a combobox now, not a native select, so its list
  // does not exist in the served HTML: it is built when the control opens, and
  // its value is applied by react-hook-form after hydration. What is checkable
  // here is that the control is announced correctly before any of that. The
  // list, the filtering, the keyboard contract and the live value are all
  // driven in a real browser in verify-page-rhythm, which is the only place
  // they can honestly be asserted.
  const combobox = (contact.match(/<input[^>]*aria-label="Phone country code"[^>]*>/) || [''])[0];
  ok('the country control is announced as a combobox',
    /role="combobox"/.test(combobox), combobox.slice(0, 120));
  ok('it declares list autocomplete and a collapsed state',
    /aria-autocomplete="list"/.test(combobox) && /aria-expanded="false"/.test(combobox),
    combobox.slice(0, 200));
  ok('it points at the listbox it controls', /aria-controls="/.test(combobox), 'no aria-controls');
  ok('the 206-option native select is gone',
    !/<select[^>]*aria-label="Phone country code"/.test(contact), 'the select is still rendered');
  // Both controls sit inside one <label>, which can only name the first of
  // them, so the number box has to name itself.
  ok('the number box is named independently of the combobox',
    /<input[^>]*aria-label="Phone number"/.test(contact), 'no accessible name');
  ok('the country dropdown groups the pinned seven',
    contact.includes('Frequently selected') && contact.includes('All countries'),
    'optgroup labels missing');
  const countryOptions = (contact.match(/<option[^>]*value="([A-Z][a-z][^"]*)"/g) || []).length;
  ok('the country dropdown offers the full list', countryOptions > 190, String(countryOptions));
  for (const name of ['Saudi Arabia', 'Pakistan', 'United Kingdom', 'Japan', 'Zimbabwe']) {
    ok(`the country dropdown includes ${name}`, contact.includes(`>${name}</option>`), 'absent');
  }
  ok('the old seven-item list is gone',
    !contact.includes('>Other</option>'), 'the "Other" placeholder option is still there');

  // ---- email templates ------------------------------------------------------
  console.log('\n=== email templates');
  const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: tpls } = await db.from('email_templates').select('*');
  const { data: brandingRow } = await db
    .from('email_branding')
    .select('signature_html, footer_html, logo_url')
    .eq('id', 1)
    .maybeSingle();

  const notif = (tpls ?? []).find((t) => t.template_key === 'contact_notification');
  const ack = (tpls ?? []).find((t) => t.template_key === 'contact_acknowledgement');

  ok('both templates exist and are enabled', !!notif?.enabled && !!ack?.enabled, 'missing or disabled');
  if (notif && ack) {
    ok('the notification is no longer the placeholder',
      !notif.body_html.includes('<p><strong>Name:</strong>'), 'placeholder markup still present');
    ok('the notification presents the enquirer in a panel',
      notif.body_html.includes('<table') && /Enquirer/i.test(notif.body_html), 'no detail panel');
    ok('the notification preserves the message line breaks',
      notif.body_html.includes('{{message_html}}'), 'uses the collapsing variable');
    ok('the notification carries the submission reference',
      notif.body_html.includes('{{submission_id}}'), 'no reference');
    ok('the acknowledgement offers a booking link',
      ack.body_html.includes('/book'), 'no booking link');
    ok('the acknowledgement links the confidentiality statement',
      ack.body_html.includes('/confidentiality'), 'no confidentiality link');
    ok('the acknowledgement echoes what was sent',
      ack.body_html.includes('{{message_html}}') && ack.body_html.includes('{{service_interest}}'),
      'no echo');
    ok('both use PMBC navy and gold',
      [notif, ack].every((t) => t.body_html.includes('#1B3A5F') && t.body_html.includes('#C69C3E')),
      'palette missing');
    ok("neither uses FMP's blue",
      ![notif, ack].some((t) => /#2E75B6|#1F3864/.test(t.body_html)), "FMP's blue is present");
  }

  // Hand-written table markup with an unclosed cell degrades differently in
  // every client, and the two most likely places to leave one are the two
  // bodies rewritten here. Counting is enough to catch it.
  const balanced = (html) =>
    ['table', 'tr', 'td', 'p', 'h1', 'a'].every(
      (tag) =>
        (html.match(new RegExp(`<${tag}[\\s>]`, 'g')) || []).length ===
        (html.match(new RegExp(`</${tag}>`, 'g')) || []).length,
    );
  for (const t of [notif, ack, { template_key: 'signature', body_html: brandingRow?.signature_html ?? '' },
    { template_key: 'footer', body_html: brandingRow?.footer_html ?? '' }]) {
    if (!t) continue;
    ok(`${t.template_key} markup is balanced`, balanced(t.body_html), 'a tag is left open');
  }

  ok('the signature is set', !!brandingRow?.signature_html?.trim(), 'blank');
  ok('the footer is set', !!brandingRow?.footer_html?.trim(), 'blank');
  ok('the footer carries the registration line',
    (brandingRow?.footer_html ?? '').includes('LLP Act, 2017'), 'absent');
  ok('the footer carries a contact address and the site',
    (brandingRow?.footer_html ?? '').includes('advisory@pacemakersglobal.com') &&
      (brandingRow?.footer_html ?? '').includes('pacemakersglobal.com'),
    'absent');

  // Every variable both templates reference must be one the contact route
  // supplies. An unknown one renders as a literal {{placeholder}} in live mail.
  const routeSrc = fs.readFileSync(path.join(projectRoot, 'src/app/api/contact/route.ts'), 'utf8');
  const supplied = new Set(
    [...routeSrc.matchAll(/^\s{4}([a-z_]+):/gm)].map((m) => m[1]),
  );
  const used = new Set(
    [...(tpls ?? [])].flatMap((t) =>
      [...`${t.subject} ${t.body_html}`.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)].map((m) => m[1]),
    ),
  );
  const unsupplied = [...used].filter((v) => !supplied.has(v));
  ok('every template variable is one the route supplies', unsupplied.length === 0, unsupplied.join(', '));

  // ---- the shell ------------------------------------------------------------
  // Source-level, and labelled as such: the assembled HTML is only produced by
  // a real send. What is checked here is that the composition rules the shell
  // depends on are still in it.
  console.log('\n=== email shell (source)');
  const shell = fs.readFileSync(path.join(projectRoot, 'src/lib/email/templates/_base.ts'), 'utf8');
  ok('the header logo falls back to the site dark logo',
    /logo_url\s*\|\|\s*siteBranding\?\.logo_dark_url/.test(shell), 'fallback chain changed');
  ok('the shell carries a shipped signature and footer',
    shell.includes('DEFAULT_SIGNATURE') && shell.includes('DEFAULT_FOOTER'), 'defaults missing');
  ok('the shipped footer states the registration', shell.includes('LLP Act, 2017'), 'absent');
  ok('the header band carries the gold hairline', shell.includes('height:3px'), 'no hairline row');
  ok('the shell is PMBC navy, cream and gold, not FMP blue',
    shell.includes('#1B3A5F') && shell.includes('#FAF7F2') && shell.includes('#C69C3E') &&
      !/#2E75B6|#1F3864|#F4F6F9/.test(shell),
    'palette is wrong');

  // A dark logo has to be reachable, or every email header falls back to text.
  const { data: siteBranding } = await db
    .from('branding_config')
    .select('logo_dark_url, logo_url')
    .eq('id', 1)
    .maybeSingle();
  const resolved = brandingRow?.logo_url || siteBranding?.logo_dark_url || siteBranding?.logo_url;
  ok('a header logo resolves', !!resolved, 'no logo anywhere, the header would render as text');
  if (resolved) {
    const head = await fetch(resolved, { method: 'HEAD' });
    ok('the resolved logo is actually fetchable', head.ok, `${head.status} on ${resolved}`);
  }

  // ---- confidentiality ------------------------------------------------------
  console.log('\n=== confidentiality');
  const res = await fetch(BASE + '/confidentiality');
  ok('/confidentiality returns 200', res.status === 200, String(res.status));
  const page = await res.text();

  // The eight subjects the page was asked to cover. Matched on the section
  // headings rather than on prose, so rewording a paragraph does not fail this
  // but dropping a subject does.
  const SUBJECTS = [
    ['prospective enquiries', /Before an Engagement/i],
    ['information during a mandate', /During an Engagement/i],
    ['the bench bound by the same obligations', /Same Obligations/i],
    ['storage and access', /Storage and Access/i],
    ['after an engagement ends', /After an Engagement Ends/i],
    ['disclosure required by law', /Where Disclosure Is Required/i],
    ['conflicts between prospective clients', /Conflicts Between Prospective Clients/i],
    ['how to ask', /Questions and Contact/i],
  ];
  for (const [label, re] of SUBJECTS) {
    ok(`it covers ${label}`, re.test(page), 'section heading not found');
  }
  ok('it carries the subject-to-legal-review notice',
    page.includes('Subject to legal review'), 'notice missing');
  ok('it matches the legal pages in structure',
    page.includes('pmbc-prose') && page.includes('Last updated'), 'structure differs');

  const privacy = await (await fetch(BASE + '/privacy')).text();
  const terms = await (await fetch(BASE + '/terms')).text();
  ok('privacy and terms are unchanged in structure',
    privacy.includes('Subject to legal review') && terms.includes('Subject to legal review'),
    'one of them lost its notice');

  // ---- footer and sitemap ---------------------------------------------------
  console.log('\n=== legal row and sitemap');
  for (const route of ['/', '/contact', '/services', '/confidentiality']) {
    const html = await (await fetch(BASE + route)).text();
    const footer = html.slice(html.lastIndexOf('<footer'));
    ok(`${route}: the legal row carries all three statements`,
      footer.includes('href="/privacy"') &&
        footer.includes('href="/terms"') &&
        footer.includes('href="/confidentiality"'),
      'one is missing from the footer');
  }
  const sitemap = await (await fetch(BASE + '/sitemap.xml')).text();
  for (const route of ['/privacy', '/terms', '/confidentiality']) {
    ok(`${route} is in the sitemap`, sitemap.includes(`${route}</loc>`), 'absent');
  }

  // ---- dashes ---------------------------------------------------------------
  console.log('\n=== em dashes');
  // Written as escapes rather than the literal characters, so this file
  // itself passes the repository's em-dash gate.
  const DASHES = new RegExp('[\u2013\u2014]');
  ok('the confidentiality page has none', !DASHES.test(page), 'found one');
  ok('the contact form has none', !DASHES.test(contact), 'found one');
  ok('neither email template has one',
    ![...(tpls ?? [])].some((t) => DASHES.test(t.subject) || DASHES.test(t.body_html)), 'found one');
  ok('the signature and footer have none',
    !DASHES.test(brandingRow?.signature_html ?? '') && !DASHES.test(brandingRow?.footer_html ?? ''),
    'found one');

  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length) {
    for (const f of failures) console.error('  FAIL ' + f);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('verify-contact-and-legal failed:', err);
  process.exitCode = 1;
});
