'use client';

/**
 * Tables for the results dashboard, rendered from the `Table` shapes in
 * format.ts that the PDF reads too.
 */

import { PMBC } from '@/lib/public/tokens';
import type { Table, TableRow } from '@/lib/tools/valuation/format';

const cellBase = 'whitespace-nowrap border-b border-[color:var(--pmbc-border-warm)] px-2.5 py-2';
const firstCol = 'sticky left-0 z-[1] text-left';
// Alignment lives on each column rather than in cellBase: two text-align
// utilities on one element resolve by stylesheet order, not class order.
const numCol = 'text-right';

const toneClass = (tone?: TableRow['tone']) =>
  tone === 'strong'
    ? 'font-semibold border-t-2 border-t-[color:var(--pmbc-text)]'
    : tone === 'muted'
      ? 'text-[color:var(--pmbc-muted)]'
      : 'text-[color:var(--pmbc-text)]';

/**
 * `axis` marks the sensitivity grid, whose header row and first column are both
 * axes and whose centre cell is the base case.
 */
export function DataTable({ table, axis, caption }: { table: Table; axis?: boolean; caption: string }) {
  const axisBg = axis ? 'bg-[#F6F1E6]' : '';
  const centre = Math.floor(table.rows.length / 2);
  return (
    <div className="pmbc-scroll-thin relative overflow-x-auto rounded-[2px] border border-[color:var(--pmbc-border-warm)]" tabIndex={0} role="region" aria-label={caption}>
      <table className="w-full border-collapse text-[14px] tabular-nums">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="bg-[#F6F1E6] text-[12.5px] text-[color:var(--pmbc-muted)]">
            {table.head.map((h, i) => (
              <th key={i} scope="col" className={`${cellBase} ${i === 0 ? `${firstCol} bg-[#F6F1E6]` : numCol} font-semibold`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, ri) => (
            <tr key={ri}>
              <th scope="row" className={`${cellBase} ${firstCol} ${axis ? `${axisBg} font-semibold text-[color:var(--pmbc-muted)]` : `bg-white font-normal ${toneClass(row.tone)}`}`}>
                {row.label}
              </th>
              {row.values.map((v, ci) => {
                const isBase = axis && ri === centre && ci === centre;
                return (
                  <td
                    key={ci}
                    className={`${cellBase} ${numCol} ${isBase ? 'font-semibold text-[#14304F]' : toneClass(row.tone)}`}
                    style={isBase ? { background: PMBC.accent } : undefined}
                  >
                    {v}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function KeyValueList({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="divide-y divide-[color:var(--pmbc-border-warm)] rounded-[2px] border border-[color:var(--pmbc-border-warm)] bg-white">
      {rows.map(([k, v], i) => (
        <div key={`${k}-${i}`} className="flex items-baseline justify-between gap-4 px-3 py-2 text-[14px]">
          <dt className="text-[color:var(--pmbc-muted)]">{k}</dt>
          <dd className="text-right font-medium text-[color:var(--pmbc-text)] tabular-nums">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
