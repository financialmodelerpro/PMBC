'use client';

import { Plus, Trash2 } from 'lucide-react';

import { RichTextEditor } from '@/components/admin/RichTextEditor';
import { ADMIN_COLORS, adminButtonGhost, adminFieldHint, adminInput, adminLabel } from '@/lib/admin/styles';

import type { SectionEditorProps } from './types';

type Item = { title: string; description: string };

function s(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function readItems(raw: unknown): Item[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((r) =>
    typeof r === 'string'
      ? { title: r, description: '' }
      : {
          title: s((r as Record<string, unknown>)?.title),
          description: s((r as Record<string, unknown>)?.description),
        },
  );
}

export function ProseChecklistEditor({ content, onChange }: SectionEditorProps) {
  const items = readItems(content.items);
  const patch = (p: Record<string, unknown>) => onChange({ ...content, ...p });
  const setItems = (next: Item[]) => patch({ items: next });

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div>
        <label style={adminLabel}>Eyebrow (optional)</label>
        <input
          type="text"
          value={s(content.eyebrow)}
          onChange={(e) => patch({ eyebrow: e.target.value })}
          style={adminInput}
        />
      </div>

      <div>
        <label style={adminLabel}>Heading</label>
        <input
          type="text"
          value={s(content.heading)}
          onChange={(e) => patch({ heading: e.target.value })}
          style={adminInput}
        />
      </div>

      <div>
        <p style={adminLabel}>Left column, prose</p>
        <RichTextEditor
          value={s(content.html)}
          onChange={(next) => patch({ html: next })}
          ariaLabel="Prose column editor"
          minHeight={240}
        />
      </div>

      <div>
        <label style={adminLabel}>Right column heading (optional)</label>
        <input
          type="text"
          value={s(content.list_heading)}
          onChange={(e) => patch({ list_heading: e.target.value })}
          placeholder="Shown in small caps above the checklist"
          style={adminInput}
        />
      </div>

      <div>
        <p style={adminLabel}>Checklist items</p>
        <p style={adminFieldHint}>
          Each renders with a gold tick. The description is optional and sits under
          the title.
        </p>
        <div style={{ display: 'grid', gap: 10, marginTop: 8 }}>
          {items.map((item, i) => (
            <div
              key={i}
              style={{
                border: `1px solid ${ADMIN_COLORS.border}`,
                borderRadius: 8,
                padding: 12,
                display: 'grid',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="text"
                  value={item.title}
                  placeholder="Item title"
                  onChange={(e) => {
                    const next = [...items];
                    next[i] = { ...item, title: e.target.value };
                    setItems(next);
                  }}
                  style={{ ...adminInput, flex: 1 }}
                />
                <button
                  type="button"
                  onClick={() => setItems(items.filter((_, j) => j !== i))}
                  style={{ ...adminButtonGhost, color: ADMIN_COLORS.danger }}
                  aria-label={`Remove item ${i + 1}`}
                >
                  <Trash2 size={13} />
                </button>
              </div>
              <input
                type="text"
                value={item.description}
                placeholder="Description (optional)"
                onChange={(e) => {
                  const next = [...items];
                  next[i] = { ...item, description: e.target.value };
                  setItems(next);
                }}
                style={adminInput}
              />
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setItems([...items, { title: '', description: '' }])}
          style={{ ...adminButtonGhost, marginTop: 10 }}
        >
          <Plus size={13} /> Add item
        </button>
      </div>
    </div>
  );
}
