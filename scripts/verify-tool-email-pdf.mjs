// scripts/verify-tool-email-pdf.mjs
//
// Proves the results email, the internal alert, the PDF report and the Brevo
// payload that carries them, without sending anything.
//
//   1. Results email: subject and body carry the equity range, midpoint, WACC,
//      methods and the tracked booking link; the negative equity note appears
//      when it should; visitor text is escaped; no template variable or block
//      placeholder is left unrendered.
//   2. Alert email: every lead field, the below-minimum and test markers in the
//      subject, and the dashboard link.
//   3. The defaults in code match the rows seeded by migration 078, so a
//      database without the rows sends the same email as one with them.
//   4. PDF: renders for the minimal example, Pakistan with every version 2
//      feature, and a distressed case; is a PDF; has ten pages; embeds both
//      site typefaces. The text is extracted with pdfjs and each page is
//      checked for its section title, the page footer and the market data
//      label, with no ligature glyph drawn (read from the operator list, since
//      extracted text maps a ligature back to its letters) and no
//      em or en dash. The full case shows its stake, weighted value, bridge
//      items, normalised EBITDA and every warning it raised; the minimal case
//      shows none of those. The QR code encodes the tracked booking link.
//   5. Brevo payload: the attachment decodes to that PDF, the tags and the
//      X-Mailin-custom header are present, and a plain send (the contact form)
//      carries none of the new fields.
//   6. Email shell and parts: the hosted logo PNG with width, height and alt,
//      the file itself at the size those attributes assume, the button padding
//      on the cell (which Outlook honours) rather than the link, the weighted
//      and stake rows only when used, and the follow-up consent as submitted.
//   7. Booking links: always the site's /book page with name, email and UTM
//      tags, and /book forwarding only known keys onto the calendar URL.
//
//   npm run verify-tool-email-pdf

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';

import { REPORT_META, fullFeatureCase, minimalCase } from './lib/valuationCases.mjs';

// The email shell reads branding from Supabase when it can. Without these it
// uses its built-in defaults, which is what this verifier checks, and it can
// never read the production database.
for (const k of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'NEXT_PUBLIC_SUPABASE_URL']) delete process.env[k];

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const jiti = createJiti(import.meta.url, { alias: { '@': path.join(root, 'src') }, jsx: { runtime: 'automatic' } });
const templates = await jiti.import(path.join(root, 'src/lib/tools/email/templates.ts'));
const pdfModule = await jiti.import(path.join(root, 'src/lib/tools/pdf/ValuationReport.tsx'));
const engine = await jiti.import(path.join(root, 'src/lib/tools/valuation/engine.ts'));
const format = await jiti.import(path.join(root, 'src/lib/tools/valuation/format.ts'));
const state = await jiti.import(path.join(root, 'src/components/tools/valuation/state.ts'));
const send = await jiti.import(path.join(root, 'src/lib/email/send.ts'));
const base = await jiti.import(path.join(root, 'src/lib/email/templates/_base.ts'));
const booking = await jiti.import(path.join(root, 'src/lib/tools/booking.ts'));
const data = await jiti.import(path.join(root, 'src/lib/tools/valuation/data.ts'));
const qr = await jiti.import(path.join(root, 'src/lib/tools/pdf/QrCode.tsx'));
const partnerModule = await jiti.import(path.join(root, 'src/lib/tools/brand/partner.ts'));
const founderProfileSrc = fs.readFileSync(path.join(root, 'src/lib/cms/founderProfile.ts'), 'utf8');
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

let checks = 0, failures = 0;
function check(label, ok, detail = '') {
  checks++;
  if (ok) return;
  failures++;
  console.log(`  FAIL  ${label}${detail ? `: ${detail}` : ''}`);
}

/* ------------------------------------------------------------------------ */
/* Cases                                                                     */
/* ------------------------------------------------------------------------ */

function fromState(s) {
  const out = engine.runValuation(state.toInputs(s));
  if (!out.ok) throw new Error('case did not run: ' + JSON.stringify(out.errors));
  return out.result;
}
const withFin = (s, fin) => ({ ...s, fin: Object.fromEntries(Object.entries(fin).map(([k, v]) => [k, v.map(String)])) });

