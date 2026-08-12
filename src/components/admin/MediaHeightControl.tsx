'use client';

import { ADMIN_COLORS, adminInput, adminLabel } from '@/lib/admin/styles';
import {
  MAX_MEDIA_MAX_HEIGHT,
  MEDIA_MAX_HEIGHT_KEY,
  MEDIA_MAX_HEIGHT_PRESETS,
  MIN_MEDIA_MAX_HEIGHT,
  readMediaMaxHeight,
} from '@/lib/cms/sectionMedia';

function rawValue(content: Record<string, unknown>): string {
  const raw = content[MEDIA_MAX_HEIGHT_KEY];
  if (typeof raw === 'number' && Number.isFinite(raw)) return String(raw);
  if (typeof raw === 'string') return raw;
  return '';
}

/**
 * Maximum height for a media frame, shared by the standalone `media` section
 * editor and the shared media panel every other section type carries.
 *
 * One component rather than one per surface, because the two write the same
 * content key and read it back through the same helper. Two copies of a control
 * over one field is how a preset list ends up meaning different things
 * depending on which editor an operator happened to open.
 *
 * Presets exist because the useful answer is almost never a measurement of the
 * asset: it is "make this fit on screen next to the text", and picking 480 from
 * a row of buttons gets there faster than reasoning about a video's dimensions.
 * The number box stays, since a specific layout sometimes needs a specific
 * number.
 *
 * Typed values are stored as typed and clamped on the read path rather than
 * corrected in the box. Clamping while the operator is still typing would turn
 * a half-entered "4" into 80 and eat the next keystroke.
 */
export function MediaHeightControl({
  content,
  onChange,
}: {
  content: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
}) {
  const raw = rawValue(content);
  const effective = readMediaMaxHeight(content[MEDIA_MAX_HEIGHT_KEY]);
  const typed = raw.trim() === '' ? null : Number(raw.trim());
  const clamped =
    effective !== null && typed !== null && Number.isFinite(typed) && typed !== effective;

  const set = (value: number | null) => {
    onChange({ [MEDIA_MAX_HEIGHT_KEY]: value === null ? '' : value });
  };

  return (
    <div>
      <span style={adminLabel}>Maximum height</span>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
        {MEDIA_MAX_HEIGHT_PRESETS.map((p) => {
          const active = effective === p.value;
          return (
            <button
              key={p.label}
              type="button"
              title={p.hint}
              onClick={() => set(p.value)}
              style={{
                padding: '6px 14px',
                borderRadius: 7,
                fontSize: 12,
                fontWeight: 700,
                border: `1px solid ${active ? ADMIN_COLORS.primary : ADMIN_COLORS.borderInput}`,
                background: active ? ADMIN_COLORS.primary : '#FFFFFF',
                color: active ? '#FFFFFF' : ADMIN_COLORS.primaryDeep,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {p.label}
              {p.value !== null && (
                <span style={{ marginLeft: 6, opacity: 0.75, fontWeight: 600 }}>
                  {p.value}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <label style={{ display: 'block', marginTop: 10 }}>
        <span style={{ ...adminLabel, fontSize: 11 }}>Or a specific height in pixels</span>
        <input
          type="number"
          inputMode="numeric"
          min={MIN_MEDIA_MAX_HEIGHT}
          max={MAX_MEDIA_MAX_HEIGHT}
          step={10}
          value={raw}
          placeholder="Blank for natural height"
          onChange={(e) => {
            const v = e.target.value.trim();
            const n = Number(v);
            set(v === '' || !Number.isFinite(n) ? null : n);
          }}
          style={{ ...adminInput, maxWidth: 220 }}
        />
      </label>

      <p style={{ margin: '6px 0 0', fontSize: 11, color: ADMIN_COLORS.textMicro }}>
        {effective === null
          ? 'No ceiling. The asset renders at its own height, as it does now.'
          : `The frame keeps the full column width and is capped at ${effective}px. The asset scales down to fit inside it, keeping its proportions, with the frame surface showing at the sides rather than any of the picture being cut off.`}
        {clamped && ` Values outside ${MIN_MEDIA_MAX_HEIGHT} to ${MAX_MEDIA_MAX_HEIGHT} are brought back into range, so ${typed} renders as ${effective}.`}
      </p>
    </div>
  );
}
