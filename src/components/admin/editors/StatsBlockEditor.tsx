'use client';

import { Plus, Trash2 } from 'lucide-react';

import type { SectionEditorProps } from './types';

type Stat = { value: string; label: string };

const inputCls =
  'block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-[14px] text-[#0F1B2D] outline-none focus:border-[#1B3A5F] focus:ring-2 focus:ring-[#1B3A5F]/15';

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
    <div className="space-y-5">
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-[#0F2540]">
          Intro (optional)
        </span>
        <textarea
          value={intro}
          onChange={(e) => setIntro(e.target.value)}
          rows={2}
          className={inputCls + ' resize-y'}
        />
      </label>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-medium text-[#0F2540]">Stats</p>
          <button
            type="button"
            onClick={addRow}
            className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium text-[#0F2540] hover:border-[#1B3A5F] hover:text-[#1B3A5F]"
          >
            <Plus className="h-3.5 w-3.5" />
            Add stat
          </button>
        </div>

        <div className="space-y-2">
          {stats.length === 0 && (
            <p className="text-xs text-neutral-500">No stats yet.</p>
          )}
          {stats.map((row, i) => (
            <div key={i} className="grid grid-cols-[140px_1fr_auto] items-center gap-2">
              <input
                type="text"
                value={row.value}
                onChange={(e) => update(i, { value: e.target.value })}
                placeholder="Value (100+)"
                className={inputCls}
              />
              <input
                type="text"
                value={row.label}
                onChange={(e) => update(i, { label: e.target.value })}
                placeholder="Label"
                className={inputCls}
              />
              <button
                type="button"
                onClick={() => removeRow(i)}
                aria-label="Remove stat"
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-neutral-200 text-neutral-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
