// scripts/lib/animatedGif.mjs
//
// A three frame animated GIF, generated rather than committed.
//
// The animated case is the one that matters in every media verification: the
// optimizer is bypassed for GIF precisely because re-encoding one returns a
// single frozen frame, so a still standing in for an animation would prove
// nothing. A binary fixture in the repo would be a fixture nobody can read a
// diff of, so the bytes are built here instead.
//
// Shared by scripts/verify-section-media-layout.mjs and
// scripts/verify-media-max-height.mjs. One copy, so both scripts are measuring
// the same asset with the same known dimensions.

/** Intrinsic size of the generated file, which callers assert against. */
export const GIF_WIDTH = 64;
export const GIF_HEIGHT = 40;

export function buildAnimatedGif() {
  const W = GIF_WIDTH;
  const H = GIF_HEIGHT;
  const FRAMES = 3;
  const PALETTE = [
    [0xc6, 0x9c, 0x3e],
    [0x1b, 0x3a, 0x5f],
    [0xfa, 0xf7, 0xf2],
  ];

  const lzw = (indices, minCodeSize) => {
    const clear = 1 << minCodeSize;
    const eoi = clear + 1;
    const out = [];
    let cur = 0;
    let curBits = 0;
    let codeSize = minCodeSize + 1;
    let dict = new Map();
    let next = eoi + 1;
    const emit = (code) => {
      cur |= code << curBits;
      curBits += codeSize;
      while (curBits >= 8) {
        out.push(cur & 0xff);
        cur >>= 8;
        curBits -= 8;
      }
    };
    const codeOf = (seq) => (seq.length === 1 ? seq[0] : dict.get(seq.join(',')));
    emit(clear);
    dict = new Map();
    next = eoi + 1;
    codeSize = minCodeSize + 1;
    let prefix = [indices[0]];
    for (let i = 1; i < indices.length; i++) {
      const k = indices[i];
      const cand = prefix.concat(k);
      if (dict.has(cand.join(','))) {
        prefix = cand;
        continue;
      }
      emit(codeOf(prefix));
      dict.set(cand.join(','), next);
      next += 1;
      if (next > 1 << codeSize && codeSize < 12) codeSize += 1;
      prefix = [k];
    }
    emit(codeOf(prefix));
    emit(eoi);
    if (curBits > 0) out.push(cur & 0xff);
    return out;
  };
  const subBlocks = (bytes) => {
    const out = [];
    for (let i = 0; i < bytes.length; i += 255) {
      const chunk = bytes.slice(i, i + 255);
      out.push(chunk.length, ...chunk);
    }
    out.push(0);
    return out;
  };

  const b = [];
  b.push(...Buffer.from('GIF89a', 'latin1'));
  b.push(W & 0xff, W >> 8, H & 0xff, H >> 8, 0xf1, 0, 0);
  for (const c of PALETTE) b.push(...c);
  b.push(0, 0, 0);
  b.push(0x21, 0xff, 0x0b, ...Buffer.from('NETSCAPE2.0', 'latin1'), 0x03, 0x01, 0x00, 0x00, 0x00);
  for (let f = 0; f < FRAMES; f++) {
    const px = [];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        px.push(Math.floor((y / H) * FRAMES) === f ? (f + 1) % 3 : f % 3);
      }
    }
    b.push(0x21, 0xf9, 0x04, 0x04, 0x32, 0x00, 0x00, 0x00);
    b.push(0x2c, 0, 0, 0, 0, W & 0xff, W >> 8, H & 0xff, H >> 8, 0x00);
    b.push(2, ...subBlocks(lzw(px, 2)));
  }
  b.push(0x3b);
  return Buffer.from(b);
}

