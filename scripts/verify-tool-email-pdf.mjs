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
//      feature, and a distressed case; is a PDF; has eight pages; embeds both
//      site typefaces. The text is extracted with pdfjs and each page is
//      checked for its section title and the market data label on the cover,
//      with no ligature glyph drawn (read from the operator list, since
//      extracted text maps a ligature back to its letters) and no
//      em or en dash. The full case shows its stake, weighted value, bridge
//      items, normalised EBITDA and every warning it raised; the minimal case
//      shows none of those. The QR code encodes the tracked booking link.
//      Version 3 wording: every renamed label, every disclosure line, the
//      "Powered by" line, pre-money and post-money, and none of the retired
//      phrases. A report whose result does not reconcile is refused.
//   5. Brevo payload: the attachment decodes to that PDF, the tags and the
//      X-Mailin-custom header are present, and a plain send (the contact form)
//      carries none of the new fields.
//   6. Email shell and parts: the hosted logo PNG with width, height and alt,
//      the file itself at the size those attributes assume, the button padding
//      on the cell (which Outlook honours) rather than the link, the weighted
//      and stake rows only when used, and the follow-up consent as submitted.
//   7. Report theme (the shared theme in src/lib/tools/pdf): the same footer on
//      every page, cover and closing page included, carrying the LLP name, the
//      tagline, the tool name, the company, the date and "Page X of 8", and no
//      letterhead footer band; the legal line and contact details appear exactly
//      once in the report, on the closing page. Read from the operator list: the letterhead
//      navy and green are drawn on every page, none of the website colours is,
//      gold is never a large fill and appears as text only in the tagline, and
//      each inner page has at most one small gold highlight. The colour logo is
//      drawn on the cover and the closing page, from Header Settings or, without
//      branding, the bundled copies of the same files (never the name in type),
//      and a logo on a dark background uses the white file. The report email shell uses the colour logo, the
//      letterhead colours and the legal line, and the site shell is unchanged.
//   8. Booking links: always the site's /book page with name, email and UTM
//      tags, and /book forwarding only known keys onto the calendar URL.
//
//   npm run verify-tool-email-pdf

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';

import { REPORT_META, VALUATION_DATE, fullFeatureCase, minimalCase } from './lib/valuationCases.mjs';

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
const components = await jiti.import(path.join(root, 'src/lib/tools/pdf/components.tsx'));
const theme = await jiti.import(path.join(root, 'src/lib/tools/pdf/theme.ts'));
const letterhead = await jiti.import(path.join(root, 'src/lib/brand/letterhead.ts'));

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
  const out = engine.runValuation(state.toInputs(s, VALUATION_DATE));
  if (!out.ok) throw new Error('case did not run: ' + JSON.stringify(out.errors));
  return out.result;
}
const withFin = (s, fin) => ({ ...s, fin: Object.fromEntries(Object.entries(fin).map(([k, v]) => [k, v.map(String)])) });

const saudi = fromState(minimalCase(state));
const full = fromState(fullFeatureCase(state));

let pk = state.initialState();
pk = state.applyIndustryDefaults({ ...pk, industry: 'Food Processing' });
pk = state.applyCountryDefaults({ ...pk, country: 'Pakistan', debt: '1200', cash: '0' });
pk = withFin(pk, { rev: [8500, 9800, 11200, 12768, 14556, 16594, 18917, 21565], ebitda: [1250, 1480, 1720, 2043, 2329, 2655, 3027, 3450], da: [300, 340, 390, 383, 437, 498, 568, 647], capex: [450, 520, 600, 638, 728, 830, 946, 1078], nwc: [1500, 1700, 1950, 2298, 2620, 2987, 3405, 3882] });
const pakistan = fromState(state.onEnterWacc(state.resetWacc(pk)));

let ae = state.initialState();
ae = state.applyIndustryDefaults({ ...ae, industry: 'Engineering/Construction' });
ae = state.applyCountryDefaults({ ...ae, country: 'United Arab Emirates', debt: '700', cash: '0', financialYear: '2025' });
ae = withFin(ae, { rev: [300, 280, 250, 260, 275, 290, 305, 320], ebitda: [12, 4, -6, 2, 8, 14, 20, 24], da: [10, 10, 9, 9, 9, 9, 10, 10], capex: [8, 6, 5, 5, 6, 6, 7, 7], nwc: [60, 58, 55, 56, 58, 60, 62, 64] });
const distressed = fromState(state.onEnterWacc(state.resetWacc(ae)));

// A short booking link, the form results, emails and PDFs carry (src/lib/tools/bookingLinks.ts).
const BOOK = 'https://www.pacemakersglobal.com/b/Fq7mKx2RtWp9e';

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
  check(`${label}: body has range, base case, EV and WACC in full`, [h.table.equityRange, h.table.midpoint, h.table.evRange, h.wacc].every((x) => body.includes(x)));
  check(`${label}: no short amount in the summary table`, !/<td[^>]*>[^<]*\b[A-Z]{3} [\d.,]+(k|m|bn)\b/.test(body), body.match(/<td[^>]*>[^<]*\b[A-Z]{3} [\d.,]+(k|m|bn)\b/)?.[0]);
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
  for (const v of ['test@example.com', 'Raising equity', 'Under SAR 50 million', 'Saudi Arabia', 'Education', 'Test lead', format.headline(saudi).table.equityRange]) {
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
/**
 * Per page: every fill and stroke colour drawn, split into text and graphics,
 * with the text drawn in gold and the number of gold graphic operations. Colours
 * are read from the operator list, so this is what a viewer paints.
 */
const hexOf = (a) => {
  const v = a?.[0];
  if (typeof v === 'string') return v.toUpperCase();
  const rgb = v && typeof v === 'object' && !Array.isArray(v) && 0 in v ? [v[0], v[1], v[2]] : [a?.[0], a?.[1], a?.[2]];
  return '#' + rgb.map((x) => Math.round(Number(x)).toString(16).padStart(2, '0')).join('').toUpperCase();
};
async function pageColours(buf) {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), verbosity: 0 }).promise;
  const O = pdfjs.OPS;
  const out = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const ops = await (await doc.getPage(i)).getOperatorList();
    let fill = '#000000', stroke = '#000000';
    const stack = [];
    const page = { fills: new Set(), strokes: new Set(), goldText: [], goldGraphics: 0, images: 0 };
    ops.fnArray.forEach((fn, k) => {
      const a = ops.argsArray[k];
      if (fn === O.save) stack.push([fill, stroke]);
      else if (fn === O.restore) [fill, stroke] = stack.pop() ?? [fill, stroke];
      else if (fn === O.setFillRGBColor) fill = hexOf(a);
      else if (fn === O.setStrokeRGBColor) stroke = hexOf(a);
      else if (fn === O.showText) {
        page.fills.add(fill);
        if (fill === letterhead.BRAND.gold) page.goldText.push(a[0].map((g) => (g && typeof g === 'object' ? g.unicode ?? '' : '')).join(''));
      } else if (fn === O.fill || fn === O.eoFill) {
        page.fills.add(fill);
        if (fill === letterhead.BRAND.gold) page.goldGraphics++;
      } else if (fn === O.stroke) {
        page.strokes.add(stroke);
        if (stroke === letterhead.BRAND.gold) page.goldGraphics++;
      } else if (fn === O.constructPath && a?.[0]?.length) {
        // pdfjs folds the paint into constructPath in newer builds; the first argument is the paint operator.
        const paint = typeof a[0] === 'number' ? a[0] : null;
        if (paint === O.fill || paint === O.eoFill) { page.fills.add(fill); if (fill === letterhead.BRAND.gold) page.goldGraphics++; }
        if (paint === O.stroke) { page.strokes.add(stroke); if (stroke === letterhead.BRAND.gold) page.goldGraphics++; }
      } else if (fn === O.paintImageXObject) page.images++;
    });
    out.push(page);
  }
  return out;
}

