'use client';

/**
 * The Business Valuation tool: four input steps, a lead gate, then results.
 *
 * Flow and validation follow `reference/tools/business-valuation.html`. The
 * arithmetic lives in `src/lib/tools/valuation/engine.ts` and nothing here
 * computes a value itself.
 */

import { useMemo, useRef, useState } from 'react';

import {
  computeWacc,
  currencyFor,
  dealBandOptions,
  financialYears,
  peerStats,
  runValuation,
  validateCompany,
  validateFinancials,
  validateTerminal,
  type FieldErrors,
  type ValuationResult,
} from '@/lib/tools/valuation/engine';
import { bookingLink } from '@/lib/tools/booking';

import { CompanyStep } from './CompanyStep';
import { FinancialsStep } from './FinancialsStep';
import { WaccStep } from './WaccStep';
import { TerminalStep } from './TerminalStep';
import { EMPTY_GATE, LeadGate, validateGate, type GateErrors, type GateValues } from './LeadGate';
import { Results } from './Results';
import {
  applyCountryDefaults,
  applyFill,
  applyIndustryDefaults,
  exampleState,
  initialState,
  newPeer,
  onEnterWacc,
  onLeaveCompany,
  parseFinancials,
  parseWacc,
  resetWacc,
  syncExitMultiple,
  toInputs,
  type FormState,
} from './state';

type View = 0 | 1 | 2 | 3 | 'gate' | 'result';

const STEP_LABELS = ['Company', 'Financials', 'Cost of capital', 'Terminal and comps'];

export const TOOL_SLUG = 'business-valuation';

