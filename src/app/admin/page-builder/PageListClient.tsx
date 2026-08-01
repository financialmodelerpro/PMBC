'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowUpRight, Lock, Plus, Trash2, X } from 'lucide-react';

import { SaveButton } from '@/components/admin/SaveButton';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import {
  ADMIN_COLORS,
  adminBadge,
  adminButtonGhost,
  adminInput,
  adminLabel,
  adminTable,
  adminTd,
  adminTh,
  adminThead,
} from '@/lib/admin/styles';
import {
  PAGE_TEMPLATES,
  SLUG_RX,
  slugFromTitle,
  type TemplateId,
} from '@/lib/cms/pageTemplates';

export type PageRow = {
  id: string;
  slug: string;
  title: string;
  status: string;
  is_system: boolean;
  updated_at: string | null;
  section_count: number;
};

function formatDate(iso: string | null): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function PageListClient({ pages }: { pages: PageRow[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PageRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const existingSlugs = useMemo(() => new Set(pages.map((p) => p.slug)), [pages]);

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    setListError(null);
    try {
      const res = await fetch('/api/admin/page-sections', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'delete_page', slug: pendingDelete.slug }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? 'Delete failed');
      setPendingDelete(null);
      router.refresh();
    } catch (e) {
      setListError((e as Error).message);
      setPendingDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          marginBottom: 14,
        }}
      >
        <SaveButton type="button" onClick={() => setCreating(true)}>
          <Plus size={15} /> New Page
        </SaveButton>
      </div>

      {listError && (
        <div
          style={{
            ...adminBadge('danger'),
            display: 'block',
            padding: '10px 14px',
            borderRadius: 8,
            marginBottom: 12,
          }}
        >
          {listError}
        </div>
      )}

      <div
        style={{
          background: '#FFFFFF',
          border: `1px solid ${ADMIN_COLORS.border}`,
          borderRadius: 12,
          overflow: 'hidden',
        }}
      >
        <table style={adminTable}>
          <thead style={adminThead}>
            <tr>
              <th style={adminTh}>Slug</th>
              <th style={adminTh}>Title</th>
              <th style={adminTh}>Status</th>
              <th style={adminTh}>Sections</th>
              <th style={adminTh}>Last updated</th>
              <th style={{ ...adminTh, textAlign: 'right' }}>Open</th>
              <th style={{ ...adminTh, textAlign: 'right', width: 70 }} />
            </tr>
          </thead>
          <tbody>
            {pages.map((p, i) => {
              const last = i === pages.length - 1;
              const cell = last ? { ...adminTd, borderBottom: 'none' } : adminTd;
              return (
                <tr key={p.id}>
                  <td
                    style={{
                      ...cell,
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                      color: ADMIN_COLORS.textHeading,
                    }}
                  >
                    {p.slug}
                  </td>
                  <td style={{ ...cell, color: ADMIN_COLORS.textHeading }}>{p.title}</td>
                  <td style={cell}>
                    <span
                      style={
                        p.status === 'published'
                          ? adminBadge('success')
                          : adminBadge('neutral')
                      }
                    >
                      {p.status}
                    </span>
                  </td>
                  <td style={cell}>{p.section_count}</td>
                  <td style={cell}>{formatDate(p.updated_at)}</td>
                  <td style={{ ...cell, textAlign: 'right' }}>
                    <Link
                      href={`/admin/page-builder/${p.slug}`}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '6px 12px',
                        border: `1px solid ${ADMIN_COLORS.border}`,
                        borderRadius: 7,
                        fontSize: 12,
                        fontWeight: 600,
                        color: ADMIN_COLORS.primaryDeep,
                        textDecoration: 'none',
                      }}
                    >
                      Builder
                      <ArrowUpRight size={13} />
                    </Link>
                  </td>
                  <td style={{ ...cell, textAlign: 'right' }}>
                    {p.is_system ? (
                      <span
                        title="System page. Backs a hand-built public route, so it cannot be deleted here."
                        aria-label="System page, cannot be deleted"
                        style={{
                          display: 'inline-flex',
                          width: 30,
                          height: 30,
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: ADMIN_COLORS.textMicro,
                        }}
                      >
                        <Lock size={14} />
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setPendingDelete(p)}
                        title={`Delete ${p.title}`}
                        aria-label={`Delete ${p.title}`}
                        style={{
                          display: 'inline-flex',
                          width: 30,
                          height: 30,
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: '#FFFFFF',
                          border: `1px solid ${ADMIN_COLORS.border}`,
                          borderRadius: 6,
                          color: ADMIN_COLORS.danger,
                          cursor: 'pointer',
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {creating && (
        <NewPageDialog
          existingSlugs={existingSlugs}
          onClose={() => setCreating(false)}
          onCreated={(slug) => router.push(`/admin/page-builder/${slug}`)}
        />
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title={pendingDelete ? `Delete page "${pendingDelete.title}"?` : 'Delete page?'}
        body={
          pendingDelete
            ? `This cannot be undone. All ${pendingDelete.section_count} section${
                pendingDelete.section_count === 1 ? '' : 's'
              } on this page will be removed too.`
            : ''
        }
        confirmLabel={deleting ? 'Deleting…' : 'Delete'}
        destructive
        onConfirm={handleDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
}

function NewPageDialog({
  existingSlugs,
  onClose,
  onCreated,
}: {
  existingSlugs: Set<string>;
  onClose: () => void;
  onCreated: (slug: string) => void;
}) {
  const [title, setTitle] = useState('');
  // Once the admin edits the slug by hand, stop overwriting it from the title.
  const [slugTouched, setSlugTouched] = useState(false);
  const [slug, setSlug] = useState('');
  const [template, setTemplate] = useState<TemplateId>('blank');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveSlug = slugTouched ? slug : slugFromTitle(title);

  const slugProblem = (() => {
    if (!effectiveSlug) return 'A slug is required';
    if (!SLUG_RX.test(effectiveSlug))
      return 'Use lowercase letters, numbers and hyphens only';
    if (existingSlugs.has(effectiveSlug)) return `The slug "${effectiveSlug}" is taken`;
    return null;
  })();

  const canCreate = title.trim().length > 0 && !slugProblem;

  const submit = async () => {
    if (!canCreate) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/page-sections', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'create_page',
          title: title.trim(),
          slug: effectiveSlug,
          template,
          status: 'draft',
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? 'Could not create page');
      onCreated(effectiveSlug);
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Create a new page"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        background: 'rgba(15,37,64,0.5)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: 24,
        overflowY: 'auto',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 620,
          marginTop: 40,
          background: '#FFFFFF',
          borderRadius: 12,
          border: `1px solid ${ADMIN_COLORS.border}`,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 20px',
            borderBottom: `1px solid ${ADMIN_COLORS.border}`,
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 15,
              fontWeight: 800,
              color: ADMIN_COLORS.textHeading,
            }}
          >
            New page
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              display: 'inline-flex',
              width: 30,
              height: 30,
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              border: 'none',
              color: ADMIN_COLORS.textMuted,
              cursor: 'pointer',
            }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <label>
            <span style={adminLabel}>Title</span>
            <input
              type="text"
              value={title}
              autoFocus
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Insights hub"
              style={adminInput}
            />
          </label>

          <label>
            <span style={adminLabel}>Slug</span>
            <input
              type="text"
              value={effectiveSlug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value);
              }}
              placeholder="insights-hub"
              style={{
                ...adminInput,
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                borderColor: slugProblem && (title || slugTouched)
                  ? ADMIN_COLORS.danger
                  : ADMIN_COLORS.borderInput,
              }}
            />
            {slugProblem && (title || slugTouched) ? (
              <p style={{ margin: '6px 0 0', fontSize: 11, color: ADMIN_COLORS.danger }}>
                {slugProblem}
              </p>
            ) : (
              <p style={{ margin: '6px 0 0', fontSize: 11, color: ADMIN_COLORS.textMicro }}>
                The public URL will be /{effectiveSlug || 'your-slug'}. Auto-filled from the
                title until you edit it.
              </p>
            )}
          </label>

          <div>
            <span style={adminLabel}>Template</span>
            <div style={{ display: 'grid', gap: 8 }}>
              {PAGE_TEMPLATES.map((t) => {
                const active = template === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTemplate(t.id)}
                    aria-pressed={active}
                    style={{
                      textAlign: 'left',
                      padding: '10px 14px',
                      borderRadius: 8,
                      border: `1px solid ${active ? ADMIN_COLORS.primary : ADMIN_COLORS.border}`,
                      boxShadow: active ? '0 0 0 2px rgba(27,58,95,0.16)' : 'none',
                      background: active ? '#F7FAFF' : '#FFFFFF',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    <span
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 10,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: ADMIN_COLORS.textHeading,
                        }}
                      >
                        {t.label}
                      </span>
                      <span style={{ fontSize: 11, color: ADMIN_COLORS.textMuted }}>
                        {t.sections.length === 0
                          ? 'no sections'
                          : `${t.sections.length} sections`}
                      </span>
                    </span>
                    <span
                      style={{
                        display: 'block',
                        marginTop: 3,
                        fontSize: 11.5,
                        color: ADMIN_COLORS.textMuted,
                        lineHeight: 1.5,
                      }}
                    >
                      {t.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <p style={{ margin: 0, fontSize: 11, color: ADMIN_COLORS.textMicro }}>
            The page is created as a draft. Publish it from the builder once the content is
            ready.
          </p>

          {error && (
            <div
              style={{
                ...adminBadge('danger'),
                display: 'block',
                padding: '10px 14px',
                borderRadius: 8,
              }}
            >
              {error}
            </div>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 10,
            padding: '14px 20px',
            borderTop: `1px solid ${ADMIN_COLORS.border}`,
            background: ADMIN_COLORS.altBg,
          }}
        >
          <button type="button" onClick={onClose} disabled={saving} style={adminButtonGhost}>
            Cancel
          </button>
          <SaveButton
            type="button"
            onClick={submit}
            saving={saving}
            disabled={!canCreate}
          >
            {saving ? 'Creating…' : 'Create page'}
          </SaveButton>
        </div>
      </div>
    </div>
  );
}
