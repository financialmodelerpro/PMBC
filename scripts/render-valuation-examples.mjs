// scripts/render-valuation-examples.mjs
//
// Renders two example PDF reports for review, with no database and no email:
//   valuation-example-minimal.pdf   the reference example at its defaults
//   valuation-example-full.pdf      Pakistan with every version 2 feature in use
//
//   npm run render-valuation-examples -- <output directory>
//
// The logo and the partner card are read from the CMS exactly as the live report
// reads them, which is read only. The Supabase URL and key come from .env.local
// when it exists; without them both reports render with the fallbacks (the name
// set in type, no partner block), which is also a state worth reviewing.
// BRANDING=none forces the fallbacks.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';

import { REPORT_META, VALUATION_DATE, fullFeatureCase, minimalCase } from './lib/valuationCases.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(process.argv[2] ?? path.join(root, '.valuation-examples'));
fs.mkdirSync(out, { recursive: true });

const jiti = createJiti(import.meta.url, { alias: { '@': path.join(root, 'src') }, jsx: { runtime: 'automatic' } });
const state = await jiti.import(path.join(root, 'src/components/tools/valuation/state.ts'));
const engine = await jiti.import(path.join(root, 'src/lib/tools/valuation/engine.ts'));
const pdf = await jiti.import(path.join(root, 'src/lib/tools/pdf/ValuationReport.tsx'));

const envFile = path.join(root, '.env.local');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^(SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
let branding = null;
if (process.env.BRANDING !== 'none' && process.env.SUPABASE_URL) {
  const brand = await jiti.import(path.join(root, 'src/lib/tools/brand/fetch.ts'));
  branding = await brand.fetchReportBranding();
}
console.log(`branding: logo ${branding?.logo ? 'yes' : 'no'}, white logo ${branding?.logoOnDark ? 'yes' : 'no'}, partner ${branding?.partner?.name ?? 'none'}, photo ${branding?.partnerPhoto ? 'yes' : 'no'}`);

for (const [name, build, meta] of [
  ['minimal', minimalCase, { company: 'Example Healthcare Co', industry: 'Healthcare Support Services', country: 'Saudi Arabia' }],
  ['full', fullFeatureCase, { company: 'Example Foods Pakistan', industry: 'Food Processing', country: 'Pakistan' }],
]) {
  const inputs = state.toInputs(build(state), VALUATION_DATE);
  const outcome = engine.runValuation(inputs);
  if (!outcome.ok) throw new Error(`${name} did not run: ${JSON.stringify(outcome.errors)}`);
  const buf = await pdf.renderValuationReport(outcome.result, { ...REPORT_META, ...meta, branding, description: inputs.profile?.description });
  const file = path.join(out, `valuation-example-${name}.pdf`);
  fs.writeFileSync(file, buf);
  console.log(`${file}  ${(buf.length / 1024).toFixed(0)} KB, warnings: ${outcome.result.checks.filter((c) => c.status === 'warning').map((c) => c.id).join(', ') || 'none'}`);
}