const DATA_LABEL = data.dataVersionLabel(data.VALUATION_DATA_VERSION);
check('market data label', DATA_LABEL === 'Market data: Damodaran 2026, risk-free 15 September 2026, local lending rates 2026', DATA_LABEL);
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
  check(`${label}: eight pages`, pages === 8 && pdfModule.REPORT_PAGE_TITLES.length === 8, String(pages));
  const t = await pageTexts(buf);
  texts[label] = t;
  pdfModule.REPORT_PAGE_TITLES.forEach((title, i) => {
    // The cover eyebrow is letter-spaced, which pdfjs extracts as spaced letters.
    const squash = (x) => x.toLowerCase().replace(/\s+/g, '');
    // Pages 6 and 7 flow as one section, so the methodology title can start at the foot of page 6.
    const onPage = squash(t[i] ?? '').includes(squash(title)) || (i === 6 && squash(t[5] ?? '').includes(squash(title)));
    check(`${label}: page ${i + 1} is "${title}"`, onPage, (t[i] ?? '').slice(0, 120));
  });
  check(`${label}: page 1 names the market data`, t[0].includes(DATA_LABEL));
  {
    const collapse = (x) => x.replace(/\s+/g, ' ');
    // Without a company the report is about "Your business", in the title and the footer alike.
    const subject = label === 'distressed' ? 'Your business' : 'Example Co';
    const details = collapse(components.detailsLine({ toolName: pdfModule.TOOL_NAME, subject, dateLabel: format.headline(result).valuationDate }));
    const tagline = theme.DEFAULT_TAGLINE;
    const footerOn = (pt, n) => pt.includes(details) && pt.includes(`Page ${n} of 8`);
    for (let n = 1; n <= 8; n++) {
      const pt = t[n - 1];
      check(`${label}: page ${n} footer carries the LLP name, tagline, tool, company, date and page number`, footerOn(pt, n) && pt.includes('PaceMakers Business Consultants LLP') && pt.includes(tagline), pt.slice(-260));
    }
    {
      const src = fs.readFileSync(path.join(root, 'src/lib/tools/pdf/components.tsx'), 'utf8');
      check(`${label}: cover, inner and closing pages all draw ReportFooter, and no letterhead footer band exists`, (src.match(/<ReportFooter brand=\{brand\} details=\{details\} \/>/g) ?? []).length === 3 && !/LetterheadFooter|footRuleTop/.test(src));
    }
    const all = collapse(t.join(' '));
    check(`${label}: legal line stated exactly once, on the closing page`, all.split(collapse(theme.LEGAL_LINE)).length === 2 && collapse(t[7]).includes(collapse(theme.LEGAL_LINE)));
    check(`${label}: contact details on the closing page only`, /Web\s*:/.test(t[7]) && t[7].includes('www.pacemakersglobal.com') && t.slice(0, 7).every((pt) => !/Web\s*:/.test(pt)), t[7].slice(-300));
    check(`${label}: footer shows the company, not the market data label`, t.slice(1, 7).every((pt) => !pt.includes(`of 8 | ${DATA_LABEL}`)));

    const colours = await pageColours(buf);
    const siteColours = ['#1B3A5F', '#14304F', '#3FA663', '#C69C3E', '#A88530', '#FAF7F2', '#F6F1E6', '#E8DDC4'];
    const used = colours.flatMap((c) => [...c.fills, ...c.strokes]);
    check(`${label}: letterhead navy and green drawn on every page`, colours.every((c) => c.fills.has(letterhead.BRAND.navy) && c.fills.has(letterhead.BRAND.green)), colours.map((c) => [...c.fills].join(' ')).join(' / ').slice(0, 300));
    check(`${label}: no website colour anywhere in the report`, !used.some((x) => siteColours.includes(x)), used.filter((x) => siteColours.includes(x)).join(', '));
    check(`${label}: gold text is the tagline only`, colours.every((c) => c.goldText.every((g) => tagline.replace(/\s/g, '').includes(g.replace(/\s/g, '')))), colours.map((c) => c.goldText.join('|')).join(' / '));
    check(`${label}: at most one small gold highlight on each inner page`, colours.slice(1, 7).every((c) => c.goldGraphics <= 1), colours.map((c) => c.goldGraphics).join(','));
    check(`${label}: the cover's only gold graphic is the base case marker`, colours[0].goldGraphics <= 1, String(colours[0].goldGraphics));
  }
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
  check('full: stake value and label on the report', f.includes(hf.stakeLabel) && f.includes(hf.table.stakeRange) && f.includes(hf.table.equityRange), hf.table.stakeRange);
  check('full: weighted value on the report', f.includes('Probability-weighted') && f.includes(hf.weighted));
  check('full: bridge items on the report', ['end of service benefits', 'lease liabilities', 'minority interest', 'surplus assets'].every((x) => f.toLowerCase().includes(x)));
  check('full: reported and normalised EBITDA on the report, each with its unit', f.includes('EBITDA, reported') && f.includes('EBITDA, normalised'));
  check('full: raised at least one warning', format.warningTexts(full).length > 0);
  for (const w of format.warningTexts(full)) check(`full: warning "${w.title}" on the report`, f.includes(w.title));
  for (const [label, r, text] of [['full', full, f], ['minimal', saudi, m]]) {
    const items = format.checkItems(r);
    check(`${label}: every check listed, Pass or Warning`, items.every((x) => text.includes(x.label)) && (text.match(/\bPASS\b/g) ?? []).length === items.filter((x) => x.status === 'pass').length && (text.match(/\bWARNING\b/g) ?? []).length === items.filter((x) => x.status === 'warning').length);
  }

  // Version 3 wording, on the reports.
  const all = [f, m, texts.Pakistan.join(' '), texts.distressed.join(' ')].join(' ');
  for (const phrase of [
    'Implied EV / LTM EBITDA',
    'Implied terminal multiple (perpetuity method)',
    'Factors that could support a higher valuation',
    'DCF (average of perpetuity and exit multiple)',
    'Equity value, perpetuity growth DCF',
    'Terminal cash flow reflects reinvestment at long-term growth.',
    'Scenarios flex the DCF; comparables use the last actual year.',
    'Exit multiple applies current comparable multiples to the final forecast year.',
    'EV / Revenue shown for reference; not used in the blend.',
    'A size premium and a private company discount are both applied.',
    'Powered by PaceMakers Business Valuation',
    'Net debt at 31 December 2025, borrowings less cash, less free cash flow earned from then to 16 September 2026, plus after-tax interest on it for that period, gives net debt at the valuation date.',
    'Borrowings, year end',
    'Net debt at year end',
    'Less after-tax interest on net debt for that period',
    'uses forecast free cash flow, not actual results',
    'Add free cash flow from 31 December 2025 to the valuation date',
    'Financial years are assumed to end on 31 December.',
    'Implied terminal ROIC',
    'Terminal reinvestment rate',
    'have not been reviewed by PaceMakers and should not be relied on for a transaction, a financing, or a tax or accounting purpose',
    'Base case',
  ]) {
    // Case-insensitive: the cover sets its labels in capitals.
    check(`reports say "${phrase}"`, all.replace(/\s+/g, ' ').toLowerCase().includes(phrase.toLowerCase()));
  }
  check('Saudi report: tax and zakat row, and no missing-cash note now cash is always entered', m.includes('Less tax and zakat') && !m.replace(/\s+/g, ' ').includes('Cash was not entered'));
  {
    // A stored version 3 lead without zakat cash still carries its disclosure.
    const v3 = engine.runValuation({ ...state.toInputs(minimalCase(state), VALUATION_DATE), schemaVersion: 3, debt: undefined, cash: undefined, netDebt: 45 }).result;
    const v3t = (await pageTexts(await pdfModule.renderValuationReport(v3, { ...REPORT_META, company: 'Example Co', industry: 'I', country: 'C', bookingHref: BOOK }))).join(' ').replace(/\s+/g, ' ');
    check('version 3 report: net debt as entered, and the missing-cash zakat note', v3t.includes('Cash was not entered, so the base is working capital alone and may be understated.') && v3t.includes('Net debt at year end (entered)') && !v3t.includes('Borrowings, year end'));
  }
  check('Saudi report: equity value as at the valuation date', m.includes('as at 16 September 2026'));
  check('full report: selected comparable companies by name', f.includes('Selected comparable companies (2)') && f.includes('Listed peer one'));
  check('risk-free yield printed to two decimals with its exact date', m.includes('5.00%') && m.replace(/\s+/g, ' ').includes('15 September 2026'));
  {
    const zb = engine.runValuation({ ...state.toInputs(minimalCase(state), VALUATION_DATE), cash: 30 }).result;
    const zt = (await pageTexts(await pdfModule.renderValuationReport(zb, { ...REPORT_META, company: 'Example Co', industry: 'I', country: 'C', bookingHref: BOOK }))).join(' ').replace(/\s+/g, ' ');
    check('zakat base on the report: working capital, cash, base, amounts and the method note', zt.includes('Zakat base (approximate)') && zt.includes('Working capital, year end') && zt.includes('Add cash, year end') && zt.includes('Zakat, FY2026 to FY2030') && zt.includes('working capital plus cash') && !zt.includes('Cash was not entered') && zt.includes('Less tax and zakat '));
  }
  for (const retired of ['Your 2 peers', 'What would increase your value', 'Implied exit multiple', 'about 5.0%', 'Midpoint', 'midpoint', 'losses not carried forward', 'is not carried forward']) {
    check(`reports no longer say "${retired}"`, !all.includes(retired));
  }
  check('WACC to two decimals on every page it appears', [...all.matchAll(/WACC,? (?:SAR |PKR |AED )?(\d+\.\d+)%/g)].every((x) => /\.\d{2}$/.test(x[1])));
  check('minimal: whole equity, no stake line', m.includes('The valuation is for 100% of the equity') && !m.includes('stake with a'));
  check('minimal: no bridge rows beyond net debt', !m.includes('Less lease liabilities') && !m.includes('Add surplus assets') && !m.includes('Less end of service benefits'));
  check('minimal: no empty other claims row on the assumptions (the bridge shows the claims)', !/Other claims, surplus assets/.test(m));
  check('full: bridge rows on the report', f.includes('Less lease liabilities') && f.includes('Add surplus assets and investments'));
  check('closing page offers the booking link', texts.full[7].toLowerCase().includes('book'));
  const code = qr.qrMatrix(BOOK);
  const decoded = (await import('qrcode')).default.create(BOOK, { errorCorrectionLevel: 'M' }).segments.map((sg) => Buffer.from(sg.data).toString('utf8')).join('');
  check('QR code encodes the tracked booking link', code.size >= 21 && decoded === BOOK, decoded);
}
{
  const raiseInputs = { ...state.toInputs(minimalCase(state), VALUATION_DATE), purpose: 'raise', raiseAmount: 100 };
  const raised = engine.runValuation(raiseInputs).result;
  const rt = (await pageTexts(await pdfModule.renderValuationReport(raised, { ...REPORT_META, purpose: 'raise', company: 'Example Co', industry: 'I', country: 'C', bookingHref: BOOK }))).join(' ');
  check('raising equity with an amount: pre-money and post-money on the report', rt.includes('Pre-money and post-money') && rt.includes('Post-money equity value') && rt.includes('Investor stake after the raise'));
  const noAmount = engine.runValuation({ ...raiseInputs, raiseAmount: null }).result;
  const nt = (await pageTexts(await pdfModule.renderValuationReport(noAmount, { ...REPORT_META, purpose: 'raise', company: 'Example Co', industry: 'I', country: 'C', bookingHref: BOOK }))).join(' ');
  check('raising equity without an amount: values shown are pre-money', nt.includes('Values shown are pre-money.') && !nt.includes('Post-money equity value'));
  check('not raising equity: no pre-money section', !texts.Saudi.join(' ').includes('Pre-money'));
  const tampered = JSON.parse(JSON.stringify(saudi));
  tampered.ev[1] += 5;
  let refused = false;
  try {
    await pdfModule.renderValuationReport(tampered, { ...REPORT_META, company: 'X', industry: 'I', country: 'C', bookingHref: BOOK });
  } catch (err) {
    refused = /reconciliation failed/.test(String(err));
  }
  check('a result that does not reconcile is refused before rendering', refused);
}
check('file name is tidy', pdfModule.reportFileName('Acme & Sons / KSA', 'x', new Date('2026-09-16')) === 'Acme & Sons KSA - Indicative Business Valuation - 16 Sep 2026.pdf', pdfModule.reportFileName('Acme & Sons / KSA', 'x', new Date('2026-09-16')));

