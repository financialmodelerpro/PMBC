'use client';

/**
 * Draws a shared `Chart` (src/lib/tools/valuation/charts.ts) as SVG. The PDF
 * draws the same primitives with react-pdf, so the two match.
 *
 * Interactive where it helps: any primitive with a `hint` shows it in a tooltip
 * on hover, and the chart's full description is its accessible name, with the
 * same figures available to assistive technology in the tables beside it.
 */

import { useRef, useState } from 'react';

import type { Chart } from '@/lib/tools/valuation/charts';

export function ChartSvg({ chart, className }: { chart: Chart; className?: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<{ text: string; x: number; y: number } | null>(null);

  const show = (text: string | undefined, e: React.MouseEvent) => {
    if (!text || !wrap.current) return;
    const box = wrap.current.getBoundingClientRect();
    setTip({ text, x: e.clientX - box.left, y: e.clientY - box.top });
  };

  return (
    <div ref={wrap} className={`relative ${className ?? ''}`} onMouseLeave={() => setTip(null)}>
      <svg
        viewBox={`0 0 ${chart.width} ${chart.height}`}
        role="img"
        aria-label={chart.label}
        className="block h-auto w-full"
        style={{ fontFamily: 'var(--font-inter), Inter, Arial, sans-serif', fontVariantNumeric: 'tabular-nums' }}
      >
        {chart.prims.map((p, i) => {
          switch (p.t) {
            case 'rect':
              return (
                <rect
                  key={i}
                  x={p.x}
                  y={p.y}
                  width={p.w}
                  height={p.h}
                  fill={p.fill}
                  rx={p.rx}
                  opacity={p.opacity}
                  stroke={p.stroke}
                  strokeWidth={p.strokeWidth}
                  onMouseMove={p.hint ? (e) => show(p.hint, e) : undefined}
                  style={p.hint ? { cursor: 'default' } : undefined}
                >
                  {p.hint && <title>{p.hint}</title>}
                </rect>
              );
            case 'line':
              return <line key={i} x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} stroke={p.stroke} strokeWidth={p.width} strokeDasharray={p.dash} />;
            case 'path':
              return <path key={i} d={p.d} stroke={p.stroke} fill={p.fill ?? 'none'} strokeWidth={p.width} strokeLinejoin="round" strokeLinecap="round" />;
            case 'circle':
              return <circle key={i} cx={p.cx} cy={p.cy} r={p.r} fill={p.fill} stroke={p.stroke} strokeWidth={p.strokeWidth} />;
            case 'text':
              return (
                <text
                  key={i}
                  x={p.x}
                  y={p.y}
                  fill={p.fill}
                  fontSize={p.size}
                  textAnchor={p.anchor}
                  fontWeight={p.weight ?? 400}
                  fontFamily={p.family === 'serif' ? 'var(--font-source-serif), Georgia, serif' : undefined}
                >
                  {p.text}
                </text>
              );
          }
        })}
      </svg>
      {tip && (
        <div
          role="status"
          className="pointer-events-none absolute z-10 max-w-[260px] rounded-[2px] bg-[#14304F] px-2.5 py-1.5 text-[12px] leading-snug text-white shadow-lg"
          style={{ left: Math.min(tip.x + 12, (wrap.current?.clientWidth ?? 400) - 200), top: tip.y + 14 }}
        >
          {tip.text}
        </div>
      )}
    </div>
  );
}
