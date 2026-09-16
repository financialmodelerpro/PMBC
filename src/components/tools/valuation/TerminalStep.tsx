'use client';

import { X } from 'lucide-react';

import { ASSUMPTIONS, WARNING_RULES } from '@/lib/tools/valuation/data';
import { industryFor, type StakeAdjustment } from '@/lib/tools/valuation/engine';

import { num, type FormState, type PeerRow, type ScenarioKey } from './state';
import {
  Collapsible,
  ErrorText,
  Field,
  Group,
  Hint,
  NumberInput,
  Panel,
  PanelTitle,
  Select,
  StepNav,
  TRACKING,
  buttonSmall,
  inputClass,
} from './ui';

const STAKE_OPTIONS: { value: StakeAdjustment; label: string; hint: string }[] = [
  { value: 'none', label: 'No adjustment', hint: 'Pro rata share of equity value.' },
  { value: 'control_premium', label: 'Control premium', hint: 'For a stake that brings control. Often 20% to 35%.' },
  { value: 'minority_discount', label: 'Minority discount', hint: 'For a stake without control. Often 15% to 30%.' },
];

export function TerminalStep({
  state,
  error,
  peerDefaultActive,
  onChange,
  onExitMultiple,
  onDiscount,
  onPeer,
  onAddPeer,
  onRemovePeer,
  onScenario,
  onStake,
  onBack,
  onRun,
}: {
  state: FormState;
  error: string;
  /** True when the visitor's own peers are replacing the preset multiples. */
  peerDefaultActive: boolean;
  onChange: (patch: Partial<FormState>) => void;
  onExitMultiple: (v: string) => void;
  onDiscount: (v: string) => void;
  onPeer: (id: number, patch: Partial<PeerRow>) => void;
  onAddPeer: () => void;
  onRemovePeer: (id: number) => void;
  onScenario: (k: ScenarioKey, v: string) => void;
  onStake: (patch: Partial<FormState['stake']>) => void;
  onBack: () => void;
  onRun: () => void;
}) {
  const preset = industryFor(state.industry);
  const sc = state.scenarios;
  const weightTotal = [sc.weightDownside, sc.weightBase, sc.weightUpside].reduce((a, v) => a + (num(v) ?? 0), 0);
  const weightsOk = Math.abs(weightTotal - 100) < 1e-9;
  const scenariosChanged =
    sc.upsideGrowth !== '3' || sc.upsideMargin !== '2' || sc.downsideGrowth !== '-3' || sc.downsideMargin !== '-2' ||
    sc.weightDownside !== '25' || sc.weightBase !== '50' || sc.weightUpside !== '25';
  const stakeUsed = state.stake.percent.trim() !== '100' || state.stake.adjustment !== 'none';

  return (
    <Panel eyebrow="Step 4 of 4">
      <PanelTitle
        title="Terminal value and comparables"
        lead="Set how value beyond the forecast is captured, then choose the multiples for the comparables method."
      />

      <Group title="Terminal value" first>
        <div className="grid gap-x-5 sm:grid-cols-3">
          <Field label="Long-term growth rate" hint="Perpetuity growth after year 5. Usually close to long-run inflation.">
            {({ id, describedBy }) => <NumberInput id={id} step={0.1} suffix="%" value={state.growth} onValue={(v) => onChange({ growth: v })} aria-describedby={describedBy} />}
          </Field>
          <Field
            label="Exit EV / EBITDA multiple"
            hint={
              state.xmTouched
                ? 'Your own figure. Change the industry to restore the default.'
                : peerDefaultActive
                  ? 'Defaults to the median of your peers. The private company discount below also applies to it.'
                  : 'Defaults to the comparables median. The private company discount below also applies to it.'
            }
          >
            {({ id, describedBy }) => <NumberInput id={id} step={0.1} suffix="x" value={state.exitMultiple} onValue={onExitMultiple} aria-describedby={describedBy} />}
          </Field>
          <Field label="Discounting" hint="Mid-year assumes cash arrives evenly through each year.">
            {({ id, describedBy }) => (
              <Select id={id} aria-describedby={describedBy} value={state.midYear ? '1' : '0'} onChange={(e) => onChange({ midYear: e.target.value === '1' })}>
                <option value="1">Mid-year convention</option>
                <option value="0">End of year</option>
              </Select>
            )}
          </Field>
        </div>
      </Group>

      <Group
        title="Comparables"
        sub={preset ? `Preset indicative private company multiples for ${state.industry}. Used unless you add your own peers.` : undefined}
      >
        {preset && (
          <div className="relative mb-5 overflow-x-auto rounded-[2px] border border-[color:var(--pmbc-border-warm)]">
            <table className="w-full border-collapse text-[14px] tabular-nums">
              <caption className="sr-only">Preset multiples</caption>
              <thead>
                <tr className="bg-[#F6F1E6] text-[12.5px] text-[color:var(--pmbc-muted)]">
                  <th scope="col" className="p-2 text-left font-semibold">Multiple</th>
                  <th scope="col" className="p-2 text-right font-semibold">Low</th>
                  <th scope="col" className="p-2 text-right font-semibold">Median</th>
                  <th scope="col" className="p-2 text-right font-semibold">High</th>
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    ['EV / EBITDA', preset.ebitdaMultiples],
                    ['EV / Revenue', preset.revenueMultiples],
                  ] as const
                ).map(([label, m]) => (
                  <tr key={label} className="border-t border-[color:var(--pmbc-border-warm)]">
                    <th scope="row" className="p-2 text-left font-normal">{label}</th>
                    {m.map((v, i) => (
                      <td key={i} className="p-2 text-right">
                        {v}x
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <strong className="text-[15px] text-[color:var(--pmbc-text)]">Your own peer companies (optional)</strong>
        <div className="mb-2.5">
          <Hint>Add at least two peers to replace the preset. The tool uses the lowest, median and highest of your peers.</Hint>
        </div>
        <div className="pmbc-scroll-thin relative overflow-x-auto rounded-[2px] border border-[color:var(--pmbc-border-warm)]">
          <table className="w-full min-w-[460px] border-collapse">
            <caption className="sr-only">Your peer companies</caption>
            <thead>
              <tr className="bg-[#F6F1E6] text-left text-[12.5px] text-[color:var(--pmbc-muted)]">
                <th scope="col" className="px-1.5 py-2 font-semibold">Company</th>
                <th scope="col" className="px-1.5 py-2 font-semibold">EV / EBITDA (x)</th>
                <th scope="col" className="px-1.5 py-2 font-semibold">EV / Revenue (x)</th>
                <th scope="col" className="w-10"><span className="sr-only">Remove</span></th>
              </tr>
            </thead>
            <tbody>
              {state.peers.map((p, idx) => (
                <tr key={p.id} className="border-t border-[color:var(--pmbc-border-warm)]">
                  <td className="p-1.5">
                    <input
                      type="text"
                      placeholder="Company name"
                      value={p.name}
                      onChange={(e) => onPeer(p.id, { name: e.target.value })}
                      aria-label={`Peer ${idx + 1} name`}
                      className={`${inputClass} py-2`}
                    />
                  </td>
                  <td className="p-1.5">
                    <NumberInput step={0.1} value={p.evEbitda} onValue={(v) => onPeer(p.id, { evEbitda: v })} aria-label={`Peer ${idx + 1} EV / EBITDA`} />
                  </td>
                  <td className="p-1.5">
                    <NumberInput step={0.1} value={p.evRevenue} onValue={(v) => onPeer(p.id, { evRevenue: v })} aria-label={`Peer ${idx + 1} EV / Revenue`} />
                  </td>
                  <td className="p-1.5 text-center">
                    <button
                      type="button"
                      onClick={() => onRemovePeer(p.id)}
                      aria-label={`Remove peer ${idx + 1}`}
                      className="rounded-[2px] p-1.5 text-[color:var(--pmbc-muted)] hover:text-[#B3412F] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#C69C3E]/50"
                    >
                      <X aria-hidden size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-2.5">
          <button type="button" onClick={onAddPeer} className={buttonSmall} style={TRACKING}>
            Add peer
          </button>
        </div>

        <div className="mt-5 grid gap-x-5 sm:grid-cols-2">
          <Field
            label="Private company discount"
            hint={
              state.discountTouched
                ? 'Your own figure. Applied to the comparables and the exit multiple.'
                : peerDefaultActive
                  ? `Set to ${ASSUMPTIONS.privateDiscountWithPeers}% because listed peers trade at a liquidity premium a private business does not have. Applied to the comparables and the exit multiple. Adjust as you see fit.`
                  : 'Preset multiples already describe private deals, so none is applied. Add peers and this becomes 20%.'
            }
          >
            {({ id, describedBy }) => (
              <NumberInput id={id} step={1} min={0} max={99} suffix="%" value={state.privateDiscount} onValue={onDiscount} aria-describedby={describedBy} />
            )}
          </Field>
          <Field label="Weight on DCF in blended value" hint="Comparables receive the rest.">
            {({ id, describedBy }) => (
              <NumberInput id={id} step={5} min={0} max={100} suffix="%" value={state.dcfWeight} onValue={(v) => onChange({ dcfWeight: v })} aria-describedby={describedBy} />
            )}
          </Field>
        </div>
      </Group>

      <Collapsible
        title="Scenarios"
        badge={scenariosChanged ? 'Adjusted' : 'Defaults'}
        summary="Downside and upside cases around your forecast, weighted by probability. The headline stays your base case."
      >
        <p className="mb-4 text-[13.5px] leading-[1.55] text-[#52606B]">
          Each scenario moves revenue growth and EBITDA margin in every forecast year by the points below. D&amp;A, capex and working capital keep
          their share of revenue.
        </p>
        <div className="grid gap-x-5 sm:grid-cols-2">
          {(
            [
              ['downsideGrowth', 'Downside revenue growth'],
              ['upsideGrowth', 'Upside revenue growth'],
              ['downsideMargin', 'Downside EBITDA margin'],
              ['upsideMargin', 'Upside EBITDA margin'],
            ] as [ScenarioKey, string][]
          ).map(([k, label]) => (
            <Field key={k} label={label}>
              {({ id }) => <NumberInput id={id} step={0.5} suffix="pts" value={sc[k]} onValue={(v) => onScenario(k, v)} />}
            </Field>
          ))}
        </div>
        <fieldset className="mt-2">
          <legend className="mb-2 text-[14px] font-medium text-[color:var(--pmbc-text)]">Probability weights</legend>
          <div className="grid grid-cols-3 gap-3">
            {(
              [
                ['weightDownside', 'Downside'],
                ['weightBase', 'Base'],
                ['weightUpside', 'Upside'],
              ] as [ScenarioKey, string][]
            ).map(([k, label]) => (
              <div key={k}>
                <label htmlFor={`weight-${k}`} className="mb-1 block text-[13px] text-[color:var(--pmbc-muted)]">
                  {label}
                </label>
                <NumberInput id={`weight-${k}`} step={5} min={0} max={100} suffix="%" value={sc[k]} onValue={(v) => onScenario(k, v)} />
              </div>
            ))}
          </div>
          <p
            role="status"
            className={`mt-2 text-[13px] font-medium tabular-nums ${weightsOk ? 'text-[#1B6B3F]' : 'text-[#B3412F]'}`}
          >
            Total {+weightTotal.toFixed(2)}%{weightsOk ? '' : '. Weights must total 100%.'}
          </p>
        </fieldset>
      </Collapsible>

      <Collapsible title="Stake value" badge={stakeUsed ? 'In use' : 'Optional'} summary="Value a shareholding rather than the whole company, with a control premium or minority discount.">
        <div className="grid gap-x-5 sm:grid-cols-2">
          <Field label="Stake being valued" hint="Percent of the equity. 100% values the whole company.">
            {({ id, describedBy }) => (
              <NumberInput id={id} step={1} min={0} max={100} suffix="%" value={state.stake.percent} onValue={(v) => onStake({ percent: v })} aria-describedby={describedBy} />
            )}
          </Field>
        </div>
        <fieldset>
          <legend className="mb-2 text-[14px] font-medium text-[color:var(--pmbc-text)]">Adjustment</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {STAKE_OPTIONS.map((o) => (
              <label
                key={o.value}
                className={`flex cursor-pointer flex-col gap-0.5 rounded-[2px] border px-3 py-2.5 text-[14px] ${
                  state.stake.adjustment === o.value ? 'border-[#C69C3E] bg-[#FDF8EC]' : 'border-[color:var(--pmbc-border-warm)] bg-white'
                }`}
              >
                <span className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="stake-adjustment"
                    value={o.value}
                    checked={state.stake.adjustment === o.value}
                    onChange={() => onStake({ adjustment: o.value })}
                    className="accent-[#1B3A5F]"
                  />
                  <span className="font-medium">{o.label}</span>
                </span>
                <span className="text-[12.5px] text-[color:var(--pmbc-muted)]">{o.hint}</span>
              </label>
            ))}
          </div>
        </fieldset>
        {state.stake.adjustment === 'control_premium' && !(num(state.stake.percent) !== null && (num(state.stake.percent) as number) > WARNING_RULES.controlStakeAbovePercent) && (
          <p role="status" className="mt-3 border-l-2 border-[#C69C3E] bg-[#FDF8EC] px-3 py-2 text-[13px] text-[#6B4E12]">
            A stake of {WARNING_RULES.controlStakeAbovePercent}% or less does not carry control, so buyers apply a minority discount. The
            premium will be used as chosen, with a warning in the results.
          </p>
        )}
        {state.stake.adjustment === 'control_premium' && (
          <div className="mt-3 max-w-xs">
            <Field label="Control premium">
              {({ id }) => <NumberInput id={id} step={1} min={0} max={100} suffix="%" value={state.stake.controlPremium} onValue={(v) => onStake({ controlPremium: v })} />}
            </Field>
          </div>
        )}
        {state.stake.adjustment === 'minority_discount' && (
          <div className="mt-3 max-w-xs">
            <Field label="Minority discount">
              {({ id }) => <NumberInput id={id} step={1} min={0} max={99} suffix="%" value={state.stake.minorityDiscount} onValue={(v) => onStake({ minorityDiscount: v })} />}
            </Field>
          </div>
        )}
      </Collapsible>

      <ErrorText>{error}</ErrorText>
      <StepNav onBack={onBack} onNext={onRun} nextLabel="Run valuation" />
    </Panel>
  );
}
