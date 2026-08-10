'use client';

import {
  ADMIN_COLORS,
  adminInput,
  adminLabel,
  adminTextarea,
} from '@/lib/admin/styles';
import { RichTextarea } from '@/components/admin/RichTextarea';
import { MediaField } from '@/components/admin/MediaField';

import type { SectionEditorProps } from './types';

function s(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

export function QuoteEditor({ content, onChange }: SectionEditorProps) {
  const quote_text = s(content.quote_text) || s(content.quote);
  const attribution_name = s(content.attribution_name) || s(content.attribution);
  const attribution_role = s(content.attribution_role);
  const attribution_photo_url = s(content.attribution_photo_url);
  const alignment = content.alignment === 'left' ? 'left' : 'center';

  const update = (patch: Record<string, unknown>) => {
    const { quote: _q, attribution: _a, ...rest } = content;
    void _q;
    void _a;
    onChange({
      ...rest,
      quote_text,
      attribution_name,
      attribution_role,
      attribution_photo_url,
      alignment,
      ...patch,
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <Field label="Quote text">
        <RichTextarea
          value={quote_text}
          onChange={(html) => update({ quote_text: html })}
          minHeight={72}
        />
      </Field>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Attribution name">
          <input
            type="text"
            value={attribution_name}
            onChange={(e) => update({ attribution_name: e.target.value })}
            style={adminInput}
          />
        </Field>
        <Field label="Attribution role">
          <input
            type="text"
            value={attribution_role}
            onChange={(e) => update({ attribution_role: e.target.value })}
            style={adminInput}
          />
        </Field>
      </div>

      <MediaField
        content={content}
        urlKey="attribution_photo_url"
        onChange={(patch) => update(patch)}
        label="Attribution photo (optional)"
        bucket="team-photos"
      />

      <Field label="Alignment">
        <div style={{ display: 'flex', gap: 8 }}>
          {(['center', 'left'] as const).map((option) => {
            const active = alignment === option;
            return (
              <button
                key={option}
                type="button"
                onClick={() => update({ alignment: option })}
                style={{
                  padding: '6px 14px',
                  borderRadius: 7,
                  fontSize: 12,
                  fontWeight: 700,
                  textTransform: 'capitalize',
                  border: `1px solid ${active ? ADMIN_COLORS.primary : ADMIN_COLORS.borderInput}`,
                  background: active ? ADMIN_COLORS.primary : '#FFFFFF',
                  color: active ? '#FFFFFF' : ADMIN_COLORS.primaryDeep,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {option}
              </button>
            );
          })}
        </div>
      </Field>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={adminLabel}>{label}</span>
      {children}
    </label>
  );
}
