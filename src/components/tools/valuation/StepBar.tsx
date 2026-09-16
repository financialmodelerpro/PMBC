'use client';

/**
 * The step bar: numbered markers joined by a gold progress line, a tick on each
 * completed step, and every step already reached clickable.
 *
 * An ordered list of buttons, so a screen reader hears "Step 2 of 4, Financials,
 * completed" and keyboard users tab through the steps they may revisit. Steps
 * not yet reached are disabled rather than hidden.
 */

import { Check } from 'lucide-react';

export type StepState = 'done' | 'current' | 'todo';

export function StepBar({
  labels,
  states,
  onGo,
}: {
  labels: string[];
  states: StepState[];
  onGo: (index: number) => void;
}) {
  const doneCount = states.filter((s) => s === 'done').length;
  const progress = Math.min(1, doneCount / Math.max(1, labels.length - 1));
  return (
    <nav aria-label="Valuation steps" className="relative">
      <div aria-hidden className="absolute top-[17px] right-[12.5%] left-[12.5%] h-[2px] bg-[#E8E2D6]">
        <div className="h-full bg-[#C69C3E] motion-safe:transition-[width] motion-safe:duration-500" style={{ width: `${progress * 100}%` }} />
      </div>
      <ol className="relative grid grid-cols-4">
        {labels.map((label, i) => {
          const state = states[i];
          const reachable = state !== 'todo';
          return (
            <li key={label} className="flex justify-center">
              <button
                type="button"
                disabled={!reachable}
                aria-current={state === 'current' ? 'step' : undefined}
                aria-label={`Step ${i + 1} of ${labels.length}, ${label}${state === 'done' ? ', completed' : state === 'current' ? ', current' : ''}`}
                onClick={() => onGo(i)}
                className="group flex flex-col items-center gap-2 rounded-[2px] px-1 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#C69C3E]/50 disabled:cursor-default"
              >
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-full border-2 text-[14px] font-semibold transition-colors ${
                    state === 'done'
                      ? 'border-[#1B3A5F] bg-[#1B3A5F] text-white group-hover:border-[#C69C3E]'
                      : state === 'current'
                        ? 'border-[#C69C3E] bg-white text-[#14304F] shadow-[0_0_0_4px_rgba(198,156,62,0.18)]'
                        : 'border-[#E8E2D6] bg-white text-[#9AA3AD]'
                  }`}
                >
                  {state === 'done' ? <Check aria-hidden size={16} strokeWidth={3} /> : i + 1}
                </span>
                <span
                  className={`text-center text-[11.5px] leading-tight sm:text-[13px] ${
                    state === 'todo' ? 'text-[#9AA3AD]' : 'font-semibold text-[color:var(--pmbc-text)]'
                  }`}
                >
                  {label}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
