'use client';

import { Plus, X } from 'lucide-react';

import {
  ADMIN_COLORS,
  adminButtonGhost,
  adminFieldHint,
  adminInput,
  adminLabel,
} from '@/lib/admin/styles';

import type { SectionEditorProps } from './types';

function s(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

const DISPLAYS = [
  { value: 'numbered', label: 'Numbered list', hint: 'Gold numerals, one item per row' },
  { value: 'pills', label: 'Pills', hint: 'Wrapping tags, good for many short items' },
  { value: 'cards', label: 'Cards', hint: 'Two-column bordered cards with a gold dot' },
];

export function FounderCredentialsEditor({ content, onChange }: SectionEditorProps) {
  const items = Array.isArray(content.items)
    ? content.items.map((i) => (typeof i === 'string' ? i : ''))
    : [];
  const display = s(content.display) || 'numbered';
  const set = (key: string, value: unknown) => onChange({ ...content, [key]: value });
  const setItems = (next: string[]) => set('items', next);

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div>
        <label style={adminLabel}>Heading</label>
        <input
          type="text"
          value={s(content.heading)}
          placeholder="Expertise Areas"
          onChange={(e) => set('heading', e.target.value)}
          style={adminInput}
        />
      </div>

      <div>
        <label style={adminLabel}>Intro (optional)</label>
        <input
          type="text"
          value={s(content.intro)}
          onChange={(e) => set('intro', e.target.value)}
          style={adminInput}
        />
      </div>

      <div>
        <label style={adminLabel}>Presentation</label>
        <select
          value={display}
          onChange={(e) => set('display', e.target.value)}
          style={adminInput}
        >
          {DISPLAYS.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
        <p style={adminFieldHint}>
          {DISPLAYS.find((d) => d.value === display)?.hint ?? ''}
        </p>
      </div>

      <div>
        <label style={adminLabel}>Items ({items.length})</label>
        <div style={{ display: 'grid', gap: 6 }}>
          {items.map((item, i) => (
            <div key={i} style={{ display: 'flex', gap: 6 }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  minWidth: 24,
                  fontSize: 12,
                  color: ADMIN_COLORS.textMicro,
                }}
              >
                {i + 1}
              </span>
              <input
                type="text"
                value={item}
                onChange={(e) => {
                  const next = [...items];
                  next[i] = e.target.value;
                  setItems(next);
                }}
                style={adminInput}
              />
              <button
                type="button"
                aria-label={`Remove item ${i + 1}`}
                onClick={() => setItems(items.filter((_, j) => j !== i))}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 28,
                  height: 28,
                  flexShrink: 0,
                  borderRadius: 6,
                  border: `1px solid ${ADMIN_COLORS.border}`,
                  background: '#fff',
                  color: ADMIN_COLORS.textMuted,
                  cursor: 'pointer',
                }}
              >
                <X size={14} />
              </button>
            </div>
          ))}
          <button
            type="button"
            style={{ ...adminButtonGhost, justifySelf: 'start' }}
            onClick={() => setItems([...items, ''])}
          >
            <Plus size={14} /> Add item
          </button>
        </div>
        <p style={adminFieldHint}>Blank items are dropped when the page renders.</p>
      </div>
    </div>
  );
}
