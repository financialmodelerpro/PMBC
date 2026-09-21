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
  validateWacc,
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
  stateFromInputs,
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
import { cleanPhone } from '@/lib/tools/contactCountries';
import { captureAttribution, fetchResume, readAttribution, readGatePrefill, saveResumedRun, storeGatePrefill, submitLead } from './submit';
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
  const [waccError, setWaccError] = useState('');
  const [termError, setTermError] = useState('');

  const [gate, setGate] = useState<GateValues>(EMPTY_GATE);
  const [gateErrors, setGateErrors] = useState<GateErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const [pending, setPending] = useState<ValuationResult | null>(null);
  const [saved, setSaved] = useState<{ inputs: ValuationInputs; result: ValuationResult } | null>(null);
  const [lead, setLead] = useState<{ name: string; email: string; token: string | null; booking: string | null } | null>(null);

  const topRef = useRef<HTMLDivElement>(null);
  const mountedAt = useRef(Date.now());

  // True once this run's lead is saved: the next run from the form is a new valuation, so the gate's
  // company (unless step 1 names one) and consent start again, while the person's details stay.
  const leadSaved = useRef(false);
  // Save and return (since 2026-09-21): a valuation opened from its emailed link. Running it again saves
  // a new version of that project rather than a new lead, so the name and email step is not asked.
  const [resumed, setResumed] = useState<{ project: string | null } | null>(null);
  const [resumeNotice, setResumeNotice] = useState<string | null>(null);

  useEffect(() => {
    captureAttribution();
    // The person's details from the last valuation in this tab prefill the gate. Nothing else is kept:
    // every run from the form is a new lead (since 2026-09-21).
    const prefill = readGatePrefill();
    if (prefill) setGate((g) => ({ ...g, ...prefill }));
    // A resume link: load the saved valuation, then drop the id from the address bar so it is not kept
    // in history or sent on as a referrer.
    const id = new URLSearchParams(window.location.search).get('resume');
    if (id) {
      const url = new URL(window.location.href);
      url.searchParams.delete('resume');
      window.history.replaceState(null, '', url.pathname + url.search + url.hash);
      void fetchResume(id).then((v) => {
        if (!v) {
          setResumeNotice('That link to a saved valuation is not recognised. You can start a new one below.');
          return;
        }
        setS(stateFromInputs(v.inputs as ValuationInputs));
        setLead(v.lead);
        const [code, ...rest] = (v.gate.phone || '').split(' ');
        setGate((g) => ({ ...g, ...v.gate, phoneCode: code?.startsWith('+') ? code : g.phoneCode, phone: code?.startsWith('+') ? rest.join(' ') : v.gate.phone, consent: true }));
        setResumed({ project: v.project });
        setMaxReached(3);
      });
    }
  }, []);

  const currency = useMemo(() => currencyFor(s.country), [s.country]);
  const years = financialYears(parseInt(s.financialYear, 10) || null);
  // With the effective tax rate and any adjustment carried back from an emailed version, so the WACC
  // shown on step 3 is the one the valuation uses.
  const wacc = useMemo(() => waccFor(toInputs(s, null), num(s.waccAdjustment) ?? 0), [s]);
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
    if (step === 2) {
      const e = validateWacc(toInputs(s).wacc, currency) ?? '';
      setWaccError(e);
      return !e && Number.isFinite(wacc.wacc);
    }
    return true;
  }

  function next(to: number) {
    if (to > current && !validateStep(current)) return;
    if (to === 2) update(onEnterWacc);
    go(to as View);
  }

  async function onRun() {
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
    // Every run from the form asks for the name and email again and saves a new lead (since 2026-09-21;
    // a re-run once updated the previous lead, which filed a second company under the first). The gate is
    // prefilled with the person's details; the company is step 1's, and consent is given again.
    const named = s.companyName.trim();
    // Read before the reset below: React runs the updater later, when the flag is already false.
    const fresh = leadSaved.current;
    setGate((g) => ({ ...g, company: named || (fresh ? '' : g.company), consent: fresh ? false : g.consent }));
    leadSaved.current = false;

    // A resumed valuation: a new version of the same project, not a new lead.
    if (resumed && lead?.token) {
      setSubmitting(true);
      const raise = gate.purpose === 'raise' ? num(gate.raiseAmount) : null;
      const runInputs = { ...inputs, purpose: gate.purpose, raiseAmount: raise };
      const local = runValuation(runInputs);
      try {
        const out = await saveResumedRun(lead.token, runInputs);
        setSaved({ inputs: runInputs, result: out?.result ?? (local.ok ? local.result : outcome.result) });
        setResumeNotice(
          out?.saved
            ? `Saved as a new version of ${resumed.project ?? 'your valuation'}. Use Email me this version to receive the figures and a new report.`
            : 'Updated with your changes, but they could not be saved just now. Use Email me this version to keep them.',
        );
        go('result');
      } finally {
        setSubmitting(false);
      }
      return;
    }
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
    // A new lead: the previous token goes first, so Email me this version and the PDF can only ever
    // reach the valuation now on screen, never an earlier one.
    setLead({ name: gate.name.trim(), email: gate.email.trim(), token: null, booking: null });
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
          contactCountry: gate.contactCountry,
          phone: cleanPhone(gate.phoneCode, gate.phone),
        },
        attribution: readAttribution(),
        website: gate.website,
        elapsedMs: Date.now() - mountedAt.current,
      });
      // The server's recomputation is what was saved and emailed, so it is what
      // the visitor sees. The browser's own run is the fallback, never the source.
      setSaved({ inputs, result: response?.result ?? (local.ok ? local.result : pending) });
      if (response?.token) setLead((l) => (l ? { ...l, token: response.token, booking: response.booking } : l));
      leadSaved.current = true;
      storeGatePrefill({ name: gate.name.trim(), email: gate.email.trim(), purpose: gate.purpose, dealSize: gate.dealSize, followUp: gate.followUp, raiseAmount: gate.raiseAmount, contactCountry: gate.contactCountry, phoneCode: gate.phoneCode, phone: gate.phone });
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
        {view !== 'result' && (resumed || resumeNotice) && (
          <p role="status" className="mb-4 border-l-2 border-[#C69C3E] bg-[#FDF8EC] px-3 py-2 text-[13.5px] text-[#6B4E12]">
            {resumed
              ? `You are editing your saved valuation${resumed.project ? ` of ${resumed.project}` : ''}. Running it again saves a new version of it.`
              : resumeNotice}
          </p>
        )}
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
                error={waccError}
                adjustment={num(s.waccAdjustment) ?? 0}
                onClearAdjustment={() => patch({ waccAdjustment: '0' })}
                onWacc={(k, v) => {
                  if (waccError) setWaccError('');
                  update((prev) => ({ ...prev, wacc: { ...prev.wacc, [k]: v }, spTouched: prev.spTouched || k === 'sp' }));
                }}
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
            initialNotice={resumed && resumeNotice ? { tone: 'ok', text: resumeNotice } : null}
            preview={preview}
            onNew={() => {
              // A new valuation: a clean form. The person's details stay for the gate; the next run is a new lead.
              setS(initialState());
              setSaved(null);
              setPending(null);
              setCompanyErrors({});
              setFinError('');
              setWaccError('');
              setTermError('');
              setMaxReached(0);
              leadSaved.current = true;
              setResumed(null);
              setResumeNotice(null);
              go(0);
            }}
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