console.log('Cost of capital working');
{
  // The densest page 5: five value factors and a stake table above the WACC working. It must stay on
  // eight pages, with the working on page 5, whether the cost of debt is built or entered.
  const base = fullFeatureCase(state);
  for (const kd of ['', '30']) {
    const s = { ...base, growth: '3', wacc: { ...base.wacc, kd } };
    s.fin = { ...s.fin, ebitda: s.fin.ebitda.map((v, i) => (i >= 3 ? String(+v * 0.5) : v)) };
    const r = fromState(s);
    const t = await pageTexts(await pdfModule.renderValuationReport(r, { ...REPORT_META, branding: null, company: 'A very long company name that goes on for a while, Holdings', bookingHref: BOOK }));
    const tag = kd ? 'entered borrowing rate' : 'built cost of debt';
    check(`WACC working, ${tag}: the densest page 5 (five factors, stake) keeps eight pages`, format.valueLevers(r).length === 5 && r.stake.used && t.length === 8, `${format.valueLevers(r).length} factors, ${t.length} pages`);
    check(`WACC working, ${tag}: on page 5, ending in the ${r.currency.code} WACC`, t[4].includes('Cost of capital') && t[4].includes(`WACC (${r.currency.code})`) && t[4].includes(format.fmtPct(r.wacc.wacc, 2)));
    if (kd) check('WACC working: an entered rate is converted to US dollar terms and named', t[4].includes('your rate 30.00%') && r.wacc.kdSource === 'entered');
    // The tax and balance sheet block is kept whole on page 6 (since 2026-09-21): both EBITDA rows with it.
    check(`densest report, ${tag}: the normalised EBITDA rows stay on page 6 with their table`, r.normalisation.used && t[5].includes('EBITDA, reported') && t[5].includes('EBITDA, normalised') && t[5].includes('Balance sheet') && !t[6].includes('EBITDA, normalised'));
  }
  // The steps reconcile: each result is the engine's figure, and the local WACC is the converted dollar WACC.
  for (const [label, r] of [['Saudi', saudi], ['Pakistan', pakistan]]) {
    const st = format.waccSteps(r.wacc, r.currency);
    const val = (k) => st.find((x) => x.key === k)?.value;
    check(`${label}: working shows the engine's cost of equity, after-tax cost of debt and WACC`, val('ke') === format.fmtPct(r.wacc.ke, 2) && val('kdt') === format.fmtPct(r.wacc.kdt, 2) && val(r.currency.pegged ? 'wacc_base' : 'wacc_local') === format.fmtPct(r.wacc.wacc, 2));
    check(`${label}: US dollar lines are labelled only when the currency is not pegged`, st.some((x) => x.label.includes('(US dollars)')) === !r.currency.pegged);
  }
}

