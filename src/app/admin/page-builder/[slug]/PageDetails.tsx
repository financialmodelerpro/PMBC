'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

import { SaveButton } from '@/components/admin/SaveButton';
import {
  ADMIN_COLORS,
  adminFieldHint,
  adminInput,
  adminLabel,
  adminTextarea,
} from '@/lib/admin/styles';

/**
 * The page's own row: the title the console lists it under, and the two fields
 * that decide what a search result and a shared link say.
 *
 * Both metadata fields have been columns on `cms_pages` since migration 002 and
 * were only ever set by writing a migration, while every public route reads
 * them through `buildPageMetadata`. This is the missing editor for them.
 *
 * Collapsed by default. It is page-level and rarely touched, and the sections
 * below are what an operator opens this screen for.
 *
 * Its own Save, matching the per-section save model: this writes `cms_pages`
 * and the section editors write `page_sections`, so one button that did both
 * would flush a half-finished section edit to save a title.
 */
export function PageDetails({
  pageSlug,
  initialTitle,
  initialMetaTitle,
  initialMetaDescription,
}: {
  pageSlug: string;
  initialTitle: string;
  initialMetaTitle: string;
  initialMetaDescription: string;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(initialTitle);
  const [metaTitle, setMetaTitle] = useState(initialMetaTitle);
  const [metaDescription, setMetaDescription] = useState(initialMetaDescription);
  const [saved, setSaved] = useState({
    title: initialTitle,
    metaTitle: initialMetaTitle,
    metaDescription: initialMetaDescription,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty =
    title !== saved.title ||
    metaTitle !== saved.metaTitle ||
    metaDescription !== saved.metaDescription;

  async function save() {
    if (!dirty || title.trim().length === 0) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/page-sections', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_page',
          slug: pageSlug,
          title: title.trim(),
          meta_title: metaTitle.trim(),
          meta_description: metaDescription.trim(),
        }),
      });
      const json = (await res.json()) as { page?: unknown; error?: string };
      if (!res.ok) {
        setError(json.error ?? 'Could not save the page details.');
        return;
      }
      setSaved({
        title: title.trim(),
        metaTitle: metaTitle.trim(),
        metaDescription: metaDescription.trim(),
      });
    } catch {
      setError('Could not reach the server.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        background: '#FFFFFF',
        borderBottom: `1px solid ${ADMIN_COLORS.border}`,
        padding: open ? '14px 20px 20px' : '10px 20px',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          background: 'transparent',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: ADMIN_COLORS.textMuted,
          fontFamily: 'inherit',
        }}
      >
        {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        Page details and search listing
        {dirty && (
          <span style={{ color: ADMIN_COLORS.warning, letterSpacing: 0, textTransform: 'none' }}>
            unsaved
          </span>
        )}
      </button>

      {open && (
        <div style={{ marginTop: 14, display: 'grid', gap: 16, maxWidth: 720 }}>
          <label style={{ display: 'block' }}>
            <span style={adminLabel}>Page title</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={adminInput}
            />
            <p style={adminFieldHint}>
              What this page is called in the console. Not shown on the public page.
            </p>
          </label>

          <label style={{ display: 'block' }}>
            <span style={adminLabel}>Meta title</span>
            <input
              type="text"
              value={metaTitle}
              onChange={(e) => setMetaTitle(e.target.value)}
              style={adminInput}
            />
            <p style={adminFieldHint}>
              The browser tab and the headline of a search result. Around 60 characters
              before Google truncates it, currently {metaTitle.trim().length}. Leave empty
              to use the wording the page ships with.
            </p>
          </label>

          <label style={{ display: 'block' }}>
            <span style={adminLabel}>Meta description</span>
            <textarea
              value={metaDescription}
              onChange={(e) => setMetaDescription(e.target.value)}
              rows={3}
              style={adminTextarea}
            />
            <p style={adminFieldHint}>
              The paragraph under the link in a search result, and the preview when the
              page is shared. Around 155 characters before truncation, currently{' '}
              {metaDescription.trim().length}. Leave empty to use the shipped wording.
            </p>
          </label>

          {error && (
            <p style={{ margin: 0, fontSize: 13, color: ADMIN_COLORS.danger }}>{error}</p>
          )}

          <div>
            <SaveButton
              type="button"
              onClick={save}
              saving={saving}
              disabled={!dirty || title.trim().length === 0}
            >
              {saving ? 'Saving...' : 'Save page details'}
            </SaveButton>
          </div>
        </div>
      )}
    </div>
  );
}
