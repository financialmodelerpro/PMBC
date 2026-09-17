/**
 * The checks run on every valuation, each reported as Pass or Warning.
 *
 * Every check runs every time, so the report can show the full list rather
 * than only what went wrong: a reader learns as much from "the two methods
 * agree" as from "they do not". Checks that need an input the visitor may
 * leave blank (invested capital) or a choice they may not make (a control
 * premium) are listed only when that input exists, since a Pass on a test
 * that was never run would claim something untrue.
 *
 * Called by the engine on the finished result, so every threshold is read from
 * `WARNING_RULES` and every figure from the result itself. The wording is here
 * rather than in the report because the message is part of what a check
 * found; the formatters it uses are the report's own.
 *
 * Relative imports only, so the verifiers can load this file outside Next.
 */

import { COUNTRIES, MARKET, WARNING_RULES } from './data';
import type { Check, ValuationResult } from './engine';
import { amountUnit, fmtAmount, fmtMultiple, fmtPct } from './format';

const R = WARNING_RULES;

export function buildChecks(r: ValuationResult, extra: { inflationLocal: number }): Check[] {
  const out: Check[] = [];
  const add = (c: Check) => out.push(c);
  const code = r.currency.code;
  const u = amountUnit(r);
  const amt = (v: number) => fmtAmount(v, u);

  // 1. DCF against comparables, on the base cases used in the blend.
  {
    const dcfBase = r.dcfBlock.combined[1], compsBase = r.comparables.value[1];
    const gap = compsBase > 0 ? Math.abs(dcfBase / compsBase - 1) : NaN;
    const warn = !Number.isFinite(gap) || gap > R.methodDivergence;
    add({
      id: 'method_divergence',
      label: 'DCF against comparables',
      status: warn ? 'warning' : 'pass',
      message: !Number.isFinite(gap)
        ? 'The comparables value is not positive, so the two methods cannot be compared; the blend depends on the weight chosen.'
        : warn
          ? `DCF and comparables differ by ${fmtPct(gap, 0)}; the blend depends on the weight chosen.`
          : `DCF and comparables base values are within ${fmtPct(gap, 0)} of each other.`,
      values: { dcf: dcfBase, comps: compsBase, gap, threshold: R.methodDivergence },
    });
  }

  // 2. The two terminal values.
  {
    const implied = r.terminal.impliedMultiple, exit = r.exitMultipleApplied;
    const gap = Number.isFinite(implied) && exit > 0 ? Math.abs(implied / exit - 1) : NaN;
    const warn = !Number.isFinite(gap) || gap > R.terminalGap;
    add({
      id: 'terminal_gap',
      label: 'Terminal value methods',
      status: warn ? 'warning' : 'pass',
      message: !Number.isFinite(gap)
        ? 'Perpetuity and exit multiple terminal values cannot be compared, because final year EBITDA is not positive.'
        : warn
          ? `Perpetuity and exit multiple terminal values disagree: the implied terminal multiple is ${fmtMultiple(implied)} against an exit multiple of ${fmtMultiple(exit)} after discount.`
          : `The implied terminal multiple of ${fmtMultiple(implied)} is within ${fmtPct(R.terminalGap, 0)} of the ${fmtMultiple(exit)} exit multiple after discount.`,
      values: { implied, exit, gap, threshold: R.terminalGap },
    });
  }

  // 3. Terminal value share of the perpetuity DCF.
  {
    const share = r.terminal.tvShare;
    const warn = !Number.isFinite(share) || share > R.terminalValueShare;
    const strong = Number.isFinite(share) && share > R.terminalValueShareStrong;
    add({
      id: 'tv_share',
      label: 'Terminal value share',
      status: warn ? 'warning' : 'pass',
      strong,
      message: !Number.isFinite(share)
        ? 'The terminal value share cannot be measured on these figures.'
        : warn
          ? `Most of the value sits beyond the forecast period: the terminal value is ${fmtPct(share, 0)} of the perpetuity DCF${strong ? `, above ${fmtPct(R.terminalValueShareStrong, 0)}` : ''}.`
          : `The terminal value is ${fmtPct(share, 0)} of the perpetuity DCF, within ${fmtPct(R.terminalValueShare, 0)}.`,
      values: { share, threshold: R.terminalValueShare, strong: R.terminalValueShareStrong },
    });
  }

  // 4. Comparable companies.
  {
    const count = r.comparables.peerCount;
    const warn = count > 0 && count < R.minPeers;
    add({
      id: 'peer_count',
      label: 'Comparable companies',
      status: warn ? 'warning' : 'pass',
      message:
        count === 0
          ? 'No comparable companies were entered, so preset industry ranges are used.'
          : warn
            ? `Few comparable companies (${count}); preset ranges may be more reliable.`
            : `${count} comparable companies were entered.`,
      values: { count, minimum: R.minPeers },
    });
  }

  // 5. Capital structure: target D/E against net debt over base equity.
  {
    const target = r.wacc.de, equityBase = r.equity[1];
    const netDebt = r.bridge.netDebtAtValuationDate ?? r.netDebt;
    const actual = equityBase > 0 ? netDebt / equityBase : NaN;
    const gapPoints = Number.isFinite(actual) ? Math.abs(target - actual) * 100 : NaN;
    const warn = !Number.isFinite(gapPoints) || gapPoints > R.capitalStructurePoints;
    add({
      id: 'capital_structure',
      label: 'Capital structure',
      status: warn ? 'warning' : 'pass',
      message: !Number.isFinite(actual)
        ? 'Equity value is not positive, so the company’s own debt to equity cannot be measured; WACC uses an industry capital structure.'
        : warn
          ? `WACC uses an industry capital structure (debt to equity ${fmtPct(target, 0)}), not the company’s actual one (net debt to equity ${fmtPct(actual, 0)}${actual < 0 ? ', net cash' : ''}).`
          : `Target debt to equity of ${fmtPct(target, 0)} is within ${R.capitalStructurePoints} points of the company’s net debt to equity of ${fmtPct(actual, 0)}${actual < 0 ? ' (net cash)' : ''}.`,
      values: { target, actual, gapPoints, threshold: R.capitalStructurePoints },
    });
  }

  // 6. Year one margin step.
  {
    const from = r.ltmEbitda / r.ltmRevenue, to = r.rows[0].ebitda / r.rows[0].rev;
    const stepPoints = (to - from) * 100;
    const warn = Number.isFinite(stepPoints) && stepPoints > R.marginStepPoints;
    add({
      id: 'margin_step',
      label: 'Year one margin',
      status: warn ? 'warning' : 'pass',
      message: warn
        ? `Forecast margin steps up in year one, from ${fmtPct(from, 1)} to ${fmtPct(to, 1)}.`
        : `The first forecast year margin of ${fmtPct(to, 1)} is no more than ${R.marginStepPoints} points above the last actual ${fmtPct(from, 1)}.`,
      values: { from, to, stepPoints, threshold: R.marginStepPoints },
    });
  }

  // 7. Normalisation.
  add({
    id: 'no_normalisation',
    label: 'EBITDA normalisation',
    status: r.normalisation.used ? 'pass' : 'warning',
    message: r.normalisation.used
      ? `EBITDA was normalised from ${amt(r.ltmEbitdaReported)} to ${amt(r.ltmEbitda)} ${u.short}.`
      : 'Reported EBITDA used; review one-off and owner costs.',
    values: { reported: r.ltmEbitdaReported, normalised: r.ltmEbitda },
  });

  // 8. Negative EBITDA.
  add({
    id: 'negative_ebitda',
    label: 'Last actual EBITDA',
    status: r.ltmEbitda <= 0 ? 'warning' : 'pass',
    message: r.ltmEbitda <= 0 ? 'EV / Revenue used; value is highly uncertain.' : 'Last actual EBITDA is positive, so comparables use EV / EBITDA.',
    values: { ltmEbitda: r.ltmEbitda },
  });

  // 9. Long-term growth against the currency ceiling.
  {
    const ceiling = (COUNTRIES as Record<string, { growthCeiling?: number }>)[r.meta.country]?.growthCeiling;
    if (ceiling !== undefined) {
      const warn = r.growth * 100 > ceiling;
      add({
        id: 'growth_ceiling',
        label: 'Long-term growth ceiling',
        status: warn ? 'warning' : 'pass',
        message: warn
          ? `Growth of ${fmtPct(r.growth, 1)} for ever is above ${fmtPct(ceiling / 100, 1)}, roughly long-run inflation plus real growth in ${code}.`
          : `Growth of ${fmtPct(r.growth, 1)} is within the ${fmtPct(ceiling / 100, 1)} ceiling for ${code}.`,
        values: { growth: r.growth, ceiling: ceiling / 100 },
      });
    }
  }

  // 10. Long-term growth against expected inflation.
  {
    const inflationPct = r.currency.pegged ? MARKET.usInflationLongRun : extra.inflationLocal;
    if (Number.isFinite(inflationPct)) {
      const lowPct = inflationPct - R.inflationBelowPoints, highPct = inflationPct + R.inflationAbovePoints;
      const gPct = r.growth * 100;
      const below = gPct < lowPct - 1e-9, above = gPct > highPct + 1e-9;
      add({
        id: 'growth_vs_inflation',
        label: 'Growth against inflation',
        status: below || above ? 'warning' : 'pass',
        message: below
          ? `Growth of ${fmtPct(r.growth, 1)} is more than ${R.inflationBelowPoints} point below expected inflation of ${fmtPct(inflationPct / 100, 1)}, so the business shrinks in real terms.`
          : above
            ? `Growth of ${fmtPct(r.growth, 1)} is more than ${R.inflationAbovePoints} points above expected inflation of ${fmtPct(inflationPct / 100, 1)}.`
            : `Growth of ${fmtPct(r.growth, 1)} is consistent with expected inflation of ${fmtPct(inflationPct / 100, 1)} in ${code}.`,
        values: { growth: r.growth, inflation: inflationPct / 100, low: lowPct / 100, high: highPct / 100 },
      });
    }
  }

  // 11. The cash flow the perpetuity rests on.
  {
    const fcf = r.terminal.fcf;
    add({
      id: 'terminal_fcf',
      label: 'Terminal cash flow',
      status: fcf < 0 ? 'warning' : 'pass',
      message:
        fcf < 0
          ? `Terminal free cash flow is negative (${amt(fcf)} ${u.short}), so the perpetuity value is not meaningful.`
          : `Terminal free cash flow of ${amt(fcf)} ${u.short} reflects reinvestment at long-term growth.`,
      values: { fcf },
    });
  }

  // 12 and 13. Only with invested capital.
  if (Number.isFinite(r.ratios.roic)) {
    const q = r.ratios;
    const low = q.roic < r.wacc.wacc;
    add({
      id: 'roic_below_wacc',
      label: 'Returns against WACC',
      status: low ? 'warning' : 'pass',
      message: low
        ? `Return on invested capital of ${fmtPct(q.roic, 1)} is below the WACC of ${fmtPct(r.wacc.wacc)}.`
        : `Return on invested capital of ${fmtPct(q.roic, 1)} is above the WACC of ${fmtPct(r.wacc.wacc)}.`,
      values: { roic: q.roic, wacc: r.wacc.wacc },
    });
    if (Number.isFinite(q.impliedGrowthFromReinvestment)) {
      const gap = Math.abs(q.impliedGrowthFromReinvestment - r.growth) * 100;
      const warn = gap > R.reinvestmentGapPoints;
      add({
        id: 'reinvestment',
        label: 'Growth and reinvestment',
        status: warn ? 'warning' : 'pass',
        message: warn
          ? `Reinvestment and returns support growth of about ${fmtPct(q.impliedGrowthFromReinvestment, 1)}, not the ${fmtPct(r.growth, 1)} assumed.`
          : `Reinvestment and returns support growth close to the ${fmtPct(r.growth, 1)} assumed.`,
        values: { implied: q.impliedGrowthFromReinvestment, growth: r.growth, threshold: R.reinvestmentGapPoints },
      });
    }
  }

  // 14. Only when a control premium was chosen.
  if (r.stake.adjustment === 'control_premium') {
    const warn = r.stake.percent <= R.controlStakeAbovePercent;
    add({
      id: 'stake_premium',
      label: 'Control premium',
      status: warn ? 'warning' : 'pass',
      message: warn
        ? `A ${+r.stake.percent.toFixed(2)}% stake does not carry control, so a minority discount usually applies rather than a control premium.`
        : `A ${+r.stake.percent.toFixed(2)}% stake carries control, so a control premium can apply.`,
      values: { percent: r.stake.percent, threshold: R.controlStakeAbovePercent },
    });
  }

  return out;
}
