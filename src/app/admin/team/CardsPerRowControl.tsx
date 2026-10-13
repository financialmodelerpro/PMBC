'use client';

import { useCallback, useEffect, useState } from 'react';

import { ADMIN_COLORS, adminCard, adminFieldHint } from '@/lib/admin/styles';

type PerRow = 2 | 3;

/**
 * Member cards per row on /team at desktop width, saved at once.
 *
 * The value is a site setting (`team_cards_per_row`), so like the testimonial
 * form switch it is admin only: an editor's settings read is refused with a
 * 403 and the control is not offered.
 */
export function CardsPerRowControl() {
  const [perRow, setPerRow] = useState<PerRow | null>(null);
  const [canEdit, setCanEdit] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/settings');
      if (res.status === 403) {
        setCanEdit(false);
        return;
      }
      const json = (await res.json()) as {
        settings?: Record<string, unknown>;
        row?: { settings?: Record<string, unknown> };
        error?: string;
      };
      const settings = json.settings ?? json.row?.settings ?? {};
      setPerRow(settings.team_cards_per_row === 2 ? 2 : 3);
      if (json.error) setError(json.error);
    } catch {
      setError('Could not read the setting.');
      setPerRow(3);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function choose(next: PerRow) {
    if (next === perRow) return;
    setBusy(true);
    setError(null);
    setPerRow(next);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team_cards_per_row: next }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? 'Could not save the setting.');
        await load();
      }
    } catch {
      setError('Could not reach the server.');
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (!canEdit) return null;

  return (
    <div style={{ ...adminCard, marginBottom: 18, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
      <div style={{ flex: '1 1 280px' }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: ADMIN_COLORS.textHeading }}>
          Cards per row on /team
        </p>
        <p style={{ ...adminFieldHint, marginTop: 4 }}>
          On desktop screens. Phones show one card per row and tablets two, either way. The founding
          partner&rsquo;s card stays full width above the others. Saved as soon as you choose.
        </p>
        {error && <p style={{ margin: '8px 0 0', fontSize: 12, color: ADMIN_COLORS.danger }}>{error}</p>}
      </div>
      <div
        role="radiogroup"
        aria-label="Cards per row on /team"
        style={{
          display: 'inline-flex',
          border: `1px solid ${ADMIN_COLORS.borderInput}`,
          borderRadius: 8,
          overflow: 'hidden',
          opacity: busy || perRow === null ? 0.6 : 1,
        }}
      >
        {([2, 3] as const).map((n, i) => {
          const active = perRow === n;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={busy || perRow === null}
              onClick={() => choose(n)}
              style={{
                padding: '7px 16px',
                fontSize: 13,
                fontWeight: 600,
                border: 'none',
                borderLeft: i > 0 ? `1px solid ${ADMIN_COLORS.borderInput}` : 'none',
                background: active ? ADMIN_COLORS.textHeading : '#fff',
                color: active ? '#fff' : ADMIN_COLORS.textHeading,
                cursor: busy ? 'default' : 'pointer',
              }}
            >
              {n} per row
            </button>
          );
        })}
      </div>
    </div>
  );
}