const saudi = fromState(minimalCase(state));
const full = fromState(fullFeatureCase(state));

let pk = state.initialState();
pk = state.applyIndustryDefaults({ ...pk, industry: 'Food Processing' });
pk = state.applyCountryDefaults({ ...pk, country: 'Pakistan', netDebt: '1200' });
pk = withFin(pk, { rev: [8500, 9800, 11200, 12768, 14556, 16594, 18917, 21565], ebitda: [1250, 1480, 1720, 2043, 2329, 2655, 3027, 3450], da: [300, 340, 390, 383, 437, 498, 568, 647], capex: [450, 520, 600, 638, 728, 830, 946, 1078], nwc: [1500, 1700, 1950, 2298, 2620, 2987, 3405, 3882] });
const pakistan = fromState(state.onEnterWacc(state.resetWacc(pk)));

let ae = state.initialState();
ae = state.applyIndustryDefaults({ ...ae, industry: 'Engineering/Construction' });
ae = state.applyCountryDefaults({ ...ae, country: 'United Arab Emirates', netDebt: '400', financialYear: '2024' });
ae = withFin(ae, { rev: [300, 280, 250, 260, 275, 290, 305, 320], ebitda: [12, 4, -6, 2, 8, 14, 20, 24], da: [10, 10, 9, 9, 9, 9, 10, 10], capex: [8, 6, 5, 5, 6, 6, 7, 7], nwc: [60, 58, 55, 56, 58, 60, 62, 64] });
const distressed = fromState(state.onEnterWacc(state.resetWacc(ae)));

const BOOK = 'https://www.pacemakersglobal.com/api/tools/book?t=abc&src=email';

console.log('Results email');
for (const [label, result] of [['Saudi', saudi], ['Pakistan', pakistan], ['distressed', distressed]]) {
  const { subject, body } = templates.buildResultsEmail({
    template: templates.DEFAULT_TEMPLATES[templates.RESULTS_TEMPLATE_KEY],
    name: 'Test <b>Person</b>',
    email: 'test@example.com',
    company: 'Acme & Sons',
    result,
    bookingHref: BOOK,
  });
  const h = format.headline(result);
  check(`${label}: subject carries the equity range`, subject === `Your indicative valuation: ${h.equityRange}`, subject);
  check(`${label}: body has range, midpoint, EV and WACC`, [h.equityRange, h.midpoint, h.evRange, h.wacc].every((x) => body.includes(x)));
  check(`${label}: body lists the methods used`, body.includes(templates.escapeHtml(format.methodsUsed(result).join(', '))));
  check(`${label}: booking button links to the tracked URL`, body.includes(`href="${templates.escapeHtml(BOOK)}"`));
  check(`${label}: visitor name escaped`, body.includes('Test &lt;b&gt;Person&lt;/b&gt;') && !body.includes('<b>Person</b>'));
  check(`${label}: nothing left unrendered`, !/\{\{|\}\}|@@BLOCK/.test(body + subject));
  const note = format.equityFloorNote(result.equityFloor);
  check(`${label}: negative equity note ${note ? 'present' : 'absent'}`, note ? body.includes(templates.escapeHtml(note)) : !body.includes('Net debt exceeds'));
}
check('distressed case really is floored', distressed.equityFloor === 'all', distressed.equityFloor);
check('Pakistan case is in PKR', pakistan.currency.code === 'PKR');

console.log('Alert email');
{
  const { subject, body } = templates.buildAlertEmail({
    template: templates.DEFAULT_TEMPLATES[templates.ALERT_TEMPLATE_KEY],
    toolName: 'Business Valuation',
    lead: { name: 'Test Person', email: 'test@example.com', company: 'Acme', purpose: 'raise', dealSizeLabel: 'Under SAR 50 million', belowMinimum: true, country: 'Saudi Arabia', industry: 'Education', followUp: false, isTest: true },
    result: saudi,
    dashboardUrl: 'https://www.pacemakersglobal.com/admin/tool-leads/00000000-0000-4000-8000-000000000001',
  });
  check('subject names tool, person, company, below minimum and test', subject === 'New Business Valuation lead: Test Person, Acme (below minimum) [TEST]', subject);
  for (const v of ['test@example.com', 'Raising equity', 'Under SAR 50 million', 'Saudi Arabia', 'Education', 'Test lead', format.headline(saudi).equityRange]) {
    check(`alert body includes "${v}"`, body.includes(templates.escapeHtml(v)));
  }
  check('alert links to the dashboard', body.includes('href="https://www.pacemakersglobal.com/admin/tool-leads/00000000-0000-4000-8000-000000000001"'));
  check('alert has nothing unrendered', !/\{\{|\}\}|@@BLOCK/.test(body + subject));
}

