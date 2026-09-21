'use client';

/**
 * The results dashboard: a headline range card, exploration sliders, clear
 * actions, and six tabs of detail.
 *
 * Everything shown is computed by the shared engine and worded by format.ts;
 * every chart comes from charts.ts, the same geometry the PDF report draws.
 *
 * EXPLORATION. The sliders move WACC, long-term growth and the exit multiple
 * and recompute on the spot in the browser. That is labelled as exploration
 * and changes nothing stored. "Email me this version" is what saves it: the
 * server recomputes those exact inputs, updates the lead, and emails the new
 * report. "Download PDF" renders the report for what is on screen without
 * saving anything.
 */

import { useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowUpRight, Download, Mail, RotateCcw } from 'lucide-react';

import {
  cashConversionChart,
  footballFieldChart,
  revenueMarginChart,
  sensitivityHeatmap,
  waterfallChart,
} from '@/lib/tools/valuation/charts';
import { runValuation, type ValuationInputs, type ValuationResult } from '@/lib/tools/valuation/engine';
import {
  INDICATIVE_NOTE,
  LABELS,
  PRE_MONEY_NOTE,
  amountUnit,
  bridgeTable,
  checkItems,
  comparablesRows,
  comparablesSource,
  dcfSummaryRows,
  disclosures,
  fcfTable,
  fmtAmount,
  fmtBig,
  fmtMultiple,
  fmtPct,
  fmtPoints,
  fmtWacc,
  headline,
  keyRatiosTable,
  normalisationRows,
  raiseTable,
  scenariosTable,
  sourceNotes,
  sensitivityTable,
  sensitivityTitle,
  stakeBasisNote,
  stakeLabel,
  taxNote,
  taxRows,
  terminalNote,
  terminalRows,
  timingRows,
  waccBuildRows,
  waccSteps,
  warningTexts,
  type Table,
} from '@/lib/tools/valuation/format';
import { descriptionParagraphs } from '@/lib/tools/valuation/profile';
import { reviveResult } from '@/lib/tools/valuation/serialize';
import type { PartnerCard as PartnerCardData } from '@/lib/tools/brand/partner';
import { bookingPageLink } from '@/lib/tools/booking';
import { bookingLinkPath } from '@/lib/tools/bookingLinks';

import { ChartSvg } from '../charts/ChartSvg';
import { PartnerCard } from '../PartnerCard';
import { DataTable, KeyValueList } from './tables';
import { TRACKING, buttonGhost, buttonGold, buttonPrimary } from './ui';
import { useCountUp } from './useCountUp';

const TABS = [
  { id: 'summary', label: 'Summary' },
  { id: 'dcf', label: 'DCF' },
  { id: 'comps', label: 'Comparables' },
  { id: 'scenarios', label: 'Scenarios' },
  { id: 'sensitivity', label: 'Sensitivity' },
  { id: 'assumptions', label: 'Assumptions' },
] as const;
type TabId = (typeof TABS)[number]['id'];

export const TOOL_SLUG = 'business-valuation';

function Card({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[2px] border border-[color:var(--pmbc-border-warm)] bg-white p-4 sm:p-6">
      <h3 className="font-serif text-[19px] font-semibold text-[color:var(--pmbc-text)]">{title}</h3>
      {sub && <p className="mt-1 mb-4 text-[13.5px] leading-[1.55] text-[#52606B]">{sub}</p>}
      {!sub && <div className="mb-3" />}
      {children}
    </section>
  );
}

