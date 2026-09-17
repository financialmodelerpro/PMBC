'use client';

/**
 * The Business Valuation tool: four input steps, a lead gate, then a results
 * dashboard.
 *
 * Layout: the step bar across the top; on large screens the step form on the
 * left and a sticky live summary on the right, collapsing to a compact bar
 * above the form below that. Results take the full width.
 *
 * Flow and validation follow `reference/tools/business-valuation.html`. The
 * arithmetic lives in `src/lib/tools/valuation/engine.ts`; nothing here computes
 * a value itself. Form transitions are the plain functions in `state.ts`, which
 * the verifiers drive directly.
 */

import { useEffect, useMemo, useRef, useState } from 'react';

import {
  currencyFor,
  dealBandOptions,
  financialYears,
  peersInUse,
  runValuation,
  validateCompany,
  validateFinancials,
  validateTerminal,
  waccFor,
  type FieldErrors,
  type ValuationInputs,
  type ValuationResult,
} from '@/lib/tools/valuation/engine';
import { headline } from '@/lib/tools/valuation/format';

import type { ToolComponentProps } from '../toolComponents';
import { CompanyStep } from './CompanyStep';
import { FinancialsStep } from './FinancialsStep';
import { EMPTY_GATE, LeadGate, validateGate, type GateErrors, type GateValues } from './LeadGate';
import { ResultsDashboard, TOOL_SLUG } from './ResultsDashboard';
import {
  applyCountryDefaults,
  applyFill,
  applyIndustryDefaults,
  exampleState,
  initialState,
  newPeer,
  num,
  onEnterWacc,
  onLeaveCompany,
  parseFinancials,
  parsePeers,
  parseWacc,
  resetWacc,
  str,
  syncPeerDefaults,
  syncStakeAdjustment,
  toInputs,
  type FormState,
} from './state';
import { StepBar, type StepState } from './StepBar';
import { captureAttribution, readAttribution, submitLead } from './submit';
import { SummaryPanel } from './SummaryPanel';
import { TerminalStep } from './TerminalStep';
import { WaccStep } from './WaccStep';

export { TOOL_SLUG };

type View = 0 | 1 | 2 | 3 | 'gate' | 'result';

const STEP_LABELS = ['Company', 'Financials', 'Cost of capital', 'Terminal and comps'];