console.log('Header reaches the page edges');
{
  // Read from the drawing operators, not a raster: the cover once stopped 0.28pt short of the right
  // edge (A4 is 595.28pt, the grid 595pt), a hairline no raster at report size shows but a viewer at
  // zoom does. A navy shape must cover the top edge across the full width, and the green swoosh must
  // run past the right edge, on the cover, an inner page and the closing page alike.
  const buf = await pdfModule.renderValuationReport(saudi, { ...REPORT_META, company: 'Example Co', industry: 'I', country: 'C', bookingHref: BOOK });
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), verbosity: 0 }).promise;
  const O = pdfjs.OPS;
  const mul = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
  const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(',');
  const NAVY = rgb(letterhead.BRAND.navy), GREEN = rgb(letterhead.BRAND.green);
  async function topShapes(n) {
    const page = await doc.getPage(n);
    const [, , W, H] = page.view;
    const ops = await page.getOperatorList();
    let ctm = [1, 0, 0, 1, 0, 0], fill = null;
    const stack = [], out = [];
    ops.fnArray.forEach((fn, i) => {
      const a = ops.argsArray[i];
      if (fn === O.save) stack.push([...ctm]);
      else if (fn === O.restore) ctm = stack.pop() ?? ctm;
      else if (fn === O.transform) ctm = mul(ctm, a);
      else if (fn === O.setFillRGBColor) fill = typeof a[0] === 'string' ? [1, 3, 5].map((k) => parseInt(a[0].slice(k, k + 2), 16)).join(',') : a.join(',');
      else if (fn === O.constructPath) {
        const mm = a[2] ?? a[a.length - 1];
        if (!mm || mm.length < 4) return;
        const p = [[mm[0], mm[1]], [mm[2], mm[3]]].map(([x, y]) => [ctm[0] * x + ctm[2] * y + ctm[4], ctm[1] * x + ctm[3] * y + ctm[5]]);
        const box = { fill, left: Math.min(p[0][0], p[1][0]), right: W - Math.max(p[0][0], p[1][0]), top: H - Math.max(p[0][1], p[1][1]), bottom: H - Math.min(p[0][1], p[1][1]) };
        if (box.top < 40) out.push(box);
      }
    });
    return out;
  }
  for (const [n, name] of [[1, 'cover'], [4, 'inner page'], [8, 'closing page']]) {
    const shapes = await topShapes(n);
    const bar = shapes.find((b) => b.fill === NAVY && b.left <= 0 && b.right <= 0 && b.top <= 0 && b.bottom < 20);
    const swoosh = shapes.filter((b) => b.fill === GREEN && b.top <= 0);
    check(`${name}: navy bar covers the top edge from left to right, no gap`, Boolean(bar), JSON.stringify(shapes.filter((b) => b.fill === NAVY).slice(0, 3)));
    // The swoosh is clipped to its drawing box, whose navy strip starts part way across: that box, not just the paths, must reach the edge.
    const swooshBox = shapes.filter((b) => b.fill === NAVY && b.left > 100);
    check(`${name}: green swoosh and its drawing box reach past the right edge`, swoosh.length > 0 && swoosh.every((b) => b.right <= 0) && swooshBox.length > 0 && swooshBox.every((b) => b.right <= 0), JSON.stringify({ swoosh, swooshBox }));
  }
}

