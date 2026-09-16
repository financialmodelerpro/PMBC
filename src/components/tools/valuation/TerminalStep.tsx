'use client';

import { X } from 'lucide-react';

import { industryFor } from '@/lib/tools/valuation/engine';

import type { FormState, PeerRow } from './state';
import {
  ErrorText,
  Field,
  Group,
  Hint,
  NavRow,
  NumberInput,
  Panel,
  PanelTitle,
  Select,
  TRACKING,
  buttonGhost,
  buttonPrimary,
  buttonSmall,
  inputClass,
} from './ui';

export function TerminalStep({
  state,
  error,
  peerDefaultActive,
  onChange,
  onExitMultiple,
  onPeer,
  onAddPeer,
  onRemovePeer,
  onBack,
  onRun,
}: {
  state: FormState;
  error: string;
  /** True when the exit multiple is following the visitor's own peers. */
  peerDefaultActive: boolean;
  onChange: (patch: Partial<FormState>) => void;
  onExitMultiple: (v: string) => void;
  onPeer: (id: number, patch: Partial<PeerRow>) => void;
  onAddPeer: () => void;
  onRemovePeer: (id: number) => void;
  onBack: () => void;
  onRun: () => void;
}) {
  const preset = industryFor(state.industry);

  return (
    <Panel>
      <PanelTitle
        title="Terminal value and comparables"
        lead="Set how value beyond the forecast is captured, then choose the multiples for the comparables method."
      />

      <Group title="Terminal value" first>
        <div className="grid gap-x-5 sm:grid-cols-3">
          <Field label="Long-term growth rate" hint="Perpetuity growth after year 5. Usually close to long-run inflation.">
            {({ id }) => <NumberInput id={id} step={0.1} suffix="%" value={state.growth} onValue={(v) => onChange({ growth: v })} />}
          </Field>
          <Field
            label="Exit EV / EBITDA multiple"
            hint={
              state.xmTouched
                ? 'Your own figure. Change the industry to restore the default.'
                : peerDefaultActive
                  ? 'Defaults to the median of your peers.'
                  : 'Defaults to the comparables median.'
            }
          >
            {({ id }) => <NumberInput id={id} step={0.1} suffix="x" value={state.exitMultiple} onValue={onExitMultiple} />}
          </Field>
          <Field label="Discounting" hint="Mid-year assumes cash arrives evenly through each year.">
            {({ id }) => (
              <Select id={id} value={state.midYear ? '1' : '0'} onChange={(e) => onChange({ midYear: e.target.value === '1' })}>
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
          <div className="mb-5 overflow-x-auto rounded-[2px] border border-[color:var(--pmbc-border-warm)]">
            <table className="w-full border-collapse text-[14.5px] tabular-nums">
              <thead>
                <tr className="text-[13px] text-[color:var(--pmbc-muted)]">
                  <th className="border-b border-[color:var(--pmbc-border-warm)] p-2 text-left font-semibold">Multiple</th>
                  <th className="border-b border-[color:var(--pmbc-border-warm)] p-2 text-right font-semibold">Low</th>
                  <th className="border-b border-[color:var(--pmbc-border-warm)] p-2 text-right font-semibold">Median</th>
                  <th className="border-b border-[color:var(--pmbc-border-warm)] p-2 text-right font-semibold">High</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['EV / EBITDA', preset.ebitdaMultiples],
                  ['EV / Revenue', preset.revenueMultiples],
                ].map(([label, m], r) => (
                  <tr key={label as string}>
                    <td className={`p-2 text-left ${r === 0 ? 'border-b border-[color:var(--pmbc-border-warm)]' : ''}`}>{label as string}</td>
                    {(m as readonly number[]).map((v, i) => (
                      <td key={i} className={`p-2 text-right ${r === 0 ? 'border-b border-[color:var(--pmbc-border-warm)]' : ''}`}>
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
        <div className="overflow-x-auto rounded-[2px] border border-[color:var(--pmbc-border-warm)]">
          <table className="w-full min-w-[460px] border-collapse">
            <thead>
              <tr className="bg-[#F6F1E6] text-left text-[13px] text-[color:var(--pmbc-muted)]">
                <th className="px-1.5 py-2 font-semibold">Company</th>
                <th className="px-1.5 py-2 font-semibold">EV / EBITDA (x)</th>
                <th className="px-1.5 py-2 font-semibold">EV / Revenue (x)</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {state.peers.map((p, idx) => (
                <tr key={p.id} className="border-b border-[color:var(--pmbc-border-warm)] last:border-b-0">
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
                    <NumberInput step={0.1} value={p.evEbitda} onValue={(v) => onPeer(p.id, { evEbitda: v })} aria-label={`Peer ${idx + 1} EV / EBITDA`} className="py-2" />
                  </td>
                  <td className="p-1.5">
                    <NumberInput step={0.1} value={p.evRevenue} onValue={(v) => onPeer(p.id, { evRevenue: v })} aria-label={`Peer ${idx + 1} EV / Revenue`} className="py-2" />
                  </td>
                  <td className="p-1.5 text-center">
                    <button
                      type="button"
                      onClick={() => onRemovePeer(p.id)}
                      aria-label={`Remove peer ${idx + 1}`}
                      className="p-1.5 text-[color:var(--pmbc-muted)] hover:text-[#B3412F]"
                    >
                      <X size={16} />
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
            label="Private company discount on comps"
            hint="Preset multiples already reflect private deals. Consider 15% to 30% when using listed peers."
          >
            {({ id }) => <NumberInput id={id} step={1} suffix="%" value={state.privateDiscount} onValue={(v) => onChange({ privateDiscount: v })} />}
          </Field>
          <Field label="Weight on DCF in blended value" hint="Comparables receive the rest.">
            {({ id }) => (
              <NumberInput id={id} step={5} min={0} max={100} suffix="%" value={state.dcfWeight} onValue={(v) => onChange({ dcfWeight: v })} />
            )}
          </Field>
        </div>
      </Group>

      <ErrorText>{error}</ErrorText>
      <NavRow>
        <button type="button" onClick={onBack} className={buttonGhost} style={TRACKING}>
          Back
        </button>
        <button type="button" onClick={onRun} className={buttonPrimary} style={TRACKING}>
          Run valuation
        </button>
      </NavRow>
    </Panel>
  );
}