export function BusinessValuationTool({ preview, partner }: ToolComponentProps) {
  const [s, setS] = useState<FormState>(initialState);
  const [view, setView] = useState<View>(0);
  const [current, setCurrent] = useState(0);
  const [maxReached, setMaxReached] = useState(0);

  const [companyErrors, setCompanyErrors] = useState<FieldErrors>({});
  const [finError, setFinError] = useState('');
  const [termError, setTermError] = useState('');

  const [gate, setGate] = useState<GateValues>(EMPTY_GATE);
  const [gateErrors, setGateErrors] = useState<GateErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const [pending, setPending] = useState<ValuationResult | null>(null);
  const [saved, setSaved] = useState<{ inputs: ValuationInputs; result: ValuationResult } | null>(null);
  const [lead, setLead] = useState<{ name: string; email: string; token: string | null } | null>(null);

  const topRef = useRef<HTMLDivElement>(null);
  const mountedAt = useRef(Date.now());

  useEffect(() => {
    captureAttribution();
  }, []);

  const currency = useMemo(() => currencyFor(s.country), [s.country]);
  const years = financialYears(parseInt(s.financialYear, 10) || null);
  // With the effective tax rate, so the WACC shown on step 3 is the one the valuation uses.
  const wacc = useMemo(() => waccFor(toInputs(s, null)), [s]);
  const dealBands = useMemo(() => dealBandOptions(currency), [currency]);

  const update = (fn: (prev: FormState) => FormState) => setS(fn);
  const patch = (p: Partial<FormState>) => setS((prev) => ({ ...prev, ...p }));

  function go(to: View) {
    setView(to);
    if (typeof to === 'number') {
      setCurrent(to);
      setMaxReached((m) => Math.max(m, to));
    }
    requestAnimationFrame(() => {
      const el = topRef.current;
      if (!el) return;
      if (el.getBoundingClientRect().top < 0) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  /** The reference's `validate(step)`, including its side effects on success. */
  function validateStep(step: number): boolean {
    if (step === 0) {
      const errors = validateCompany(toInputs(s));
      setCompanyErrors(errors);
      if (Object.keys(errors).length) return false;
      update(onLeaveCompany);
      return true;
    }
    if (step === 1) {
      const e = validateFinancials(parseFinancials(s.fin), toInputs(s));
      setFinError(e ?? '');
      return !e;
    }
    if (step === 2) return Number.isFinite(wacc.wacc);
    return true;
  }

  function next(to: number) {
    if (to > current && !validateStep(current)) return;
    if (to === 2) update(onEnterWacc);
    go(to as View);
  }

  function onRun() {
    const inputs = toInputs(s);
    const e = validateTerminal(inputs, waccFor(inputs, inputs.waccAdjustment ?? 0).wacc);
    if (e) {
      setTermError(e);
      return;
    }
    setTermError('');
    const outcome = runValuation(inputs);
    if (!outcome.ok) {
      // Earlier steps are validated on the way through, so this only happens
      // if an earlier field was cleared after passing. Send them back to it.
      go(outcome.step);
      return;
    }
    setPending(outcome.result);
    // The company named in step 1 fills the gate's company field, unless the
    // visitor has already typed one there.
    const named = s.companyName.trim();
    if (named) setGate((g) => (g.company.trim() ? g : { ...g, company: named }));
    go('gate');
  }

  async function onShow() {
    const errors = validateGate(gate);
    setGateErrors(errors);
    if (Object.keys(errors).length || !pending) return;
    setSubmitting(true);
    // What the valuation is for, and any amount to raise, travel with the inputs:
    // the report reads both from the result.
    const raise = gate.purpose === 'raise' ? num(gate.raiseAmount) : null;
    const inputs = { ...toInputs(s), purpose: gate.purpose, raiseAmount: raise };
    const local = runValuation(inputs);
    setLead({ name: gate.name.trim(), email: gate.email.trim(), token: null });
    try {
      const response = await submitLead({
        inputs,
        gate: {
          name: gate.name.trim(),
          email: gate.email.trim(),
          company: gate.company.trim(),
          purpose: gate.purpose,
          dealSize: gate.dealSize,
          consent: gate.consent,
          followUp: gate.followUp,
        },
        attribution: readAttribution(),
        website: gate.website,
        elapsedMs: Date.now() - mountedAt.current,
      });
      // The server's recomputation is what was saved and emailed, so it is what
      // the visitor sees. The browser's own run is the fallback, never the source.
      setSaved({ inputs, result: response?.result ?? (local.ok ? local.result : pending) });
      if (response?.token) setLead((l) => (l ? { ...l, token: response.token } : l));
    } finally {
      setSubmitting(false);
      setMaxReached(3);
      go('result');
    }
  }

  /* Step bar ------------------------------------------------------------- */
  const stepStates: StepState[] = STEP_LABELS.map((_, i) => {
    if (typeof view === 'number') {
      if (i === view) return 'current';
      return i <= maxReached ? 'done' : 'todo';
    }
    return i <= maxReached ? 'done' : 'todo';
  });

  /* Summary -------------------------------------------------------------- */
  // Unlocked once the visitor has passed the gate. The panel shows beside the
  // inputs, so this is what they see on returning to change something.
  const summaryResult = saved?.result ?? null;
  const summaryHeadline = summaryResult ? headline(summaryResult) : null;
  const summary = {
    companyName: s.companyName.trim(),
    industry: s.industry,
    country: s.country,
    currency,
    financialYear: s.financialYear,
    revenue: s.fin.rev.map((v) => num(v) ?? NaN),
    ebitda: s.fin.ebitda.map((v) => num(v) ?? NaN),
    wacc: s.wacc.rf ? wacc.wacc : null,
    range: summaryHeadline?.equityRange ?? null,
    midpoint: summaryHeadline?.midpoint ?? null,
  };

  const peerDefaultActive = peersInUse(parsePeers(s.peers));
  const showForm = view !== 'result';

  return (
    <div ref={topRef} className="mx-auto w-full max-w-[1200px] scroll-mt-28">
      <div className="mx-auto mb-8 max-w-[760px]">
        <StepBar labels={STEP_LABELS} states={stepStates} onGo={(i) => go(i as View)} />
      </div>

      {showForm ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-8">
          <div className="min-w-0 space-y-4">
            <div className="lg:hidden">
              <SummaryPanel data={summary} />
            </div>

            {view === 0 && (
              <CompanyStep
                key="step-0"
                state={s}
                currencyCode={currency.code}
                errors={companyErrors}
                onIndustry={(v) => update((prev) => applyIndustryDefaults({ ...prev, industry: v }))}
                onCountry={(v) => update((prev) => applyCountryDefaults({ ...prev, country: v }))}
                onChange={patch}
                onBridge={(k, v) => update((prev) => ({ ...prev, bridge: { ...prev.bridge, [k]: v } }))}
                onExample={() => {
                  update(exampleState);
                  setCompanyErrors({});
                  setFinError('');
                }}
                onNext={() => next(1)}
              />
            )}

            {view === 1 && (
              <FinancialsStep
                key="step-1"
                state={s}
                currencyCode={currency.code}
                years={years}
                error={finError}
                onCell={(k, i, v) => update((prev) => ({ ...prev, fin: { ...prev.fin, [k]: prev.fin[k].map((x, j) => (j === i ? v : x)) } }))}
                onFillValue={(k, v) => update((prev) => ({ ...prev, fill: { ...prev.fill, [k]: v } }))}
                onFill={() => {
                  const { fillError, ...filled } = applyFill(s);
                  setFinError(fillError ?? '');
                  if (!fillError) setS(filled);
                }}
                onNorm={(p) => update((prev) => ({ ...prev, norm: { ...prev.norm, ...p } }))}
                onChange={patch}
                onBack={() => next(0)}
                onNext={() => next(2)}
              />
            )}

            {view === 2 && (
              <WaccStep
                key="step-2"
                state={s}
                currency={currency}
                wacc={wacc}
                onWacc={(k, v) => update((prev) => ({ ...prev, wacc: { ...prev.wacc, [k]: v }, spTouched: prev.spTouched || k === 'sp' }))}
                onReset={() => update(resetWacc)}
                onBack={() => next(1)}
                onNext={() => next(3)}
              />
            )}

            {view === 3 && (
              <TerminalStep
                key="step-3"
                state={s}
                error={termError}
                peerDefaultActive={peerDefaultActive}
                onChange={patch}
                onExitMultiple={(v) => patch({ exitMultiple: v, xmTouched: true })}
                onDiscount={(v) => patch({ privateDiscount: v, discountTouched: true })}
                onPeer={(id, p) => update((prev) => syncPeerDefaults({ ...prev, peers: prev.peers.map((r) => (r.id === id ? { ...r, ...p } : r)) }))}
                onAddPeer={() => update((prev) => ({ ...prev, peers: [...prev.peers, newPeer()] }))}
                onRemovePeer={(id) => update((prev) => syncPeerDefaults({ ...prev, peers: prev.peers.filter((r) => r.id !== id) }))}
                onScenario={(k, v) => update((prev) => ({ ...prev, scenarios: { ...prev.scenarios, [k]: v } }))}
                onStake={(p) =>
                  update((prev) =>
                    syncStakeAdjustment({
                      ...prev,
                      stake: { ...prev.stake, ...p },
                      stakeAdjustmentTouched: prev.stakeAdjustmentTouched || 'adjustment' in p,
                    }),
                  )
                }
                onBack={() => next(2)}
                onRun={onRun}
              />
            )}

            {view === 'gate' && (
              <LeadGate
                values={gate}
                errors={gateErrors}
                dealBands={dealBands}
                currencyCode={currency.code}
                submitting={submitting}
                onChange={(p) => setGate((g) => ({ ...g, ...p }))}
                onBack={() => go(3)}
                onSubmit={onShow}
              />
            )}
          </div>

          <div className="hidden lg:block">
            <SummaryPanel data={summary} />
          </div>
        </div>
      ) : (
        saved &&
        lead && (
          <ResultsDashboard
            baseInputs={saved.inputs}
            baseResult={saved.result}
            lead={lead}
            preview={preview}
            partner={partner}
            onEdit={() => go(3)}
            onVersionSaved={(inputs, result) => {
              setSaved({ inputs, result });
              // Keep the form in step with the version just saved, so going back
              // to the inputs shows what was emailed.
              update((prev) => ({
                ...prev,
                growth: str(inputs.growth),
                exitMultiple: str(inputs.exitMultiple),
                xmTouched: true,
                waccAdjustment: str(inputs.waccAdjustment ?? 0),
              }));
            }}
          />
        )
      )}
    </div>
  );
}
