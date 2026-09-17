/**
 * Draws a shared `Chart` (src/lib/tools/valuation/charts.ts) with react-pdf's
 * vector primitives. The results dashboard draws the same primitives as SVG, so
 * a chart in the report matches the one on screen.
 */

import { Circle, Line, Path, Rect, Svg, Text } from '@react-pdf/renderer';

import type { Chart } from '../valuation/charts';
import { NO_LIGATURES, PAGE } from './theme';

export function PdfChart({ chart, width = PAGE.contentWidth }: { chart: Chart; width?: number }) {
  const height = (chart.height / chart.width) * width;
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${chart.width} ${chart.height}`}>
      {chart.prims.map((p, i) => {
        switch (p.t) {
          case 'rect':
            return (
              <Rect
                key={i}
                x={p.x}
                y={p.y}
                width={p.w}
                height={p.h}
                fill={p.fill}
                rx={p.rx}
                ry={p.rx}
                opacity={p.opacity}
                stroke={p.stroke}
                strokeWidth={p.strokeWidth}
              />
            );
          case 'line':
            return <Line key={i} x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} stroke={p.stroke} strokeWidth={p.width} strokeDasharray={p.dash} />;
          case 'path':
            return <Path key={i} d={p.d} stroke={p.stroke} fill={p.fill ?? 'none'} strokeWidth={p.width} strokeDasharray={p.dash} />;
          case 'circle':
            return <Circle key={i} cx={p.cx} cy={p.cy} r={p.r} fill={p.fill} stroke={p.stroke} strokeWidth={p.strokeWidth} />;
          case 'text':
            return (
              <Text
                key={i}
                x={p.x}
                y={p.y}
                fill={p.fill}
                textAnchor={p.anchor}
                style={{
                  fontSize: p.size,
                  fontFamily: p.family === 'serif' ? 'SourceSerif' : 'Inter',
                  fontWeight: p.weight ?? 400,
                  fontFeatureSettings: NO_LIGATURES,
                }}
              >
                {p.text}
              </Text>
            );
        }
      })}
    </Svg>
  );
}