export function BusinessValuationTool({ bookingUrl }: { bookingUrl: string }) {
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
  const [result, setResult] = useState<ValuationResult | null>(null);
  const [lead, setLead] = useState<{ name: string; email: string } | null>(null);

  const stepsRef = useRef<HTMLElement>(null);

  const currency = useMemo(() => currencyFor(s.country), [s.country]);
  const years = financialYears(parseInt(s.financialYear, 10) || null);
  const wacc = useMemo(() => computeWacc(parseWacc(s.wacc), currency), [s.wacc, currency]);
  const dealBands = useMemo(() => dealBandOptions(currency), [currency]);

  const update = (fn: (prev: FormState) => FormState) => setS(fn);
  const patch = (p: Partial<FormState>) => setS((prev) => ({ ...prev, ...p }));

  function go(to: View) {
    setView(to);
    if (typeof to === 'number') {
      setCurrent(to);
      setMaxReached((m) => Math.max(m, to));
    }
    requestAnimationFrame(() => stepsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  /** The reference's `validate(step)`, including its side effects on success. */
  function validateStep(step: number): boolean {
    if (step === 0) {
      const errors = validateCompany(toInputs(s));
      setCompanyErrors({
        industry: errors.industry ?? '',
        country: errors.country ?? '',
        financialYear: errors.financialYear ?? '',
        netDebt: errors.netDebt ?? '',
      });
      if (Object.keys(errors).length) return false;
      // First time through, prefill the whole cost of capital.
      update(onLeaveCompany);
      return true;
    }
    if (step === 1) {
      const e = validateFinancials(parseFinancials(s.fin));
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

  function onExample() {
    update(exampleState);
    setCompanyErrors({});
    setFinError('');
  }

  function onFill() {
    const { fillError, ...next } = applyFill(s);
    setFinError(fillError ?? '');
    if (!fillError) setS(next);
  }

  function onRun() {
    const inputs = toInputs(s);
    const e = validateTerminal(inputs, wacc.wacc);
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
    go('gate');
  }

  async function onShow() {
    const errors = validateGate(gate);
    setGateErrors(errors);
    if (Object.keys(errors).length || !pending) return;
    setSubmitting(true);
    try {
      // Unit 2 posts the lead here and renders the server's recomputed result,
      // falling back to `pending` if the request fails.
      setLead({ name: gate.name.trim(), email: gate.email.trim() });
      setResult(pending);
      go('result');
    } finally {
      setSubmitting(false);
    }
  }

  const peerDefaultActive = peerStats(toInputs(s).peers.map((p) => p.evEbitda)) !== null;

  const bookingHref = bookingLink({
    bookingUrl,
    name: lead?.name,
    email: lead?.email,
    toolSlug: TOOL_SLUG,
    placement: 'results',
  });

  return (
    <div className="mx-auto w-full max-w-[1200px]">
      <nav
        ref={stepsRef}
        aria-label="Steps"
        className="mx-auto mb-6 grid max-w-[900px] scroll-mt-28 grid-cols-4 gap-2"
      >
        {STEP_LABELS.map((label, i) => {
          const isActive = view === i;
          const isDone = typeof view === 'number' ? i < maxReached && i !== view : i <= maxReached;
          const disabled = i > maxReached;
          return (
            <button
              key={label}
              type="button"
              disabled={disabled}
              aria-current={isActive ? 'step' : undefined}
              onClick={() => go(i as View)}
              className="border-t-[3px] pt-2.5 text-left text-[12px] text-[color:var(--pmbc-muted)] disabled:cursor-default sm:text-[14px]"
              style={{ borderTopColor: isActive ? '#C69C3E' : isDone ? '#1B3A5F' : '#E8E2D6' }}
            >
              Step {i + 1}
              <b className="block text-[13px] font-semibold text-[color:var(--pmbc-text)] sm:text-[15px]">{label}</b>
            </button>
          );
        })}
      </nav>

      {view === 0 && (
        <CompanyStep
          state={s}
          currencyCode={currency.code}
          errors={companyErrors}
          onIndustry={(v) => update((prev) => applyIndustryDefaults({ ...prev, industry: v }))}
          onCountry={(v) => update((prev) => applyCountryDefaults({ ...prev, country: v }))}
          onChange={patch}
          onExample={onExample}
          onNext={() => next(1)}
        />
      )}

      {view === 1 && (
        <FinancialsStep
          state={s}
          currencyCode={currency.code}
          years={years}
          error={finError}
          onCell={(k, i, v) =>
            update((prev) => ({ ...prev, fin: { ...prev.fin, [k]: prev.fin[k].map((x, j) => (j === i ? v : x)) } }))
          }
          onFillValue={(k, v) => update((prev) => ({ ...prev, fill: { ...prev.fill, [k]: v } }))}
          onFill={onFill}
          onBack={() => next(0)}
          onNext={() => next(2)}
        />
      )}

      {view === 2 && (
        <WaccStep
          state={s}
          currency={currency}
          wacc={wacc}
          onWacc={(k, v) =>
            update((prev) => ({ ...prev, wacc: { ...prev.wacc, [k]: v }, spTouched: prev.spTouched || k === 'sp' }))
          }
          onReset={() => update(resetWacc)}
          onBack={() => next(1)}
          onNext={() => next(3)}
        />
      )}

      {view === 3 && (
        <TerminalStep
          state={s}
          error={termError}
          peerDefaultActive={peerDefaultActive}
          onChange={patch}
          onExitMultiple={(v) => patch({ exitMultiple: v, xmTouched: true })}
          onPeer={(id, p) =>
            update((prev) => syncExitMultiple({ ...prev, peers: prev.peers.map((r) => (r.id === id ? { ...r, ...p } : r)) }))
          }
          onAddPeer={() => update((prev) => ({ ...prev, peers: [...prev.peers, newPeer()] }))}
          onRemovePeer={(id) => update((prev) => syncExitMultiple({ ...prev, peers: prev.peers.filter((r) => r.id !== id) }))}
          onBack={() => next(2)}
          onRun={onRun}
        />
      )}

      {view === 'gate' && (
        <LeadGate
          values={gate}
          errors={gateErrors}
          dealBands={dealBands}
          submitting={submitting}
          onChange={(p) => setGate((g) => ({ ...g, ...p }))}
          onBack={() => go(3)}
          onSubmit={onShow}
        />
      )}

      {view === 'result' && result && <Results result={result} bookingHref={bookingHref} onEdit={() => go(3)} />}
    </div>
  );
}
