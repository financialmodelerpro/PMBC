/**
 * A QR code drawn as vector squares, from the `qrcode` package's module matrix.
 *
 * No image, no canvas and no native binary, so it renders the same in a Vercel
 * function as locally and stays sharp at any print size.
 */

import QRCode from 'qrcode';
import { Rect, Svg } from '@react-pdf/renderer';

import { RC } from './theme';

export function qrMatrix(text: string): { size: number; dark: (x: number, y: number) => boolean } {
  const qr = QRCode.create(text, { errorCorrectionLevel: 'M' });
  const size = qr.modules.size;
  const data = qr.modules.data;
  return { size, dark: (x, y) => Boolean(data[y * size + x]) };
}

export function QrCode({ text, size = 96 }: { text: string; size?: number }) {
  const m = qrMatrix(text);
  const quiet = 2;
  const total = m.size + quiet * 2;
  const cells: { x: number; y: number }[] = [];
  for (let y = 0; y < m.size; y++) for (let x = 0; x < m.size; x++) if (m.dark(x, y)) cells.push({ x, y });
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${total} ${total}`}>
      <Rect x={0} y={0} width={total} height={total} fill={RC.white} />
      {cells.map((c, i) => (
        <Rect key={i} x={c.x + quiet} y={c.y + quiet} width={1.02} height={1.02} fill={RC.navy} />
      ))}
    </Svg>
  );
}
