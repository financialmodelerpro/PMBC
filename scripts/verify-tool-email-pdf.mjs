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
//   4. PDF: renders for a Saudi, a Pakistan and a distressed case; is a PDF;
//      has five pages; embeds both site typefaces.
//   5. Brevo payload: the attachment decodes to that PDF, the tags and the
//      X-Mailin-custom header are present, and a plain send (the contact form)
//      carries none of the new fields.
//
//   npm run verify-tool-email-pdf

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const jiti = createJiti(import.meta.url, { alias: { '@': path.join(root, 'src') }, jsx: { runtime: 'automatic' } });
const templates = await jiti.import(path.join(root, 'src/lib/tools/email/templates.ts'));
const pdfModule = await jiti.import(path.join(root, 'src/lib/tools/pdf/ValuationReport.tsx'));
const engine = await jiti.import(path.join(root, 'src/lib/tools/valuation/engine.ts'));
const format = await jiti.import(path.join(root, 'src/lib/tools/valuation/format.ts'));
const state = await jiti.import(path.join(root, 'src/components/tools/valuation/state.ts'));
const send = await jiti.import(path.join(root, 'src/lib/email/send.ts'));

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

const saudi = fromState(state.onEnterWacc(state.onLeaveCompany(state.exampleState())));

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
const pdfs = {};
for (const [label, result] of [['Saudi', saudi], ['Pakistan', pakistan], ['distressed', distressed]]) {
  const buf = await pdfModule.renderValuationReport(result, {
    preparedFor: 'Test Person',
    company: label === 'distressed' ? null : 'Example Co',
    industry: 'Industry',
    country: 'Country',
    purpose: 'sale',
    generatedAt: new Date('2026-09-16T12:00:00Z'),
    dataVersion: '2026-09-16',
    bookingHref: BOOK,
  });
  pdfs[label] = buf;
  const text = buf.toString('latin1');
  const pages = (text.match(/\/Type\s*\/Page[^s]/g) ?? []).length;
  check(`${label}: is a PDF`, buf.subarray(0, 5).toString() === '%PDF-');
  check(`${label}: five pages`, pages === 5, String(pages));
  check(`${label}: embeds Inter and Source Serif 4`, /Inter/.test(text) && /SourceSerif/.test(text));
  check(`${label}: reasonable size`, buf.length > 20_000 && buf.length < 2_000_000, String(buf.length));
  check(`${label}: carries the booking link`, text.includes(BOOK));
  if (process.env.PDF_OUT) fs.writeFileSync(path.join(process.env.PDF_OUT, `report-${label}.pdf`), buf);
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

console.log(`\n${checks - failures} of ${checks} checks passed.`);
if (failures) {
  console.log(`${failures} FAILED`);
  process.exitCode = 1;
} else console.log('COMPLETE');
