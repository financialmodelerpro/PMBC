'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, ImagePlus } from 'lucide-react';

import { MediaField } from '@/components/admin/MediaField';
import { MediaHeightControl } from '@/components/admin/MediaHeightControl';
import { ADMIN_COLORS, adminInput, adminLabel } from '@/lib/admin/styles';
import { readPosition, type MediaPosition } from '@/lib/cms/sectionMedia';

// Left and right first, since beside the text is the default and the common
// choice. Both describe the column split, so the operator knows the media does
// not take the full width.
const POSITIONS: { value: MediaPosition; label: string; hint: string }[] = [
  { value: 'left', label: 'Left', hint: 'Beside the text, media in the left column' },
  { value: 'right', label: 'Right', hint: 'Beside the text, media in the right column' },
  { value: 'above', label: 'Above', hint: 'Full width, before the section content' },
  { value: 'below', label: 'Below', hint: 'Full width, after the section content' },
];

function s(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

/**
 * Optional media for any section type, in one shared panel.
 *
 * Mounted next to the StyleEditor rather than inside each content editor, for
 * the same reason styles are: the fields live on a fixed set of keys that every
 * section type understands, so wiring them into fifteen separate editors would
 * be fifteen chances to diverge.
 *
 * Collapsed by default. A section with no media should look untouched in the
 * builder, exactly as it does on the public page.
 */
export function SectionMediaPanel({
  content,
  onChange,
}: {
  content: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}) {
  const hasMedia = s(content.media_url).trim() !== '';
  const [open, setOpen] = useState(hasMedia);

  // Shared with the renderer rather than restated, so the highlighted button
  // always matches what the public page actually does with an unset value.
  const position = readPosition(content.media_position);
  const caption = s(content.media_caption);

  const patch = (p: Record<string, unknown>) => onChange({ ...content, ...p });

  return (
    <section
      style={{
        background: '#FFFFFF',
        border: `1px solid ${ADMIN_COLORS.border}`,
        borderRadius: 12,
        marginTop: 16,
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          padding: '14px 16px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'inherit',
          fontSize: 13,
          fontWeight: 700,
          color: ADMIN_COLORS.textHeading,
          textAlign: 'left',
        }}
      >
        {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        <ImagePlus size={15} />
        Media
        <span
          style={{
            marginLeft: 'auto',
            fontSize: 11,
            fontWeight: 600,
            color: hasMedia ? ADMIN_COLORS.primary : ADMIN_COLORS.textMicro,
          }}
        >
          {hasMedia ? 'Set' : 'Optional, none set'}
        </span>
      </button>

      {open && (
        <div style={{ padding: '0 16px 18px' }}>
          <p style={{ margin: '0 0 14px', fontSize: 12, color: ADMIN_COLORS.textMuted }}>
            An optional image, GIF or video for this section. Leave it empty and
            the section renders exactly as it does now, with no gap or
            placeholder.
          </p>

          <MediaField
            content={content}
            urlKey="media_url"
            onChange={patch}
            label="Section media"
            hint="Image, GIF or video"
          />

          <div style={{ marginTop: 16 }}>
            <span style={adminLabel}>Position</span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
              {POSITIONS.map((p) => {
                const active = position === p.value;
                return (
                  <button
                    key={p.value}
                    type="button"
                    title={p.hint}
                    onClick={() => patch({ media_position: p.value })}
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
                  </button>
                );
              })}
            </div>
            <p style={{ margin: '6px 0 0', fontSize: 11, color: ADMIN_COLORS.textMicro }}>
              {POSITIONS.find((p) => p.value === position)?.hint}
              {position === 'left' || position === 'right'
                ? ' Two columns from 1024px wide, roughly 55% text to 45% media. Below that the section stacks and the media follows the text. The preview pane here is narrower than 1024px, so open the preview in a new tab to see the two columns.'
                : ' The media spans the full content width.'}
            </p>
          </div>

          <div style={{ marginTop: 16 }}>
            <MediaHeightControl content={content} onChange={patch} />
          </div>

          <label style={{ display: 'block', marginTop: 16 }}>
            <span style={adminLabel}>Caption (optional)</span>
            <input
              type="text"
              value={caption}
              onChange={(e) => patch({ media_caption: e.target.value })}
              placeholder="Shown under the frame in small caps"
              style={adminInput}
            />
          </label>
        </div>
      )}
    </section>
  );
}
