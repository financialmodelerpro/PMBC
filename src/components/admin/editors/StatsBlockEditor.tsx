'use client';

import { Plus, Trash2 } from 'lucide-react';

import {
  ADMIN_COLORS,
  adminButtonGhost,
  adminButtonIcon,
  adminInput,
  adminLabel,
  adminTextarea,
} from '@/lib/admin/styles';

import type { SectionEditorProps } from './types';

type Stat = { value: string; label: string };

function s(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function pickStats(c: Record<string, unknown>): Stat[] {
  if (!Array.isArray(c.stats)) return [];
  return (c.stats as unknown[]).map((row) => {
    if (!row || typeof row !== 'object') return { value: '', label: '' };
    const o = row as Record<string, unknown>;
    return { value: s(o.value), label: s(o.label) };
  });
}

export function StatsBlockEditor({ content, onChange }: SectionEditorProps) {
  const intro = s(content.intro);
  const stats = pickStats(content);

  const setIntro = (next: string) => onChange({ ...content, intro: next, stats });
  const setStats = (next: Stat[]) => onChange({ ...content, intro, stats: next });

  const update = (i: number, patch: Partial<Stat>) =>
    setStats(stats.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));

  const addRow = () => setStats([...stats, { value: '', label: '' }]);
  const removeRow = (i: number) => setStats(stats.filter((_, idx) => idx !== i));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <label style={{ display: 'block' }}>
        <span style={adminLabel}>Intro (optional)</span>
        <textarea
          value={intro}
          onChange={(e) => setIntro(e.target.value)}
          rows={2}
          style={adminTextarea}
        />
      </label>

      <div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 8,
          }}
        >
          <p style={{ ...adminLabel, marginBottom: 0 }}>Stats</p>
          <button type="button" onClick={addRow} style={adminButtonGhost}>
            <Plus size={13} /> Add stat
          </button>
        </div>

        {stats.length === 0 ? (
          <p style={{ fontSize: 12, color: ADMIN_COLORS.textMuted }}>No stats yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {stats.map((row, i) => (
              <div
                key={i}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '140px 1fr auto',
                  gap: 8,
                  alignItems: 'center',
                }}
              >
                <input
                  type="text"
                  value={row.value}
                  onChange={(e) => update(i, { value: e.target.value })}
                  placeholder="Value (100+)"
                  style={adminInput}
                />
                <input
                  type="text"
                  value={row.label}
                  onChange={(e) => update(i, { label: e.target.value })}
                  placeholder="Label"
                  style={adminInput}
                />
                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  aria-label="Remove stat"
                  style={adminButtonIcon}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
