'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import { ExternalLink, RefreshCw, Save, X } from 'lucide-react';

import {
  ADMIN_COLORS,
  adminButtonGhost,
  adminButtonPrimary,
  adminButtonPrimaryDisabled,
  adminInput,
  adminLabel,
} from '@/lib/admin/styles';
import { SaveStatus, type SaveState } from '@/components/admin/SaveStatus';

import type { OgPagePreview } from './page';

type RowState = {
  override: string;
  saveState: SaveState;
  errMsg?: string;
  cacheBust: number;
};

type Props = {
  firmPages: OgPagePreview[];
  servicePages: OgPagePreview[];
};

export function OgPreviewBoard({ firmPages, servicePages }: Props) {
  const allPages = useMemo(() => [...firmPages, ...servicePages], [firmPages, servicePages]);

  const [state, setState] = useState<Record<string, RowState>>(() => {
    const out: Record<string, RowState> = {};
    for (const p of allPages) {
      out[p.slug] = {
        override: p.storedOgImageUrl ?? '',
        saveState: 'idle',
        cacheBust: 0,
      };
    }
    return out;
  });

  const update = (slug: string, patch: Partial<RowState>) => {
    setState((s) => ({ ...s, [slug]: { ...s[slug], ...patch } }));
  };

  const save = async (page: OgPagePreview, override: string) => {
    update(page.slug, { saveState: 'saving', errMsg: undefined });
    try {
      const res = await fetch('/api/admin/pages/og-image', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          slug: page.slug,
          og_image_url: override.trim() === '' ? '' : override.trim(),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Save failed');
      }
      update(page.slug, { saveState: 'saved', cacheBust: Date.now() });
      setTimeout(() => update(page.slug, { saveState: 'idle' }), 2200);
    } catch (e) {
      update(page.slug, {
        saveState: 'error',
        errMsg: (e as Error).message,
      });
    }
  };

  const clearOverride = (page: OgPagePreview) => {
    update(page.slug, { override: '' });
    void save(page, '');
  };

  const refresh = (slug: string) => {
    update(slug, { cacheBust: Date.now() });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <Group title="Firm pages" pages={firmPages} state={state} onChange={update} onSave={save} onClear={clearOverride} onRefresh={refresh} />
      <Group title="Service detail pages" pages={servicePages} state={state} onChange={update} onSave={save} onClear={clearOverride} onRefresh={refresh} />
    </div>
  );
}

function Group({
  title,
  pages,
  state,
  onChange,
  onSave,
  onClear,
  onRefresh,
}: {
  title: string;
  pages: OgPagePreview[];
  state: Record<string, RowState>;
  onChange: (slug: string, patch: Partial<RowState>) => void;
  onSave: (page: OgPagePreview, override: string) => Promise<void>;
  onClear: (page: OgPagePreview) => void;
  onRefresh: (slug: string) => void;
}) {
  if (pages.length === 0) return null;
  return (
    <div>
      <div
        style={{
          margin: '0 0 14px',
          paddingBottom: 8,
          borderBottom: `1px solid ${ADMIN_COLORS.border}`,
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: ADMIN_COLORS.textMuted,
          }}
        >
          {title}
        </p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {pages.map((p) => (
          <Row
            key={p.slug}
            page={p}
            state={state[p.slug]}
            onChange={(patch) => onChange(p.slug, patch)}
            onSave={() => onSave(p, state[p.slug].override)}
            onClear={() => onClear(p)}
            onRefresh={() => onRefresh(p.slug)}
          />
        ))}
      </div>
    </div>
  );
}

function Row({
  page,
  state,
  onChange,
  onSave,
  onClear,
  onRefresh,
}: {
  page: OgPagePreview;
  state: RowState;
  onChange: (patch: Partial<RowState>) => void;
  onSave: () => void;
  onClear: () => void;
  onRefresh: () => void;
}) {
  const hasOverride = state.override.trim().length > 0;
  const previewSrc = hasOverride
    ? state.override
    : `/api/og?title=${encodeURIComponent(page.ogTitle)}&subtitle=${encodeURIComponent(page.ogSubtitle)}&v=${state.cacheBust}`;

  const cardStyle: CSSProperties = {
    background: '#FFFFFF',
    border: `1px solid ${ADMIN_COLORS.border}`,
    borderRadius: 12,
    padding: 20,
    display: 'grid',
    gridTemplateColumns: 'minmax(360px, 480px) minmax(0, 1fr)',
    gap: 22,
    alignItems: 'start',
  };

  return (
    <div style={cardStyle}>
      <div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={previewSrc}
          alt={`OG preview for ${page.label}`}
          width={1200}
          height={630}
          style={{
            width: '100%',
            height: 'auto',
            aspectRatio: '1200 / 630',
            background: '#0F2540',
            borderRadius: 8,
            border: `1px solid ${ADMIN_COLORS.border}`,
            display: 'block',
          }}
        />
        <div
          style={{
            marginTop: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <span style={{ fontSize: 11, color: ADMIN_COLORS.textMicro }}>
            {hasOverride ? 'Override URL preview' : 'Auto-generated via /api/og'}
          </span>
          {!hasOverride && (
            <button
              type="button"
              onClick={onRefresh}
              aria-label="Refresh preview"
              title="Refresh preview"
              style={{ ...adminButtonGhost, padding: '4px 10px', fontSize: 11 }}
            >
              <RefreshCw size={11} /> Refresh
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
        <div>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              fontWeight: 700,
              color: ADMIN_COLORS.textHeading,
            }}
          >
            {page.label}
          </p>
          <p
            style={{
              margin: '2px 0 0',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontSize: 11,
              color: ADMIN_COLORS.textMuted,
            }}
          >
            slug: {page.slug}
          </p>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            background: ADMIN_COLORS.altBg,
            border: `1px solid ${ADMIN_COLORS.borderSoft}`,
            borderRadius: 8,
            padding: '10px 12px',
          }}
        >
          <p style={{ margin: 0, fontSize: 11, color: ADMIN_COLORS.textMuted }}>
            Auto-generated card content
          </p>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              fontWeight: 600,
              color: ADMIN_COLORS.textHeading,
            }}
          >
            {page.ogTitle}
          </p>
          {page.ogSubtitle && (
            <p
              style={{
                margin: 0,
                fontSize: 12,
                color: ADMIN_COLORS.textBody,
              }}
            >
              {page.ogSubtitle}
            </p>
          )}
        </div>

        <label style={{ display: 'block' }}>
          <span style={adminLabel}>Override URL (optional)</span>
          <input
            type="text"
            value={state.override}
            placeholder="https://… (leave blank to auto-generate)"
            onChange={(e) => onChange({ override: e.target.value })}
            style={adminInput}
          />
        </label>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <SaveStatus state={state.saveState} message={state.errMsg} />
            <a
              href={page.publicUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                ...adminButtonGhost,
                textDecoration: 'none',
                padding: '6px 12px',
                fontSize: 12,
              }}
            >
              <ExternalLink size={12} /> View page
            </a>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {hasOverride && (
              <button
                type="button"
                onClick={onClear}
                disabled={state.saveState === 'saving'}
                style={{ ...adminButtonGhost, padding: '7px 12px' }}
              >
                <X size={12} /> Clear override
              </button>
            )}
            <button
              type="button"
              onClick={onSave}
              disabled={state.saveState === 'saving'}
              style={
                state.saveState === 'saving'
                  ? { ...adminButtonPrimaryDisabled, padding: '7px 16px' }
                  : { ...adminButtonPrimary, padding: '7px 16px' }
              }
            >
              <Save size={12} />
              {state.saveState === 'saving' ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
