// scripts/render-valuation-examples.mjs
//
// Renders two example PDF reports for review, with no database and no email:
//   valuation-example-minimal.pdf   the reference example at its defaults
//   valuation-example-full.pdf      Pakistan with every version 2 feature in use
//
//   npm run render-valuation-examples -- <output directory>

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';

import { REPORT_META, fullFeatureCase, minimalCase } from './lib/valuationCases.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(process.argv[2] ?? path.join(root, '.valuation-examples'));
fs.mkdirSync(out, { recursive: true });

const jiti = createJiti(import.meta.url, { alias: { '@': path.join(root, 'src') }, jsx: { runtime: 'automatic' } });
const state = await jiti.import(path.join(root, 'src/components/tools/valuation/state.ts'));
const engine = await jiti.import(path.join(root, 'src/lib/tools/valuation/engine.ts'));
const pdf = await jiti.import(path.join(root, 'src/lib/tools/pdf/ValuationReport.tsx'));

for (const [name, build, meta] of [
  ['minimal', minimalCase, { company: 'Example Healthcare Co', industry: 'Healthcare Support Services', country: 'Saudi Arabia' }],
  ['full', fullFeatureCase, { company: 'Example Foods Pakistan', industry: 'Food Processing', country: 'Pakistan' }],
]) {
  const outcome = engine.runValuation(state.toInputs(build(state)));
  if (!outcome.ok) throw new Error(`${name} did not run: ${JSON.stringify(outcome.errors)}`);
  const buf = await pdf.renderValuationReport(outcome.result, { ...REPORT_META, ...meta });
  const file = path.join(out, `valuation-example-${name}.pdf`);
  fs.writeFileSync(file, buf);
  console.log(`${file}  ${(buf.length / 1024).toFixed(0)} KB, warnings: ${outcome.result.warnings.map((w) => w.code).join(', ') || 'none'}`);
}
