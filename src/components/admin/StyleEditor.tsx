'use client';

import { useState, type CSSProperties } from 'react';
import { ChevronDown, ChevronRight, RotateCcw } from 'lucide-react';

import { MediaPickerButton } from '@/components/admin/MediaPicker';
import {
  ADMIN_COLORS,
  adminButtonGhost,
  adminInput,
  adminLabel,
} from '@/lib/admin/styles';

/**
 * Per-section presentation controls (parity Phase 5, FMP CMS_REFERENCE.md
 * section 2.3a). Writes `page_sections.styles`, which the public renderers read
 * through lib/public/sectionStyles.ts.
 *
 * Collapsed by default: these are overrides, and the section should look right
 * from its variant alone in the common case. Opening the panel is a deliberate
 * act.
 *
 * IMPORTANT: `background_variant` (and the legacy `background_style`) live in
 * the same JSONB and are NOT edited here. Every write preserves unknown keys, so
 * the Phase 9.5 variant system keeps working untouched.
 */

const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const HEX_PARTIAL = /^#[0-9A-Fa-f]{0,6}$/;

type Styles = Record<string, unknown>;

function str(v: unknown): string {
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  return '';
}

export function StyleEditor({
  styles,
  onChange,
}: {
  styles: Styles;
  onChange: (next: Styles) => void;
}) {
  const [open, setOpen] = useState(false);

  /** Sets a key, deleting it when cleared so an unset field stays absent from
   *  the JSONB rather than being stored as an empty string the parser has to
   *  special-case. */
  const set = (key: string, value: string | number | null) => {
    const next: Styles = { ...styles };
    if (value === null || value === '') delete next[key];
    else next[key] = value;
    onChange(next);
  };

  const setNum = (key: string, raw: string) => {
    if (raw === '') return set(key, null);
    if (!/^\d+$/.test(raw)) return;
    set(key, Number(raw));
  };

  /** Clears only the presentation keys. background_variant survives, because it
   *  belongs to the variant system, not to this panel. */
  const resetAll = () => {
    const next: Styles = { ...styles };
    for (const k of PRESENTATION_KEYS) delete next[k];
    onChange(next);
  };

  const touched = PRESENTATION_KEYS.some(
    (k) => styles[k] !== undefined && styles[k] !== '',
  );

  return (
    <div
      style={{
        marginTop: 16,
        background: '#FFFFFF',
        border: `1px solid ${ADMIN_COLORS.border}`,
        borderRadius: 12,
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '12px 16px',
          background: open ? ADMIN_COLORS.altBg : '#FFFFFF',
          border: 'none',
          borderBottom: open ? `1px solid ${ADMIN_COLORS.border}` : 'none',
          cursor: 'pointer',
          fontFamily: 'inherit',
          textAlign: 'left',
        }}
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: ADMIN_COLORS.textBody,
          }}
        >
          Section styles
        </span>
        {touched && (
          <span
            style={{
              padding: '2px 8px',
              borderRadius: 999,
              background: ADMIN_COLORS.warningBg,
              color: ADMIN_COLORS.warning,
              fontSize: 10,
              fontWeight: 700,
            }}
          >
            customised
          </span>
        )}
        <span
          style={{
            marginLeft: 'auto',
            fontSize: 11,
            color: ADMIN_COLORS.textMicro,
          }}
        >
          {open ? 'Hide' : 'Optional overrides'}
        </span>
      </button>

      {open && (
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <p style={{ margin: 0, fontSize: 11.5, color: ADMIN_COLORS.textMuted, lineHeight: 1.6 }}>
            Every field here is optional. Leave one blank and the section keeps its
            theme default, so an untouched section looks exactly as it does today.
          </p>

          <Group title="Background">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <ColorField
                label="Background colour"
                value={str(styles.bg_color)}
                onChange={(v) => set('bg_color', v)}
              />
              <NumberField
                label="Overlay darkness (%)"
                value={str(styles.bg_overlay)}
                onChange={(v) => setNum('bg_overlay', v)}
                min={0}
                max={100}
                hint="Darkens the background image. Ignored without one."
              />
            </div>
            <div style={{ marginTop: 14 }}>
              <MediaPickerButton
                value={str(styles.bg_image_url)}
                onChange={(url) => set('bg_image_url', url || null)}
                bucket="cms-assets"
                label="Background image"
              />
            </div>
          </Group>

          <Group title="Text">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <ColorField
                label="Text colour"
                value={str(styles.text_color)}
                onChange={(v) => set('text_color', v)}
              />
            </div>
          </Group>

          <Group title="Spacing">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              <NumberField
                label="Pad top"
                value={str(styles.padding_top)}
                onChange={(v) => setNum('padding_top', v)}
                min={0}
                max={200}
              />
              <NumberField
                label="Pad right"
                value={str(styles.padding_right)}
                onChange={(v) => setNum('padding_right', v)}
                min={0}
                max={200}
              />
              <NumberField
                label="Pad bottom"
                value={str(styles.padding_bottom)}
                onChange={(v) => setNum('padding_bottom', v)}
                min={0}
                max={200}
              />
              <NumberField
                label="Pad left"
                value={str(styles.padding_left)}
                onChange={(v) => setNum('padding_left', v)}
                min={0}
                max={200}
              />
            </div>
            <p style={{ margin: '8px 0 0', fontSize: 11, color: ADMIN_COLORS.textMicro }}>
              Pixels, 0 to 200. Blank keeps the responsive default, which is larger on
              desktop than on mobile. A fixed value applies at every width.
            </p>
          </Group>

          <Group title="Layout">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
              <NumberField
                label="Max width (px)"
                value={str(styles.max_width)}
                onChange={(v) => setNum('max_width', v)}
                min={320}
                max={2400}
                hint="Default 1200"
              />
              <NumberField
                label="Corner radius"
                value={str(styles.border_radius)}
                onChange={(v) => setNum('border_radius', v)}
                min={0}
                max={24}
              />
              <label>
                <span style={adminLabel}>Animation</span>
                <select
                  value={str(styles.animation) || 'none'}
                  onChange={(e) =>
                    set('animation', e.target.value === 'none' ? null : e.target.value)
                  }
                  style={adminInput}
                >
                  <option value="none">None</option>
                  <option value="fade-in">Fade in</option>
                  <option value="slide-up">Slide up</option>
                </select>
              </label>
            </div>
          </Group>

          <Group title="Advanced">
            <label style={{ display: 'block' }}>
              <span style={adminLabel}>Custom CSS class</span>
              <input
                type="text"
                value={str(styles.css_class)}
                onChange={(e) => set('css_class', e.target.value)}
                placeholder="my-custom-section"
                style={{
                  ...adminInput,
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                }}
              />
              <p style={{ margin: '6px 0 0', fontSize: 11, color: ADMIN_COLORS.textMicro }}>
                Added to the section wrapper. Letters, numbers, spaces, hyphens and
                underscores only.
              </p>
            </label>
          </Group>

          {touched && (
            <div>
              <button
                type="button"
                onClick={resetAll}
                style={{ ...adminButtonGhost, color: ADMIN_COLORS.danger }}
              >
                <RotateCcw size={13} /> Reset all styles
              </button>
              <p style={{ margin: '6px 0 0', fontSize: 11, color: ADMIN_COLORS.textMicro }}>
                Clears the fields above and returns the section to its theme default. The
                background variant is not affected. Save the section to apply.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** The keys this panel owns. Anything else in the JSONB is left alone. */
const PRESENTATION_KEYS = [
  'bg_color',
  'bg_image_url',
  'bg_overlay',
  'text_color',
  'padding_top',
  'padding_right',
  'padding_bottom',
  'padding_left',
  'max_width',
  'border_radius',
  'animation',
  'css_class',
] as const;

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3
        style={{
          margin: '0 0 10px',
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: ADMIN_COLORS.textMuted,
        }}
      >
        {title}
      </h3>
      {children}
    </section>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  min: number;
  max: number;
  hint?: string;
}) {
  const n = value === '' ? null : Number(value);
  const outOfRange = n !== null && Number.isFinite(n) && (n < min || n > max);
  return (
    <label>
      <span style={adminLabel}>{label}</span>
      <input
        type="text"
        inputMode="numeric"
        value={value}
        placeholder="auto"
        onChange={(e) => {
          const v = e.target.value;
          if (v === '' || /^\d+$/.test(v)) onChange(v);
        }}
        style={{
          ...adminInput,
          borderColor: outOfRange ? ADMIN_COLORS.danger : ADMIN_COLORS.borderInput,
        }}
      />
      {outOfRange ? (
        <p style={{ margin: '4px 0 0', fontSize: 10.5, color: ADMIN_COLORS.danger }}>
          Must be {min} to {max}. Out-of-range values are ignored when rendering.
        </p>
      ) : hint ? (
        <p style={{ margin: '4px 0 0', fontSize: 10.5, color: ADMIN_COLORS.textMicro }}>
          {hint}
        </p>
      ) : null}
    </label>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string | null) => void;
}) {
  const valid = HEX.test(value);
  const swatch: CSSProperties = {
    width: 40,
    height: 36,
    flexShrink: 0,
    padding: 2,
    border: `1px solid ${ADMIN_COLORS.borderInput}`,
    borderRadius: 7,
    background: '#FFFFFF',
    cursor: 'pointer',
  };
  return (
    <div>
      <span style={adminLabel}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="color"
          value={valid ? value : '#000000'}
          onChange={(e) => onChange(e.target.value)}
          style={swatch}
          aria-label={`${label} picker`}
        />
        <input
          type="text"
          value={value}
          maxLength={7}
          placeholder="theme default"
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === '') return onChange(null);
            const clean = raw.startsWith('#') ? raw : '#' + raw;
            if (HEX_PARTIAL.test(clean)) onChange(clean);
          }}
          style={{ ...adminInput, letterSpacing: '0.04em' }}
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            title="Clear"
            aria-label={`Clear ${label}`}
            style={{
              ...adminButtonGhost,
              padding: '7px 10px',
              fontSize: 11,
            }}
          >
            Clear
          </button>
        )}
      </div>
      {value !== '' && !valid && (
        <p style={{ margin: '4px 0 0', fontSize: 10.5, color: ADMIN_COLORS.danger }}>
          Use a hex value like #1B3A5F
        </p>
      )}
    </div>
  );
}