function Tile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-[2px] border px-4 py-3 ${accent ? 'border-[#C69C3E] bg-[#FDF8EC]' : 'border-[color:var(--pmbc-border-warm)] bg-white'}`}>
      <p className="text-[12.5px] text-[color:var(--pmbc-muted)]">{label}</p>
      <p className="mt-0.5 text-[19px] font-semibold text-[color:var(--pmbc-text)] tabular-nums">{value}</p>
    </div>
  );
}

function Slider({
  id, label, value, min, max, step, display, onChange,
}: {
  id: string; label: string; value: number; min: number; max: number; step: number; display: string; onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-[13.5px] font-medium text-[color:var(--pmbc-text)]">
          {label}
        </label>
        <output htmlFor={id} className="text-[14px] font-semibold text-[#14304F] tabular-nums">
          {display}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        aria-valuetext={display}
        className="pmbc-range"
      />
      <div className="mt-1 flex justify-between text-[11px] text-[color:var(--pmbc-muted)] tabular-nums">
        <span>{min.toFixed(step < 1 ? (step < 0.1 ? 2 : 1) : 0)}</span>
        <span>{max.toFixed(step < 1 ? (step < 0.1 ? 2 : 1) : 0)}</span>
      </div>
    </div>
  );
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function ResultsDashboard({
  baseInputs,
  baseResult,
  lead,
  preview,
  partner = null,
  onEdit,
  onVersionSaved,
  initialNotice = null,
}: {
  baseInputs: ValuationInputs;
  baseResult: ValuationResult;
  lead: { name: string; email: string; token: string | null; booking?: string | null };
  preview: boolean;
  partner?: PartnerCardData | null;
  onEdit: () => void;
  onVersionSaved: (inputs: ValuationInputs, result: ValuationResult) => void;
  /** Shown when the results open, for example after a re-run that was saved but not emailed. */
  initialNotice?: { tone: 'ok' | 'error'; text: string } | null;
}) {
  const [tab, setTab] = useState<TabId>('summary');
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  /* Exploration ---------------------------------------------------------- */
  const baseAdj = baseInputs.waccAdjustment ?? 0;
  const baseGrowth = baseInputs.growth ?? 0;
  const baseXm = baseInputs.exitMultiple ?? 0;
  const [adj, setAdj] = useState(baseAdj);
  const [growth, setGrowth] = useState(baseGrowth);
  const [xm, setXm] = useState(baseXm);
  const explored = adj !== baseAdj || growth !== baseGrowth || xm !== baseXm;

  // The visitor's own description from step 1, shown on the Summary tab as it is on the report cover.
  const about = useMemo(() => descriptionParagraphs(baseInputs.profile?.description), [baseInputs]);
  const exploredInputs = useMemo<ValuationInputs>(
    () => ({ ...baseInputs, waccAdjustment: adj, growth: +growth.toFixed(2), exitMultiple: +xm.toFixed(2) }),
    [baseInputs, adj, growth, xm],
  );
  const lastGood = useRef(baseResult);
  const exploration = useMemo(() => {
    if (!explored) return { result: baseResult, error: null as string | null };
    const out = runValuation(exploredInputs);
    if (out.ok) return { result: out.result, error: null };
    return { result: lastGood.current, error: typeof out.errors === 'string' ? out.errors : 'These settings cannot be valued.' };
  }, [explored, exploredInputs, baseResult]);
  if (!exploration.error) lastGood.current = exploration.result;
  const r = exploration.result;

  const reset = () => {
    setAdj(baseAdj);
    setGrowth(baseGrowth);
    setXm(baseXm);
  };

  /* Actions --------------------------------------------------------------- */
  const [busy, setBusy] = useState<'pdf' | 'email' | null>(null);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(initialNotice);
  const canSave = Boolean(lead.token);

  async function onDownload() {
    if (!lead.token) return;
    setBusy('pdf');
    setNotice(null);
    try {
      const res = await fetch(`/api/tools/${TOOL_SLUG}/pdf`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: lead.token, inputs: exploredInputs }),
      });
      if (!res.ok) throw new Error(`The report could not be prepared (${res.status}).`);
      download(await res.blob(), 'PaceMakers valuation report.pdf');
      setNotice({ tone: 'ok', text: 'Your report has downloaded.' });
    } catch (err) {
      setNotice({ tone: 'error', text: err instanceof Error ? err.message : 'The report could not be prepared.' });
    } finally {
      setBusy(null);
    }
  }

  async function onEmail() {
    if (!lead.token) return;
    setBusy('email');
    setNotice(null);
    try {
      const res = await fetch(`/api/tools/${TOOL_SLUG}/lead/version`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: lead.token, inputs: exploredInputs }),
      });
      const data = (await res.json().catch(() => ({}))) as { result?: unknown; error?: string };
      if (!res.ok) throw new Error(data.error || `This version could not be sent (${res.status}).`);
      const saved = data.result ? reviveResult(data.result) : r;
      onVersionSaved(exploredInputs, saved);
      setNotice({ tone: 'ok', text: `This version is on its way to ${lead.email}, with a new report.` });
    } catch (err) {
      setNotice({ tone: 'error', text: err instanceof Error ? err.message : 'This version could not be sent.' });
    } finally {
      setBusy(null);
    }
  }

  // The short link opens the booking page only; it is not the lead's access token.
  const bookingHref = lead.booking
    ? bookingLinkPath(lead.booking, 'results')
    : lead.token
      ? `/api/tools/book?t=${encodeURIComponent(lead.token)}&src=results`
      : bookingPageLink({ name: lead.name, email: lead.email, toolSlug: TOOL_SLUG, placement: 'results' });

  /* Headline --------------------------------------------------------------- */
  const h = headline(r);
  const c = r.currency;
  const low = useCountUp(r.equityDisplay[0]);
  const high = useCountUp(r.equityDisplay[2]);
  const u = amountUnit(r);
  const unit = u.label;
  const warnings = warningTexts(r);
  const checks = checkItems(r);
  const notes = disclosures(r);
  const raise = raiseTable(r);

  const onTabKey = (e: React.KeyboardEvent, i: number) => {
    const move = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : e.key === 'Home' ? -i : e.key === 'End' ? TABS.length - 1 - i : 0;
    if (!move) return;
    e.preventDefault();
    const next = TABS[(i + move + TABS.length) % TABS.length];
    setTab(next.id);
    tabRefs.current[next.id]?.focus();
  };

  const cp = r.comparables;
  const multiples = (v: number[]) => v.map(fmtMultiple).join(', ');
  const compsTable: Table = {
    head: ['Method', 'Multiples after discount', 'Low', LABELS.baseCase, 'High'],
    rows: [
      {
        label: 'EV / EBITDA',
        values: [multiples(cp.ebitdaMultiplesPost), ...(r.compsEbitda ? r.compsEbitda.map((v) => fmtAmount(v, u)) : ['n/a', 'n/a', 'n/a'])],
      },
      {
        label: r.compsEbitda ? 'EV / Revenue (for reference)' : 'EV / Revenue',
        values: [multiples(cp.revenueMultiplesPost), ...r.compsRevenue.map((v) => fmtAmount(v, u))],
      },
      { label: 'Comparables value used', values: [r.compsEbitda ? 'EV / EBITDA' : 'EV / Revenue', ...r.compRange.map((v) => fmtAmount(v, u))], tone: 'strong' },
    ],
  };

  return (
    <div className="pmbc-enter space-y-5">
      {/* Headline -------------------------------------------------------- */}
      <section aria-labelledby="valuation-headline" className="relative overflow-hidden rounded-[2px] bg-[#14304F] p-5 text-white sm:p-8">
        <span aria-hidden className="absolute top-0 left-0 h-[3px] w-24 bg-[#C69C3E]" />
        {/* The actions sit on their own row, and the status line below them is
            always mounted with its height reserved. Beside the headline, the
            buttons wrapped or not as the figures changed width, and a status
            line mounted on arrival pushed the page down: both were layout
            shifts after the visitor's click had finished. */}
        <div>
          <div className="min-w-0">
            {baseInputs.profile?.companyName && (
              <p className="pmbc-display mb-2 text-[20px] leading-tight text-white sm:text-[24px]">{baseInputs.profile.companyName}</p>
            )}
            <p id="valuation-headline" className="text-[11px] font-semibold uppercase text-[#C69C3E]" style={{ letterSpacing: '0.16em' }}>
              Indicative equity value, blended{explored ? ', exploration' : ''}
            </p>
            <p className="pmbc-display mt-2 text-[30px] leading-[1.1] sm:text-[44px] tabular-nums" aria-hidden>
              {fmtBig(low, c)} to {fmtBig(high, c)}
            </p>
            <p className="sr-only" aria-live="polite">
              Indicative equity value {h.equityRange}, base case {h.midpoint}.
            </p>
            <p className="mt-2 text-[15px] text-[#E8DDC4]">
              Base case <strong className="text-white">{h.midpoint}</strong>, equity value {h.asAt}. Enterprise value {h.evRange}.
            </p>
            {h.floorNote && <p className="mt-3 max-w-[70ch] border-l-2 border-[#C69C3E] pl-3 text-[13.5px] text-[#E8DDC4]">{h.floorNote}</p>}
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" onClick={onDownload} disabled={!canSave || busy !== null} className={buttonGold} style={TRACKING}>
              <Download aria-hidden size={14} />
              {busy === 'pdf' ? 'Preparing' : 'Download PDF'}
            </button>
            <button
              type="button"
              onClick={onEmail}
              disabled={!canSave || busy !== null}
              className="inline-flex items-center justify-center gap-2 border border-[#E8DDC4]/40 px-5 py-3 text-[12px] font-semibold uppercase text-white transition-colors hover:border-[#C69C3E] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#C69C3E]/50 disabled:cursor-not-allowed disabled:opacity-50"
              style={TRACKING}
            >
              <Mail aria-hidden size={14} />
              {busy === 'email' ? 'Sending' : 'Email me this version'}
            </button>
          </div>
        </div>
        <p role="status" className={`mt-3 min-h-[3em] text-[13.5px] leading-[1.5] ${notice?.tone === 'error' ? 'text-[#F3B5A8]' : 'text-[#E8DDC4]'}`}>
          {notice ? notice.text : !canSave ? 'Download and email are available once your details have been saved. Your results below are complete.' : ''}
        </p>
      </section>

      {/* Tiles ----------------------------------------------------------- */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label={LABELS.wacc} value={h.wacc} />
        <Tile label={`${LABELS.tvShare}, perpetuity DCF`} value={h.tvShare} />
        <Tile label={LABELS.impliedTerminalMultiple} value={h.impliedExitMultiple} />
        <Tile label={LABELS.ltmMultiple} value={h.ltmMultiple} />
        {h.weighted && <Tile label={LABELS.weighted} value={h.weighted} accent />}
        {h.stakeRange && <Tile label={`Value of ${stakeLabel(r)}`} value={h.stakeRange} accent />}
      </div>

      {/* Exploration ----------------------------------------------------- */}
      <section aria-labelledby="explore-title" className="rounded-[2px] border border-dashed border-[#C69C3E] bg-[#FFFDF8] p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase text-[#A88530]" style={{ letterSpacing: '0.16em' }}>
              Exploration
            </p>
            <h3 id="explore-title" className="font-serif text-[19px] font-semibold text-[color:var(--pmbc-text)]">
              What if the key assumptions moved?
            </h3>
            <p className="mt-1 max-w-[62ch] text-[13.5px] text-[#52606B]">
              Every figure on this page updates as you move a slider. Nothing is saved until you email this version.
            </p>
          </div>
          <button type="button" onClick={reset} disabled={!explored} className={buttonGhost} style={TRACKING}>
            <RotateCcw aria-hidden size={14} />
            Reset to base
          </button>
        </div>
        <div className="mt-5 grid gap-6 md:grid-cols-3">
          <Slider id="explore-wacc" label="WACC adjustment" value={adj} min={-3} max={3} step={0.25} display={`${fmtPoints(adj)}, WACC ${fmtWacc(r.wacc.wacc)}`} onChange={setAdj} />
          <Slider id="explore-growth" label="Long-term growth" value={growth} min={+(baseGrowth - 2).toFixed(1)} max={+(baseGrowth + 2).toFixed(1)} step={0.1} display={`${growth.toFixed(1)}%`} onChange={setGrowth} />
          <Slider id="explore-exit" label="Exit EV / EBITDA multiple" value={xm} min={Math.max(0.5, +(baseXm * 0.5).toFixed(1))} max={+(baseXm * 1.5).toFixed(1)} step={0.1} display={`${xm.toFixed(1)}x`} onChange={setXm} />
        </div>
        {exploration.error && (
          <p role="alert" className="mt-4 text-[13.5px] text-[#B3412F]">
            {exploration.error} The figures shown are the last valid ones.
          </p>
        )}
      </section>

      {/* Tabs ------------------------------------------------------------ */}
      <div>
        <div role="tablist" aria-label="Result details" className="pmbc-scroll-thin relative flex overflow-x-auto border-b border-[color:var(--pmbc-border-warm)]">
          {TABS.map((t, i) => (
            <button
              key={t.id}
              ref={(el) => {
                tabRefs.current[t.id] = el;
              }}
              id={`tab-${t.id}`}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              aria-controls={`panel-${t.id}`}
              tabIndex={tab === t.id ? 0 : -1}
              onClick={() => setTab(t.id)}
              onKeyDown={(e) => onTabKey(e, i)}
              className={`-mb-px shrink-0 border-b-2 px-4 py-3 text-[14px] font-semibold whitespace-nowrap focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-[#C69C3E]/50 ${
                tab === t.id ? 'border-[#C69C3E] text-[#14304F]' : 'border-transparent text-[color:var(--pmbc-muted)] hover:text-[#14304F]'
              }`}
            >
              {t.label}
              {t.id === 'summary' && warnings.length > 0 && (
                <>
                  <span aria-hidden className="ml-1.5 rounded-full bg-[#B3412F] px-1.5 text-[11px] text-white">{warnings.length}</span>
                  <span className="sr-only">, {warnings.length === 1 ? '1 warning' : `${warnings.length} warnings`}</span>
                </>
              )}
            </button>
          ))}
        </div>

        <div id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`} tabIndex={0} key={tab} className="pmbc-enter mt-5 space-y-5 focus-visible:outline-none">
          {tab === 'summary' && (
            <>
              {about.length > 0 && (
                <Card title="About the business" sub={`As you described it${baseInputs.profile?.companyName ? `, for ${baseInputs.profile.companyName}` : ''}. It is printed on the cover of your report and does not change any figure.`}>
                  <div className="border-l-[3px] border-[#2E8B3A] pl-4">
                    {about.map((para, i) => (
                      <p key={i} className={`text-[15px] leading-[1.65] text-[color:var(--pmbc-text)] ${i ? 'mt-3' : ''}`}>
                        {para}
                      </p>
                    ))}
                  </div>
                </Card>
              )}
              <Card
                title="Checks"
                sub={warnings.length ? `${warnings.length} of ${checks.length} checks raise a warning. Every check runs on every valuation.` : `All ${checks.length} checks passed.`}
              >
                <ul className="divide-y divide-[color:var(--pmbc-border-warm)]">
                  {[...checks].sort((a, b) => (a.status === b.status ? 0 : a.status === 'warning' ? -1 : 1)).map((x) => (
                    <li key={x.id} className="flex gap-3 py-2.5">
                      {x.status === 'warning' ? (
                        <AlertTriangle aria-hidden size={16} className="mt-0.5 shrink-0 text-[#B3412F]" />
                      ) : (
                        <span aria-hidden className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#3FA663]" />
                      )}
                      <span>
                        <strong className="block text-[14px] text-[color:var(--pmbc-text)]">
                          {x.label}
                          <span className={`ml-2 text-[11px] font-semibold uppercase ${x.status === 'warning' ? 'text-[#B3412F]' : 'text-[#2F7D4A]'}`}>{x.status === 'warning' ? 'Warning' : 'Pass'}</span>
                        </strong>
                        <span className="text-[13.5px] leading-[1.55] text-[#52606B]">{x.message}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
              <Card title="Value by method" sub={`Enterprise value, ${unit}. Each bar runs from low to high; the marker is the base case.`}>
                <ChartSvg chart={footballFieldChart(r)} />
                {notes.evRevenue && <p className="mt-3 text-[13px] text-[color:var(--pmbc-muted)]">{notes.evRevenue}</p>}
              </Card>
              <Card title="From enterprise value to equity" sub={`Base case, ${unit}. ${h.netDebtNote ?? ''}`}>
                <ChartSvg chart={waterfallChart(r)} />
                <div className="mt-4">
                  <DataTable table={bridgeTable(r)} caption="Enterprise to equity value bridge" />
                </div>
                <p className="mt-3 text-[13px] leading-[1.6] text-[color:var(--pmbc-muted)]">{INDICATIVE_NOTE}</p>
              </Card>
              {r.meta?.purpose === 'raise' && (
                <Card title="Pre-money and post-money">
                  {raise ? <DataTable table={raise} caption="Pre-money and post-money equity value" /> : <p className="text-[14px] text-[#52606B]">{PRE_MONEY_NOTE}</p>}
                </Card>
              )}
            </>
          )}

          {tab === 'dcf' && (
            <>
              <Card title="Free cash flow to firm" sub={`Base case, ${unit}. Equity value ${h.asAt}.`}>
                <DataTable table={fcfTable(r)} caption="Free cash flow and discounted cash flow" />
                <p className="mt-3 text-[13px] leading-[1.6] text-[color:var(--pmbc-muted)]">
                  {terminalNote(r)} {taxNote(r)}
                </p>
                <div className="mt-4 max-w-[560px]">
                  <KeyValueList rows={dcfSummaryRows(r)} />
                </div>
                <p className="mt-3 text-[13px] leading-[1.6] text-[color:var(--pmbc-muted)]">{notes.exitMultiple}</p>
              </Card>
              <div className="grid gap-5 xl:grid-cols-2">
                <Card title="Revenue and EBITDA margin" sub={`Actual and forecast, ${unit}.`}>
                  <ChartSvg chart={revenueMarginChart(r)} />
                </Card>
                <Card title="Cash conversion" sub="Navy is EBITDA, green is free cash flow (red when negative). The percentage above each year is free cash flow over EBITDA.">
                  <ChartSvg chart={cashConversionChart(r)} />
                </Card>
              </div>
              <Card title="Key ratios">
                <DataTable table={keyRatiosTable(r)} caption="Key ratios" />
              </Card>
            </>
          )}

          {tab === 'comps' && (
            <>
              <Card title="Comparables" sub={`${comparablesSource(r, r.compsEbitda ? 'ebitda' : 'revenue')}. Enterprise value from multiples of the last actual year, ${unit}, after a ${fmtPct(r.privateDiscount, 0)} private company discount.`}>
                <DataTable table={compsTable} caption="Comparables valuation" />
                <div className="mt-4 max-w-[640px]">
                  <KeyValueList rows={comparablesRows(r)} />
                </div>
              </Card>
              <div className="grid gap-5 md:grid-cols-2">
                <Card title="EBITDA used" sub={r.normalisation?.used ? u.label : undefined}>
                  {r.normalisation?.used ? (
                    <KeyValueList rows={normalisationRows(r)} />
                  ) : (
                    <p className="text-[14px] text-[#52606B]">Reported EBITDA of {fmtAmount(r.ltmEbitda, u)} {u.short}, with no normalisation adjustments.</p>
                  )}
                </Card>
                <Card title="Exit multiple">
                  <KeyValueList
                    rows={[
                      [LABELS.exitMultipleEntered, fmtMultiple(r.exitMultiple)],
                      [LABELS.privateDiscount, fmtPct(r.privateDiscount, 0)],
                      [LABELS.exitMultipleApplied, fmtMultiple(r.exitMultipleApplied)],
                      [LABELS.impliedTerminalMultiple, h.impliedExitMultiple],
                    ]}
                  />
                </Card>
              </div>
            </>
          )}

          {tab === 'scenarios' && (
            <>
              <Card title="Scenarios" sub="Each scenario moves forecast revenue growth and EBITDA margin in every year and is valued with the same method.">
                <DataTable table={scenariosTable(r)} caption="Scenario values" />
                {h.weighted && (
                  <p className="mt-3 text-[14px] text-[color:var(--pmbc-text)]">
                    Probability-weighted equity value: <strong>{h.weighted}</strong>. The headline range stays your base case.
                  </p>
                )}
                <p className="mt-2 text-[13px] text-[color:var(--pmbc-muted)]">{notes.scenarios}</p>
              </Card>
              <Card title="Stake value">
                {r.stake?.used ? (
                  <KeyValueList
                    rows={[
                      ['Stake', stakeLabel(r)],
                      ['Equity value, 100%', h.table.equityRange],
                      ['Indicative value of the stake', h.table.stakeRange ?? ''],
                    ]}
                  />
                ) : null}
                {r.stake?.used && stakeBasisNote(r) && <p className="mt-3 text-[13px] text-[#52606B]">{stakeBasisNote(r)}</p>}
                {r.stake?.used ? null : (
                  <p className="text-[14px] text-[#52606B]">
                    Valued at 100% of the equity with no premium or discount. Change the inputs to value a stake.
                  </p>
                )}
              </Card>
            </>
          )}

          {tab === 'sensitivity' && (
            <Card title={sensitivityTitle(r)} sub="Rows are WACC, columns long-term growth. The outlined centre cell is the base case, at the unrounded WACC.">
              <ChartSvg chart={sensitivityHeatmap(r)} />
              <details className="mt-4">
                <summary className="cursor-pointer text-[13.5px] font-medium text-[#14304F]">Show as a table</summary>
                <div className="mt-3">
                  <DataTable table={sensitivityTable(r)} axis caption="Sensitivity of equity value to WACC and growth" />
                </div>
              </details>
            </Card>
          )}

          {tab === 'assumptions' && (
            <>
              <Card
                title="How the WACC is calculated"
                sub={
                  r.currency.pegged
                    ? 'Cost of equity and cost of debt, weighted by the target capital structure.'
                    : `The Damodaran inputs are US dollar rates, so the build runs in US dollars and the last line converts it to ${r.currency.code}.`
                }
              >
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] border-collapse text-[14px]">
                    <thead>
                      <tr className="bg-[#F6F1E6] text-left text-[12.5px] text-[color:var(--pmbc-muted)]">
                        <th scope="col" className="p-2 font-semibold">Step</th>
                        <th scope="col" className="p-2 font-semibold">Working</th>
                        <th scope="col" className="p-2 text-right font-semibold">Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      {waccSteps(r.wacc, r.currency).map((x) => (
                        <tr key={x.key} className="border-t border-[color:var(--pmbc-border-warm)] align-top">
                          <th scope="row" className={`p-2 text-left ${x.strong ? 'font-semibold' : 'font-normal'}`}>
                            {x.label}
                            <span className="block text-[12.5px] font-normal text-[color:var(--pmbc-muted)]">{x.formula}</span>
                          </th>
                          <td className="p-2 tabular-nums text-[color:var(--pmbc-muted)]">{x.working}</td>
                          <td className={`p-2 text-right tabular-nums ${x.strong ? 'font-semibold' : ''}`}>{x.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
              <div className="grid gap-5 lg:grid-cols-2">
                <Card title="Cost of capital" sub="The inputs. The calculation from them is below.">
                  <KeyValueList rows={waccBuildRows(r)} />
                </Card>
                <Card title="Terminal value">
                  <KeyValueList rows={terminalRows(r)} />
                </Card>
                <Card title={r.tax?.zakatApplies ? 'Tax and zakat' : 'Tax'}>
                  <KeyValueList rows={taxRows(r)} />
                  {notes.zakat && <p className="mt-3 text-[13px] leading-[1.6] text-[color:var(--pmbc-muted)]">{notes.zakat}</p>}
                  {notes.premiumAndDiscount && <p className="mt-3 text-[13px] text-[color:var(--pmbc-muted)]">{notes.premiumAndDiscount}</p>}
                </Card>
                <Card title="Valuation date and net debt">
                  <KeyValueList rows={timingRows(r)} />
                  <ul className="mt-3 space-y-1 text-[13px] leading-[1.6] text-[color:var(--pmbc-muted)]">
                    <li>{notes.financialYearEnd}</li>
                    {notes.valuationDate && <li>{notes.valuationDate}</li>}
                  </ul>
                </Card>
              </div>
              <Card title="Sources">
                <ul className="space-y-2">
                  {sourceNotes(r, baseInputs.country).map((n) => (
                    <li key={n.label} className="text-[13.5px]">
                      <strong className="text-[color:var(--pmbc-text)]">{n.label}.</strong>{' '}
                      <span className="text-[#52606B]">
                        {n.source}{/ as at$/.test(n.source) ? ' ' : ', '}{n.asOf}.
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            </>
          )}
        </div>
      </div>

      <PartnerCard partner={partner} />

      {/* Closing actions --------------------------------------------------- */}
      <section className="flex flex-col items-start justify-between gap-6 rounded-[2px] bg-[#1B3A5F] p-6 sm:p-8 md:flex-row md:items-center">
        <div>
          <h3 className="pmbc-display text-[22px] text-white">Get a valuation you can defend</h3>
          <p className="mt-1 max-w-[52ch] text-[15px] leading-[1.6] text-[#E8DDC4]">
            Book a free 30 minute call to review your model, assumptions and what an independent valuation would cover.
          </p>
        </div>
        <a href={bookingHref} className={buttonGold} style={TRACKING}>
          Book a free call
          <ArrowUpRight aria-hidden size={14} />
        </a>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={onEdit} className={buttonGhost} style={TRACKING}>
          Back to inputs
        </button>
        {preview && <p className="text-[13px] text-[#92400E]">Admin preview: anything saved here is a test lead.</p>}
        <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className={buttonPrimary} style={TRACKING}>
          Back to top
        </button>
      </div>
    </div>
  );
}