console.log('Code defaults match migration 078');
{
  // Comment lines are dropped first: an apostrophe in prose would otherwise
  // open a string literal.
  const sql = fs
    .readFileSync(path.join(root, 'supabase/migrations/078_tool_email_templates.sql'), 'utf8')
    .split(/\r?\n/)
    .filter((l) => !l.trimStart().startsWith('--'))
    .join('\n');
  const literals = [...sql.matchAll(/'((?:[^']|'')*)'/g)].map((m) => m[1].replace(/''/g, "'"));
  for (const key of [templates.RESULTS_TEMPLATE_KEY, templates.ALERT_TEMPLATE_KEY]) {
    const i = literals.indexOf(key);
    const d = templates.DEFAULT_TEMPLATES[key];
    check(`${key}: subject matches`, i !== -1 && literals[i + 1] === d.subject, literals[i + 1]);
    check(`${key}: body matches`, i !== -1 && literals[i + 2]?.replace(/\r\n/g, '\n') === d.body_html);
  }
}

console.log('PDF report');
async function pageTexts(buf) {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), useSystemFonts: false, disableFontFace: true, verbosity: 0 }).promise;
  const out = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const content = await (await doc.getPage(i)).getTextContent();
    out.push(content.items.map((it) => it.str).join(' ').replace(/\s+/g, ' '));
  }
  return out;
}

/**
 * Glyphs drawn for more than one character, such as the serif "fl" in "Free
 * cash flow". Extracted text cannot show these: the font maps a ligature glyph
 * back to its letters, and pdfjs normalises what is left. The operator list is
 * the glyphs actually drawn.
 */