console.log('File name and untitled report');
{
  const fnm = await jiti.import(path.join(root, 'src/lib/tools/pdf/fileName.ts'));
  const d = new Date('2026-09-21T10:00:00Z');
  check('file name with a company', fnm.reportFileName('Acme Clinics', 'Jane Smith', d) === 'Acme Clinics - Indicative Business Valuation - 21 Sep 2026.pdf', fnm.reportFileName('Acme Clinics', 'Jane Smith', d));
  check('file name without a company uses the person', fnm.reportFileName('', 'Jane Smith', d) === 'Indicative Business Valuation - Jane Smith - 21 Sep 2026.pdf' && fnm.reportFileName(null, 'Jane Smith', d) === fnm.reportFileName('  ', 'Jane Smith', d));
  check('file name drops characters a file system refuses', fnm.reportFileName('A/B: "Co" <1>?', 'X', d) === 'A B Co 1 - Indicative Business Valuation - 21 Sep 2026.pdf', fnm.reportFileName('A/B: "Co" <1>?', 'X', d));
  const arabic = fnm.reportFileName('شركة المثال', 'X', d);
  const header = fnm.attachmentHeader(arabic);
  check('download header carries an ASCII name and the full UTF-8 name', /filename="[\x20-\x7e]+"/.test(header) && fnm.fileNameFromHeader(header) === arabic);
  check('the browser reads the plain name when there is no UTF-8 one', fnm.fileNameFromHeader('attachment; filename="a b.pdf"') === 'a b.pdf' && fnm.fileNameFromHeader(null) === null);
  check('the report module still exports the same rule', pdfModule.reportFileName('Acme', 'J', d) === fnm.reportFileName('Acme', 'J', d));
  const untitled = await pageTexts(await pdfModule.renderValuationReport(saudi, { ...REPORT_META, company: null, preparedFor: 'Jane Smith', industry: 'I', country: 'C', bookingHref: BOOK }));
  check('no company: the cover title is "Your business", not the person', untitled[0].includes('Your business') && !untitled[0].replace('Prepared for Jane Smith', '').includes('Jane Smith'), untitled[0].slice(0, 200));
}

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
  // The original Header Settings white logo, byte for byte, drawn at its own proportions.
  check('logo file is the Header Settings white logo, byte for byte', png.equals(fs.readFileSync(path.join(root, 'src/lib/tools/pdf/brand/logo-white.png'))) && pw > 2000, `${pw}x${ph}`);
  check('logo drawn at the file\'s own proportions', Math.abs(base.EMAIL_LOGO.width - (base.EMAIL_LOGO.height * pw) / ph) <= 1, `${base.EMAIL_LOGO.width}x${base.EMAIL_LOGO.height} for ${pw}x${ph}`);

  // The report variant, used by the tool results email and lead alert.
  const rep = await base.baseLayoutBranded('<p>Body</p>', { variant: 'report' });
  const rimg = rep.match(/<img[^>]*>/)?.[0] ?? '';
  check('report email: colour logo PNG with width, height and alt', rimg.includes(`src="${base.EMAIL_LOGO_COLOUR.src}"`) && rimg.includes(`width="${base.EMAIL_LOGO_COLOUR.width}"`) && rimg.includes(`height="${base.EMAIL_LOGO_COLOUR.height}"`) && /alt="PaceMakers Business Consultants"/.test(rimg), rimg);
  {
    const cfile = path.join(root, 'public', new URL(base.EMAIL_LOGO_COLOUR.src).pathname);
    const cpng = fs.existsSync(cfile) ? fs.readFileSync(cfile) : Buffer.alloc(0);
    const cw = cpng.length > 24 ? cpng.readUInt32BE(16) : 0, chh = cpng.length > 24 ? cpng.readUInt32BE(20) : 0;
    check('report email: colour logo file is the Header Settings colour logo, byte for byte', cpng.equals(fs.readFileSync(path.join(root, 'src/lib/tools/pdf/brand/logo.png'))) && cw > 2000, `${cw}x${chh}`);
    check('report email: colour logo drawn at the file\'s own proportions', Math.abs(base.EMAIL_LOGO_COLOUR.width - (base.EMAIL_LOGO_COLOUR.height * cw) / chh) <= 1, `${base.EMAIL_LOGO_COLOUR.width}x${base.EMAIL_LOGO_COLOUR.height} for ${cw}x${chh}`);
  }
  check('report email: navy and green accent strip, gold tagline', rep.includes(`bgcolor="${letterhead.BRAND.green}"`) && rep.includes(`bgcolor="${letterhead.BRAND.navy}"`) && new RegExp(`color:${letterhead.BRAND.gold};">Advisory from Structure to Exit`).test(rep));
  check('report email: legal line and contact details in the footer', rep.includes(templates.escapeHtml(letterhead.LEGAL_LINE)) && rep.includes('www.pacemakersglobal.com'));
  check('report email: the website is printed and linked as https://www.pacemakersglobal.com, and nothing is http', rep.includes('>https://www.pacemakersglobal.com</a>') && rep.includes('href="https://www.pacemakersglobal.com"') && !/http:\/\//.test(rep));
  check('site email shell: the website is printed and linked as https://www.pacemakersglobal.com', html.includes('>https://www.pacemakersglobal.com</a>') && !/href="http:\/\//.test(html));
  check('report email: no website colours', !/#1B3A5F|#C69C3E|#FAF7F2|#14304F|#A88530/i.test(rep));
  check('report email: gold only in the tagline', (rep.match(new RegExp(letterhead.BRAND.gold, 'g')) ?? []).length === 1);
  check('site email shell unchanged: navy header, white logo, gold hairline', html.includes('background:#1B3A5F') && html.includes(base.EMAIL_LOGO.src) && html.includes('background:#C69C3E'));
  {
    const deliverSrc = fs.readFileSync(path.join(root, 'src/lib/tools/leads/deliver.ts'), 'utf8');
    check('tool results email and alert use the report shell', (deliverSrc.match(/baseLayoutBranded\(body, \{ variant: 'report' \}\)/g) ?? []).length === 2);
  }

  const btn = templates.button('https://example.com/x', 'Book a free call');
  const td = btn.match(/<td[^>]*>/)?.[0] ?? '';
  const a = btn.match(/<a[^>]*>/)?.[0] ?? '';
  check('button padding is on the cell', /padding:13px 26px/.test(td) && /mso-padding-alt:13px 26px/.test(td) && /bgcolor="#/.test(td), td);
  check('button link carries no padding', !/padding/.test(a), a);
  check('results button is green, alert button navy', btn.includes(`bgcolor="${letterhead.BRAND.green}"`) && templates.button('https://example.com/x', 'Open the lead', 'navy').includes(`bgcolor="${letterhead.BRAND.navy}"`));

  const build = (result) => templates.buildResultsEmail({ template: templates.DEFAULT_TEMPLATES[templates.RESULTS_TEMPLATE_KEY], name: 'A', email: 'a@example.com', company: null, result, bookingHref: BOOK }).body;
  const fb = build(full), mb = build(saudi);
  check('results email body: no website colours', !/#1B3A5F|#C69C3E|#FAF7F2/i.test(fb + mb));
  const hf = format.headline(full);
  check('results email, full: weighted value row', fb.includes(format.LABELS.weighted) && fb.includes(templates.escapeHtml(hf.table.weighted)));
  check('results email, full: stake value row', fb.includes(templates.escapeHtml(`Value of ${hf.stakeLabel}`)) && fb.includes(templates.escapeHtml(hf.table.stakeRange)));
  check('results email, minimal: weighted row shown (scenarios always run)', mb.includes(format.LABELS.weighted));
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

console.log('Narrative and cover');
{
  const withWeight = (w) => fromState({ ...fullFeatureCase(state), dcfWeight: String(w) });
  const text50 = format.executiveSummary(withWeight(50)).join(' ');
  const text60 = format.executiveSummary(withWeight(60)).join(' ');
  const text40 = format.executiveSummary(withWeight(40)).join(' ');
  check('narrative: DCF weight 50% says nothing about the forecast carrying the answer', !text50.includes('forecast carries most of the answer'));
  check('narrative: DCF weight 40% says nothing about it either', !text40.includes('forecast carries most of the answer'));
  check('narrative: DCF weight 60% says the forecast carries most of the answer', text60.includes('so the forecast carries most of the answer'));
  const diverging = [text40, text50, text60].find((t) => t.includes('gives the higher value'));
  check('narrative: a diverging case exists to test the wording', Boolean(diverging));
  check('narrative: "the comparables method gives", never "the comparables gives"', !/the comparables gives/.test(text40 + text50 + text60) && (text50.includes('the comparables method gives') || text50.includes('the DCF gives')));

  // The cover: a KPI row under the headline, on the cover, in every case.
  for (const [label, result] of [['Saudi', saudi], ['full', full], ['distressed', distressed]]) {
    const t = await pageTexts(await pdfModule.renderValuationReport(result, { ...REPORT_META, company: 'Example Co', industry: 'I', country: 'C', bookingHref: BOOK }));
    const h = format.headline(result);
    const cover = t[0].replace(/ +/g, ' ');
    const squash = cover.split(' ').join('').toLowerCase();
    check(`${label}: cover KPI row carries WACC, terminal value share and EV / LTM EBITDA`, squash.includes('wacc') && squash.includes('terminalvalueshare') && squash.includes('ev/ltmebitda') && [h.wacc, h.tvShare, h.ltmMultiple].every((v) => squash.includes(v.split(" ").join("").toLowerCase())), cover.slice(0, 400));
    check(`${label}: fourth KPI is the weighted value`, squash.includes('probability-weighted') && cover.includes(h.weighted));
    check(`${label}: the cover carries the low, base case and high bar`, squash.includes('low') && squash.includes('basecase') && squash.includes('high'));
    check(`${label}: still eight pages with the KPI row`, t.length === 8);
  }
}

console.log('Company profile on the report');
{
  const prof = await jiti.import(path.join(root, 'src/lib/tools/valuation/profile.ts'));
  // The longest name the form allows, in words, as a real company name would be.
  const maxName = prof.cleanCompanyName('Al Mashreq Integrated Industrial Manufacturing and Engineering Services Holding Company for Energy Water and Infrastructure Limited');
  check('name fixture is at the limit', maxName.length === prof.PROFILE_LIMITS.companyName, String(maxName.length));
  // The longest description the form allows, in two paragraphs of real words.
  const words = 'The business designs, manufactures and services industrial equipment for energy and water clients across the region. ';
  const para = (n) => words.repeat(Math.ceil(n / words.length)).slice(0, n).trim();
  const maxDescription = prof.cleanDescription(`${para(495)}\n\n${para(495)}`);
  check('profile fixture is at the limit', maxDescription.length >= 980 && maxDescription.length <= prof.PROFILE_LIMITS.description, String(maxDescription.length));
  for (const [label, result] of [['full', full], ['distressed', distressed], ['Saudi', saudi]]) {
    const buf = await pdfModule.renderValuationReport(result, { ...REPORT_META, company: maxName, industry: 'Industry', country: 'Country', bookingHref: BOOK, description: maxDescription });
    const t = await pageTexts(buf);
    check(`${label}, longest name and description: still eight pages`, t.length === 8, String(t.length));
    // The cover carries it: the one page with room for the longest description in every case.
    const squashed = t[0].replace(/\s+/g, '');
    check(`${label}: cover carries About the business`, /aboutthebusiness/i.test(squashed), t[0].slice(-300));
    check(`${label}: both paragraphs present on the cover, in full`, prof.descriptionParagraphs(maxDescription).every((p) => squashed.includes(p.replace(/\s+/g, ''))));
    check(`${label}: attributed to the visitor`, t[0].includes('As described by') && t[0].includes('Not reviewed by PaceMakers'));
    check(`${label}: the long company name is on the cover`, squashed.includes(maxName.replace(/\s+/g, '')));
  }
  {
    // A typical description sits in the cover's lower half (since 2026-09-21), not tight under the figures.
    const typical = 'The business runs three clinics in Riyadh and Jeddah for family and occupational health.\n\nThe owners are considering a partial sale to fund a fourth site.';
    const buf = await pdfModule.renderValuationReport(saudi, { ...REPORT_META, company: 'Example Co', industry: 'I', country: 'C', bookingHref: BOOK, description: typical });
    const cover = await (await pdfjs.getDocument({ data: new Uint8Array(buf), verbosity: 0 }).promise).getPage(1);
    const H = cover.getViewport({ scale: 1 }).height;
    const first = (await cover.getTextContent()).items.find((i) => i.str.includes('The business runs three clinics'));
    const top = first ? H - first.transform[5] : NaN;
    check('typical description: in the lower half of the cover', top > H / 2, `${Math.round(top)} of ${Math.round(H)}pt from the top`);
  }
  const none = await pageTexts(await pdfModule.renderValuationReport(full, { ...REPORT_META, company: null, industry: 'I', country: 'C', bookingHref: BOOK }));
  check('no description: no About block', !none[0].includes('Not reviewed by PaceMakers'));
  check('clean: control characters removed and at most two paragraphs', prof.cleanDescription('a\u0000b\n\nc\n\nd') === 'ab\n\nc');
  check('clean: blank is null', prof.cleanDescription(' \n ') === null && prof.cleanCompanyName('   ') === null && prof.cleanProfile({ companyName: ' ', description: '' }) === undefined);
}

console.log('Report branding and partner');
{
  // The mapping from the founder profile's hero, as stored. Nothing else is read.
  const hero = {
    name: ' Test Partner ', eyebrow: 'Founding Partner', title_primary: 'Corporate Finance Specialist', credentials_line: 'ACCA | FMVA | AFM |12+ Years Experience',
    intro: 'An introduction   over two lines.', photo_url: 'https://example.supabase.co/storage/v1/object/public/team-photos/p.png',
    cta_primary_href: 'https://www.linkedin.com/in/example/',
    report_highlights: 'One\n Two \n\nThree\r\nFour\nFive\nSix',
  };
  const card = partnerModule.partnerFromHero(hero);
  check('partner: name trimmed', card?.name === 'Test Partner');
  check('partner: intro whitespace collapsed', card?.intro === 'An introduction over two lines.');
  check('partner: credentials separators spaced evenly ("AFM |12+" fixed)', card?.credentialsLine === 'ACCA | FMVA | AFM | 12+ Years Experience', card?.credentialsLine);
  check('partner: highlights from report_highlights, one per line, blanks dropped, at most five', JSON.stringify(card?.highlights) === JSON.stringify(['One', 'Two', 'Three', 'Four', 'Five']), JSON.stringify(card?.highlights));
  check('partner: no report_highlights means no highlights', partnerModule.partnerFromHero({ ...hero, report_highlights: undefined })?.highlights.length === 0);
  check('partner: the function takes only the hero (home card cannot feed it)', partnerModule.partnerFromHero.length === 1 && !('partnerFromSections' in partnerModule));
  check('partner: fetch reads only the founder profile hero', (() => { const src = fs.readFileSync(path.join(root, 'src/lib/tools/brand/fetch.ts'), 'utf8'); return !src.includes("'founder_block'") && !src.includes("'home'") && src.includes("partnerFromHero(await sectionContent(FOUNDER_PAGE_SLUG, 'founder_hero'))"); })());
  check('partner: highlights field is editable in the founder hero editor', fs.readFileSync(path.join(root, 'src/components/admin/editors/FounderHeroEditor.tsx'), 'utf8').includes("set('report_highlights'"));
  check('partner: photo and LinkedIn from the hero', card?.photoUrl === hero.photo_url && card?.linkedinUrl === hero.cta_primary_href);
  check('partner: profile path is the founder page', card?.profilePath === '/about/ahmad-din', card?.profilePath);
  check('partner: a non-LinkedIn primary link is not offered as LinkedIn', partnerModule.partnerFromHero({ ...hero, cta_primary_href: '/book' })?.linkedinUrl === null);
  check('partner: a non-https photo is dropped', partnerModule.partnerFromHero({ ...hero, photo_url: 'javascript:alert(1)' })?.photoUrl === null);
  check('partner: no name means no card', partnerModule.partnerFromHero({ intro: 'x' }) === null);
  check('partner: slug matches founderProfile.ts', founderProfileSrc.includes(`FOUNDER_PAGE_SLUG = '${partnerModule.PARTNER_PAGE_SLUG}'`));

  // The logos: the Header Settings colour logo on white, the white logo on dark, never recoloured.
  {
    const src = fs.readFileSync(path.join(root, 'src/lib/tools/brand/fetch.ts'), 'utf8');
    check('report logo is the header colour logo, same treatment as any logo', src.includes("processedImage(branding?.logo_url || null, 'logo')"));
    check('report white logo is the header dark logo', src.includes("processedImage(branding?.logo_dark_url || null, 'logo-dark')"));
    check('no recolouring of the logo anywhere', !/recolourGreenToGold|logo-navy-gold/.test(src));
  }

  // Real images from the repository stand in for the CMS files.
  const sharp = (await import('sharp')).default;
  // Distinct sizes, so the PDF shows which file was drawn.
  const logo = await sharp(fs.readFileSync(path.join(root, 'public/email/pacemakers-logo.png'))).resize({ width: 520, height: 100, fit: 'fill' }).png().toBuffer();
  const logoOnDark = await sharp(fs.readFileSync(path.join(root, 'public/email/pacemakers-logo-on-navy.png'))).resize({ width: 624, height: 120, fit: 'fill' }).png().toBuffer();
  const portrait = await sharp({ create: { width: 360, height: 450, channels: 3, background: '#1B3A5F' } }).jpeg().toBuffer();
  const branding = { logo, logoOnDark, partner: card, partnerPhoto: portrait };
  const render = (b) => pdfModule.renderValuationReport(full, { ...REPORT_META, company: 'Example Co', industry: 'Industry', country: 'Country', bookingHref: BOOK, branding: b });
  const withBrand = await render(branding);
  const raw = withBrand.toString('latin1');
  const t = await pageTexts(withBrand);
  check('branded: still eight pages', t.length === 8, String(t.length));
  check('branded: logo and portrait embedded as images', (raw.match(/\/Subtype\s*\/Image/g) ?? []).length >= 2);
  check('branded: cover uses the logo, not the typeset name', !t[0].includes('PaceMakers Business Consultants ADVISORY') && !/^PaceMakers Business Consultants/.test(t[0]));
  {
    const colours = await pageColours(withBrand);
    check('branded: the logo is drawn on the cover', colours[0].images >= 1, String(colours[0].images));
    check('branded: the logo is drawn on the closing page', colours[7].images >= 2, String(colours[7].images));
    check('branded: the colour logo, not the white one, on the white pages', raw.includes('/Width 520') && !raw.includes('/Width 624'));
    const { Document, Page, View } = await import('@react-pdf/renderer');
    const React = (await import('react')).default;
    const h = React.createElement;
    const resolved = theme.withBrandDefaults(branding);
    const dark = await (await import('@react-pdf/renderer')).renderToBuffer(h(Document, null, h(Page, { size: 'A4' }, h(View, { style: { backgroundColor: theme.RC.navy, padding: 20 } }, h(components.BrandLogo, { brand: resolved, height: 20, onDark: true })))));
    const darkRaw = dark.toString('latin1');
    check('a logo on a dark background uses the white file', darkRaw.includes('/Width 624') && !darkRaw.includes('/Width 520'));
    const darkNoFile = await (await import('@react-pdf/renderer')).renderToBuffer(h(Document, null, h(Page, { size: 'A4' }, h(View, { style: { backgroundColor: theme.RC.navy, padding: 20 } }, h(components.BrandLogo, { brand: theme.withBrandDefaults({ ...branding, logoOnDark: null }), height: 20, onDark: true })))));
    const darkNoFileRaw = darkNoFile.toString('latin1');
    check('without a live white file, a dark background gets the bundled white logo, never the colour logo', /\/Width 6113/.test(darkNoFileRaw) && !darkNoFileRaw.includes('/Width 520') && (await pageTexts(darkNoFile))[0].trim() === '');
  }
  const last = t[7];
  check('branded: closing page names the partner and role', last.includes('Test Partner') && last.includes('Founding Partner, Corporate Finance Specialist'));
  check('branded: closing page carries credentials, intro and every highlight', last.includes('ACCA | FMVA | AFM | 12+ Years Experience') && last.includes('An introduction over two lines.') && card.highlights.every((h) => last.includes(h)));
  check('branded: highlights attributed to the partner, not the firm', last.includes(partnerModule.PARTNER_RECORD_NOTE));
  check('branded: services and booking still on the closing page', last.includes('CFO Advisory') && /bookafreecall/i.test(last.replace(/\s+/g, '')));

  const bare = await render(null);
  const tb = await pageTexts(bare);
  check('no branding: still eight pages', tb.length === 8);
  {
    const bareColours = await pageColours(bare);
    check('no branding: the bundled Header Settings logo is drawn in the cover and closing page headers', bareColours[0].images >= 2 && bareColours[7].images >= 2, `${bareColours[0].images}, ${bareColours[7].images}`);
    check('no branding: the brand name is never set in type in place of the logo', !tb[0].startsWith('PaceMakers Business Consultants'));
    const sharpMeta = async (f) => (await import('sharp')).default(fs.readFileSync(path.join(root, 'src/lib/tools/pdf/brand', f))).metadata();
    const [colourMeta, whiteMeta] = await Promise.all([sharpMeta('logo.png'), sharpMeta('logo-white.png')]);
    check('bundled logos are the full size Header Settings artwork, not reduced copies', colourMeta.width === 6123 && colourMeta.height === 1175 && whiteMeta.width === 6113 && whiteMeta.height === 1176, `${colourMeta.width}x${colourMeta.height}, ${whiteMeta.width}x${whiteMeta.height}`);
    check('the report embeds the logo at its original pixel size', /\/Width 6123[\s\S]{0,80}\/Height 1175|\/Height 1175[\s\S]{0,80}\/Width 6123/.test(bare.toString('latin1')));
    {
      const src = fs.readFileSync(path.join(root, 'src/lib/tools/brand/fetch.ts'), 'utf8');
      check('logos are fetched as stored: no resize, trim, flatten or recolour', src.includes("value = kind === 'portrait' ? await portrait(input) : imageFormat(input) ? input : null;") && !/trim\(\)|flatten\(/.test(src.slice(src.indexOf('async function processedImage'))));
    }
    const cover = await pageColours(bare);
    check('logo drawn once in the cover and closing page headers, plus the footer logo', cover[0].images === 2 && cover[7].images >= 2, `${cover[0].images}, ${cover[7].images}`);
    {
      // Header layout, read from the text positions pdf.js reports (y from the top of the page).
      const doc = await pdfjs.getDocument({ data: new Uint8Array(bare), verbosity: 0 }).promise;
      for (const n of [1, 8]) {
        const items = (await (await doc.getPage(n)).getTextContent()).items;
        check(`page ${n}: letterhead header has the logo and no tagline; the tagline is in the footer only`, items.every((it) => !(it.str.includes('Advisory from Structure') && 842 - it.transform[5] < 150)) && items.some((it) => it.str.includes('Advisory from Structure') && 842 - it.transform[5] > 780) && cover[n - 1].images >= 2, String(cover[n - 1].images));
      }
      for (let n = 2; n <= 7; n++) {
        const items = (await (await doc.getPage(n)).getTextContent()).items;
        check(`page ${n}: inner header has no logo or tagline, only the footer does`, items.every((it) => !(it.str.includes('Advisory from Structure') && 842 - it.transform[5] < 100)) && cover[n - 1].images === 1, String(cover[n - 1].images));
      }
    }
    const coverText = tb[0].replace(/\s+/g, ' ');
    check('the cover names the same market data label as the data behind the figures', coverText.includes(data.dataVersionLabel(full.meta.dataVersion)));
    check('the closing page shows the live website address in full, https://www.pacemakersglobal.com, never a local host or http', tb[7].includes('https://www.pacemakersglobal.com') && !/localhost|vercel\.app|127\.0\.0\.1|http:\/\//.test(tb.join(' ')));
    const nextConfig = fs.readFileSync(path.join(root, 'next.config.ts'), 'utf8');
    check('bundled logos are traced into every PDF route', (nextConfig.match(/'\.\/src\/lib\/tools\/pdf\/brand\/\*\*'/g) ?? []).length === (nextConfig.match(/'\.\/src\/lib\/tools\/pdf\/fonts\/\*\*'/g) ?? []).length);
  }
  check('no branding: closing page still carries the legal line and the site address', tb[7].replace(/\s+/g, ' ').includes(theme.LEGAL_LINE) && tb[7].includes('www.pacemakersglobal.com'));
  check('no branding: no partner block, full service summaries', !tb[7].includes('Who you will work with') && tb[7].includes('Institutional-grade'));
  const noPhoto = await pageTexts(await render({ ...branding, partnerPhoto: null, logo: null }));
  check('partner without photo or logo: eight pages, block kept', noPhoto.length === 8 && noPhoto[7].includes('Test Partner'));
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
  check('long tracked link redirects through the shared booking redirect to /book only', routeSrc.includes('resolveLegacyLink(') && routeSrc.includes('bookingRedirectResponse(') &&!/booking_url|calendly/i.test(routeSrc.replace(/\/\*[\s\S]*?\*\//g, '')));
}

console.log(`\n${checks - failures} of ${checks} checks passed.`);
if (failures) {
  console.log(`${failures} FAILED`);
  process.exitCode = 1;
} else console.log('COMPLETE');
