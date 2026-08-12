'use client';

import { MediaField } from '@/components/admin/MediaField';
import { MediaHeightControl } from '@/components/admin/MediaHeightControl';
import { ADMIN_COLORS, adminFieldHint, adminInput, adminLabel } from '@/lib/admin/styles';

import type { SectionEditorProps } from './types';

const WIDTHS: { value: string; label: string; hint: string }[] = [
  { value: 'full', label: 'Full', hint: 'The whole 1200px content width' },
  { value: 'wide', label: 'Wide', hint: '960px, centred' },
  { value: 'narrow', label: 'Narrow', hint: '720px, centred, matching the text measure' },
];

function s(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

/**
 * Editor for the standalone `media` section: one asset that stands on its own
 * in the page order, with an optional eyebrow and heading above it.
 *
 * It reuses the same `media_url` key set as the shared media panel, so an
 * operator who has used one already knows this one, and so the playback flags
 * travel through the identical `MediaField`. What it does not carry is
 * `media_position`: there is no text beside it to be positioned against, and
 * offering the control would imply a layout this section never produces.
 */
export function MediaSectionEditor({ content, onChange }: SectionEditorProps) {
  const eyebrow = s(content.eyebrow);
  const heading = s(content.heading);
  const caption = s(content.media_caption);
  const width = s(content.width) || 'full';

  const patch = (p: Record<string, unknown>) => onChange({ ...content, ...p });

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div>
        <MediaField
          content={content}
          urlKey="media_url"
          onChange={patch}
          label="Media"
          hint="Image, GIF or video"
        />
        <p style={adminFieldHint}>
          The section renders nothing at all until this is set, so an empty one is
          invisible on the public page rather than an empty frame.
        </p>
      </div>

      <div>
        <label style={adminLabel}>Eyebrow (optional)</label>
        <input
          type="text"
          value={eyebrow}
          placeholder="Small caps label above the heading"
          onChange={(e) => patch({ eyebrow: e.target.value })}
          style={adminInput}
        />
      </div>

      <div>
        <label style={adminLabel}>Heading (optional)</label>
        <input
          type="text"
          value={heading}
          placeholder="Leave both empty for the asset on its own"
          onChange={(e) => patch({ heading: e.target.value })}
          style={adminInput}
        />
      </div>

      <div>
        <span style={adminLabel}>Width</span>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
          {WIDTHS.map((w) => {
            const active = width === w.value;
            return (
              <button
                key={w.value}
                type="button"
                title={w.hint}
                onClick={() => patch({ width: w.value })}
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
                {w.label}
              </button>
            );
          })}
        </div>
        <p style={{ margin: '6px 0 0', fontSize: 11, color: ADMIN_COLORS.textMicro }}>
          {WIDTHS.find((w) => w.value === width)?.hint}
        </p>
      </div>

      {/* Width caps the frame, height caps the asset inside it. Together they
          are how a portrait clip is kept to a sensible size on a wide page. */}
      <MediaHeightControl content={content} onChange={patch} />

      <div>
        <label style={adminLabel}>Caption (optional)</label>
        <input
          type="text"
          value={caption}
          placeholder="Shown under the frame in small caps"
          onChange={(e) => patch({ media_caption: e.target.value })}
          style={adminInput}
        />
      </div>
    </div>
  );
}