async function ligatureGlyphs(buf) {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), verbosity: 0 }).promise;
  const found = new Set();
  for (let i = 1; i <= doc.numPages; i++) {
    const ops = await (await doc.getPage(i)).getOperatorList();
    ops.fnArray.forEach((fn, k) => {
      if (fn !== pdfjs.OPS.showText) return;
      for (const g of ops.argsArray[k][0]) {
        const u = g && typeof g === 'object' ? g.unicode ?? '' : '';
        if ([...u].length > 1 || /[ﬀ-ﬆ]/.test(u)) found.add(u);
      }
    });
  }
  return [...found];
}
const DATA_LABEL = data.dataVersionLabel('2026-09-16');
check('market data label', DATA_LABEL === 'Damodaran January 2026, risk-free September 2026', DATA_LABEL);
const pdfs = {};
const texts = {};
for (const [label, result] of [['Saudi', saudi], ['full', full], ['Pakistan', pakistan], ['distressed', distressed]]) {
  const buf = await pdfModule.renderValuationReport(result, {
    ...REPORT_META,
    preparedFor: 'Test Person',
    company: label === 'distressed' ? null : 'Example Co',
    industry: 'Industry',
    country: 'Country',
    bookingHref: BOOK,
  });
  pdfs[label] = buf;
  const text = buf.toString('latin1');
  const pages = (text.match(/\/Type\s*\/Page[^s]/g) ?? []).length;
  check(`${label}: is a PDF`, buf.subarray(0, 5).toString() === '%PDF-');
  check(`${label}: ten pages`, pages === 10 && pdfModule.REPORT_PAGE_TITLES.length === 10, String(pages));
  const t = await pageTexts(buf);
  texts[label] = t;
  pdfModule.REPORT_PAGE_TITLES.forEach((title, i) => {
    // The cover eyebrow is letter-spaced, which pdfjs extracts as spaced letters.
    const squash = (x) => x.toLowerCase().replace(/\s+/g, '');
    check(`${label}: page ${i + 1} is "${title}"`, squash(t[i] ?? '').includes(squash(title)), (t[i] ?? '').slice(0, 120));
  });
  check(`${label}: page 1 names the market data`, t[0].includes(DATA_LABEL));
  check(`${label}: pages 2 to 10 carry the footer with page number and market data`, t.slice(1).every((pt, i) => pt.includes(`Page ${i + 2} of 10`) && pt.includes(DATA_LABEL) && pt.includes('Indicative only')));
  const all = t.join(' ');
  const ligs = await ligatureGlyphs(buf);
  check(`${label}: no ligature glyphs drawn`, ligs.length === 0, ligs.join(', '));
  check(`${label}: "Free cash flow" extracted as typed`, all.includes('Free cash flow'));
  check(`${label}: no em or en dash`, !/[\u2013\u2014]/.test(all));
  check(`${label}: no NaN or undefined in the text`, !/NaN|undefined|Infinity/.test(all), (all.match(/.{30}(NaN|undefined|Infinity).{30}/) ?? [''])[0]);
  check(`${label}: no old "Market data version" label`, !all.includes('Market data version'));
  check(`${label}: embeds Inter and Source Serif 4`, /Inter/.test(text) && /SourceSerif/.test(text));
  check(`${label}: reasonable size`, buf.length > 20_000 && buf.length < 2_000_000, String(buf.length));
  check(`${label}: carries the booking link`, text.includes(BOOK));
  if (process.env.PDF_OUT) fs.writeFileSync(path.join(process.env.PDF_OUT, `report-${label}.pdf`), buf);
}
{
  const f = texts.full.join(' ');
  const m = texts.Saudi.join(' ');
  const hf = format.headline(full);
  check('full: stake value and label on the report', f.includes(hf.stakeLabel) && f.includes(hf.stakeRange));
  check('full: weighted value on the report', f.includes('Probability-weighted') && f.includes(hf.weighted));
  check('full: bridge items on the report', ['end of service benefits', 'lease liabilities', 'minority interest', 'surplus assets'].every((x) => f.toLowerCase().includes(x)));
  check('full: normalised EBITDA on the report', f.includes('Normalised EBITDA'));
  check('full: raised at least one warning', full.warnings.length > 0);
  for (const w of format.warningTexts(full)) check(`full: warning "${w.title}" on the report`, f.includes(w.title));
  check('full: no "none raised" line', !f.includes('None of the checks raised a warning.'));
  check('minimal: no warnings, and says so', saudi.warnings.length === 0 && m.includes('None of the checks raised a warning.'));
  check('minimal: whole equity, no stake line', m.includes('The valuation is for 100% of the equity') && !m.includes('stake with a'));
  check('minimal: no bridge rows beyond net debt', !m.includes('Less lease liabilities') && !m.includes('Add surplus assets') && !m.includes('Less end of service benefits'));
  check('minimal: assumptions say no other claims entered', /Other claims and surplus assets\s+None entered/.test(m));
  check('full: bridge rows on the report', f.includes('Less lease liabilities') && f.includes('Add surplus assets and investments'));
  check('closing page offers the booking link', texts.full[9].toLowerCase().includes('book'));
  const code = qr.qrMatrix(BOOK);
  const decoded = (await import('qrcode')).default.create(BOOK, { errorCorrectionLevel: 'M' }).segments.map((sg) => Buffer.from(sg.data).toString('utf8')).join('');
  check('QR code encodes the tracked booking link', code.size >= 21 && decoded === BOOK, decoded);
}
check('file name is tidy', pdfModule.reportFileName('Acme & Sons / KSA', 'x', new Date('2026-09-16')) === 'PaceMakers valuation Acme  Sons  KSA 2026-09-16.pdf');

console.log('Brevo payload');
{
  const captured = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    captured.push({ url: String(url), body: JSON.parse(init.body), headers: init.headers });
    return new Response(JSON.stringify({ messageId: '<verify@smtp-relay.mailin.fr>' }), { status: 201 });
  };
  const saved = { key: process.env.BREVO_API_KEY, from: process.env.EMAIL_FROM_DEFAULT };
  process.env.BREVO_API_KEY = 'verify-key';
  process.env.EMAIL_FROM_DEFAULT = 'PaceMakers <info@pacemakersglobal.com>';
  try {
    const r = await send.sendEmail({
      to: 'test@example.com',
      subject: 'S',
      html: '<p>x</p>',
      attachments: [{ name: 'report.pdf', content: pdfs.Saudi.toString('base64') }],
      tags: ['tool-lead', 'business-valuation', 'results'],
      headers: { 'X-Mailin-custom': 'lead:00000000-0000-4000-8000-000000000001|kind:results' },
    });
    const p = captured[0]?.body ?? {};
    check('send returns the Brevo message id', r.ok && r.id === '<verify@smtp-relay.mailin.fr>');
    check('attachment decodes to the rendered PDF', Buffer.from(p.attachment?.[0]?.content ?? '', 'base64').equals(pdfs.Saudi) && p.attachment[0].name === 'report.pdf');
    check('tags sent', JSON.stringify(p.tags) === JSON.stringify(['tool-lead', 'business-valuation', 'results']));
    check('X-Mailin-custom header sent', p.headers?.['X-Mailin-custom'] === 'lead:00000000-0000-4000-8000-000000000001|kind:results');
    await send.sendEmail({ to: 'a@example.com', subject: 'S', html: '<p>x</p>' });
    const plain = captured[1]?.body ?? {};
    check('plain send has no attachment, tags or headers', !('attachment' in plain) && !('tags' in plain) && !('headers' in plain));
  } finally {
    globalThis.fetch = realFetch;
    process.env.BREVO_API_KEY = saved.key;
    process.env.EMAIL_FROM_DEFAULT = saved.from;
    if (saved.key === undefined) delete process.env.BREVO_API_KEY;
    if (saved.from === undefined) delete process.env.EMAIL_FROM_DEFAULT;
  }
}

console.log('Email shell and parts');
{
  const html = await base.baseLayoutBranded('<p>Body</p>');
  const img = html.match(/<img[^>]*>/)?.[0] ?? '';
  check('logo is the hosted PNG', img.includes(`src="${base.EMAIL_LOGO.src}"`) && base.EMAIL_LOGO.src.startsWith('https://www.pacemakersglobal.com/') && base.EMAIL_LOGO.src.endsWith('.png'), img);
  check('logo has width and height attributes', img.includes(`width="${base.EMAIL_LOGO.width}"`) && img.includes(`height="${base.EMAIL_LOGO.height}"`));
  check('logo has alt text', /alt="PaceMakers Business Consultants"/.test(img));
  check('no SVG in the email', !/<svg|\.svg/i.test(html));
  const file = path.join(root, 'public', new URL(base.EMAIL_LOGO.src).pathname);
  const png = fs.existsSync(file) ? fs.readFileSync(file) : Buffer.alloc(0);
  const pw = png.length > 24 ? png.readUInt32BE(16) : 0, ph = png.length > 24 ? png.readUInt32BE(20) : 0;
  check('logo file is in public/ and is a PNG', png.subarray(1, 4).toString() === 'PNG', file);
  // Drawn at half the file's pixels for sharp high-density screens, within a pixel of rounding.
  check('logo file is twice the drawn size', Math.abs(pw / 2 - base.EMAIL_LOGO.width) <= 1 && Math.abs(ph / 2 - base.EMAIL_LOGO.height) <= 1, `${pw}x${ph}`);

  const btn = templates.button('https://example.com/x', 'Book a free call');
  const td = btn.match(/<td[^>]*>/)?.[0] ?? '';
  const a = btn.match(/<a[^>]*>/)?.[0] ?? '';
  check('button padding is on the cell', /padding:13px 26px/.test(td) && /mso-padding-alt:13px 26px/.test(td) && /bgcolor="#/.test(td), td);
  check('button link carries no padding', !/padding/.test(a), a);

  const build = (result) => templates.buildResultsEmail({ template: templates.DEFAULT_TEMPLATES[templates.RESULTS_TEMPLATE_KEY], name: 'A', email: 'a@example.com', company: null, result, bookingHref: BOOK }).body;
  const fb = build(full), mb = build(saudi);
  const hf = format.headline(full);
  check('results email, full: weighted value row', fb.includes('Probability-weighted value') && fb.includes(templates.escapeHtml(hf.weighted)));
  check('results email, full: stake value row', fb.includes(templates.escapeHtml(`Value of ${hf.stakeLabel}`)) && fb.includes(templates.escapeHtml(hf.stakeRange)));
  check('results email, minimal: weighted row shown (scenarios always run)', mb.includes('Probability-weighted value'));
  check('results email, minimal: no stake row', !mb.includes('Value of '));

  const alertFor = (followUp) =>
    templates.buildAlertEmail({
      template: templates.DEFAULT_TEMPLATES[templates.ALERT_TEMPLATE_KEY],
      toolName: 'Business Valuation',
      lead: { name: 'T', email: 't@example.com', company: null, purpose: 'sale', dealSizeLabel: 'x', belowMinimum: false, country: 'Saudi Arabia', industry: 'Education', followUp, isTest: false },
      result: saudi,
      dashboardUrl: 'https://www.pacemakersglobal.com/admin/tool-leads/1',
    }).body;
  const consentCell = (body) => body.match(/Follow-up email consent<\/td>\s*<td[^>]*>([^<]*)</)?.[1];
  check('alert: follow-up ticked shows Yes', consentCell(alertFor(true)) === 'Yes', String(consentCell(alertFor(true))));
  check('alert: follow-up unticked shows No', consentCell(alertFor(false)) === 'No', String(consentCell(alertFor(false))));
}

console.log('Report branding and partner');
{
  // The mapping from the two founder sections, as stored.
  const hero = {
    name: ' Test Partner ', eyebrow: 'Founding Partner', title_primary: 'Corporate Finance Specialist', credentials_line: 'ACCA | FMVA',
    intro: 'An introduction   over two lines.', photo_url: 'https://example.supabase.co/storage/v1/object/public/team-photos/p.png',
    cta_primary_href: 'https://www.linkedin.com/in/example/',
  };
  const block = { name: 'Other', credentials: ['One', ' Two ', '', 'Three', 'Four', 'Five', 'Six'], photo_url: 'https://example.com/b.png' };
  const card = partnerModule.partnerFromSections(hero, block);
  check('partner: name trimmed from the hero', card?.name === 'Test Partner');
  check('partner: intro whitespace collapsed', card?.intro === 'An introduction over two lines.');
  check('partner: highlights from the home card, blanks dropped, at most five', JSON.stringify(card?.highlights) === JSON.stringify(['One', 'Two', 'Three', 'Four', 'Five']));
  check('partner: photo and LinkedIn from the hero', card?.photoUrl === hero.photo_url && card?.linkedinUrl === hero.cta_primary_href);
  check('partner: profile path is the founder page', card?.profilePath === '/about/ahmad-din', card?.profilePath);
  check('partner: a non-LinkedIn primary link is not offered as LinkedIn', partnerModule.partnerFromSections({ ...hero, cta_primary_href: '/book' }, block)?.linkedinUrl === null);
  check('partner: a non-https photo is dropped', partnerModule.partnerFromSections({ ...hero, photo_url: 'javascript:alert(1)' }, { ...block, photo_url: '' })?.photoUrl === null);
  check('partner: no name anywhere means no card', partnerModule.partnerFromSections({ intro: 'x' }, { credentials: ['a'] }) === null);
  check('partner: slug matches founderProfile.ts', founderProfileSrc.includes(`FOUNDER_PAGE_SLUG = '${partnerModule.PARTNER_PAGE_SLUG}'`));

  // Real images from the repository stand in for the CMS files.
  const logo = fs.readFileSync(path.join(root, 'public/email/pacemakers-logo-on-navy.png'));
  const sharp = (await import('sharp')).default;
  const portrait = await sharp({ create: { width: 360, height: 450, channels: 3, background: '#1B3A5F' } }).jpeg().toBuffer();
  const branding = { logoOnDark: logo, logoOnLight: logo, partner: card, partnerPhoto: portrait };
  const render = (b) => pdfModule.renderValuationReport(full, { ...REPORT_META, company: 'Example Co', industry: 'Industry', country: 'Country', bookingHref: BOOK, branding: b });
  const withBrand = await render(branding);
  const raw = withBrand.toString('latin1');
  const t = await pageTexts(withBrand);
  check('branded: still ten pages', t.length === 10, String(t.length));
  check('branded: logo and portrait embedded as images', (raw.match(/\/Subtype\s*\/Image/g) ?? []).length >= 2);
  check('branded: cover uses the logo, not the typeset name', !t[0].includes('PaceMakers Business Consultants ADVISORY') && !/^PaceMakers Business Consultants/.test(t[0]));
  const last = t[9];
  check('branded: closing page names the partner and role', last.includes('Test Partner') && last.includes('Founding Partner, Corporate Finance Specialist'));
  check('branded: closing page carries credentials, intro and every highlight', last.includes('ACCA | FMVA') && last.includes('An introduction over two lines.') && card.highlights.every((h) => last.includes(h)));
  check('branded: highlights attributed to the partner, not the firm', last.includes(partnerModule.PARTNER_RECORD_NOTE));
  check('branded: services and booking still on the closing page', last.includes('CFO Advisory') && /bookafreecall/i.test(last.replace(/\s+/g, '')));

  const bare = await render(null);
  const tb = await pageTexts(bare);
  check('no branding: still ten pages', tb.length === 10);
  check('no branding: cover sets the name in type', tb[0].startsWith('PaceMakers Business Consultants'));
  check('no branding: no partner block, full service summaries', !tb[9].includes('Who you will work with') && tb[9].includes('Institutional-grade'));
  check('no branding: no images embedded', !/\/Subtype\s*\/Image/.test(bare.toString('latin1')));
  const noPhoto = await pageTexts(await render({ ...branding, partnerPhoto: null, logoOnDark: null }));
  check('partner without photo or logo: ten pages, block kept', noPhoto.length === 10 && noPhoto[9].includes('Test Partner'));
}

console.log('Booking links');
{
  const link = booking.bookingPageLink({ name: 'Ahmad Test', email: 'a@example.com', toolSlug: 'business-valuation', placement: 'pdf' });
  const u = new URL(link, 'https://www.pacemakersglobal.com');
  check('booking goes to /book on the site', link.startsWith('/book?') && u.pathname === '/book');
  check('booking carries name and email', u.searchParams.get('name') === 'Ahmad Test' && u.searchParams.get('email') === 'a@example.com');
  check('booking carries UTM tags', u.searchParams.get('utm_source') === 'pacemakersglobal' && u.searchParams.get('utm_medium') === 'free-tool' && u.searchParams.get('utm_campaign') === 'business-valuation' && u.searchParams.get('utm_content') === 'pdf');
  check('no calendar host in the link', !/calendly/i.test(link));
  const fwd = booking.withBookingPrefill('https://calendly.com/pacemakers/intro', { name: 'N', email: 'e@x.com', utm_campaign: 'business-valuation', redirect: 'https://evil.example', url: 'x' });
  const f = new URL(fwd);
  check('/book forwards prefill onto the calendar URL', f.host === 'calendly.com' && f.searchParams.get('name') === 'N' && f.searchParams.get('utm_campaign') === 'business-valuation');
  check('/book drops unknown keys', !f.searchParams.has('redirect') && !f.searchParams.has('url'));
  check('/book caps values at 200 characters', new URL(booking.withBookingPrefill('https://calendly.com/x', { name: 'n'.repeat(500) })).searchParams.get('name').length === 200);
  check('blank calendar URL unchanged', booking.withBookingPrefill('', { name: 'N' }) === '');
  const routeSrc = fs.readFileSync(path.join(root, 'src/app/api/tools/book/route.ts'), 'utf8');
  check('tracked redirect builds its destination from bookingPageLink only', routeSrc.includes('bookingPageLink(') && !/booking_url|calendly/i.test(routeSrc.replace(/\/\*[\s\S]*?\*\//g, '')));
}

console.log(`\n${checks - failures} of ${checks} checks passed.`);
if (failures) {
  console.log(`${failures} FAILED`);
  process.exitCode = 1;
} else console.log('COMPLETE');
