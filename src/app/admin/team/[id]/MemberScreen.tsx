'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowUpRight, Loader2, Plus, Trash2 } from 'lucide-react';

import { FieldInput, type FieldDef } from '@/components/admin/CollectionManager';
import { SaveButton } from '@/components/admin/SaveButton';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { useCanDelete } from '@/components/admin/AdminRoleProvider';
import { TeamProfileContext } from '@/components/admin/TeamProfileContext';
import {
  ADMIN_COLORS,
  adminButtonGhost,
  adminButtonPrimary,
  adminFieldHint,
  adminLabel,
} from '@/lib/admin/styles';
import { publicPathForPageSlug } from '@/lib/cms/pageRoutes';
import type { LocalSection } from '@/lib/cms/serializers';

import { PageBuilder } from '../../page-builder/[slug]/PageBuilder';
import { FOUNDER_BIO_FIELD, MEMBER_FIELDS } from '../fields';

type Member = Record<string, unknown> & { id: string };

type ProfilePage = {
  slug: string;
  title: string;
  status: string;
  metaTitle: string;
  metaDescription: string;
};

/**
 * Everything about one member on one screen.
 *
 *   1. Details: name, role, qualification, experience, location, photo and
 *      published. Written once; the /team card and the profile header both
 *      read them. Saved with this panel's own Save.
 *   2. Full profile: the profile page's sections, in the shared page builder
 *      (each section saves itself, as everywhere else). Inside it the header
 *      editor leaves out what panel 1 owns, and a list can be marked "Show on
 *      team card" to supply the card's highlights.
 *
 * A member with no profile yet gets a button that creates one.
 */
export function MemberScreen({
  member,
  canLinkProfile,
  isFounder,
  page,
  sections,
}: {
  member: Member;
  canLinkProfile: boolean;
  isFounder: boolean;
  page: ProfilePage | null;
  sections: LocalSection[];
}) {
  const router = useRouter();
  const canDelete = useCanDelete();
  const fields: FieldDef[] = isFounder ? [...MEMBER_FIELDS, FOUNDER_BIO_FIELD] : MEMBER_FIELDS;

  const [form, setForm] = useState<Record<string, unknown>>(member);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const name = String(form.name ?? '') || 'Team member';

  const set = (key: string, value: unknown) => {
    setForm((f) => ({ ...f, [key]: value }));
    setDirty(true);
    setSaved(false);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = { id: member.id };
      for (const f of fields) payload[f.key] = form[f.key];
      const res = await fetch('/api/admin/team', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Save failed');
      setDirty(false);
      setSaved(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const createProfile = async () => {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/team/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: member.id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Could not create the profile');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the profile');
    } finally {
      setCreating(false);
    }
  };

  const remove = async () => {
    setConfirmDelete(false);
    setError(null);
    const res = await fetch(`/api/admin/team?id=${member.id}`, { method: 'DELETE' });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error || 'Delete failed');
      return;
    }
    router.push('/admin/team');
  };

  return (
    <TeamProfileContext.Provider value={{ memberName: name }}>
      <div style={{ padding: '20px 24px 0' }}>
        <Link
          href="/admin/team"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
            fontWeight: 600,
            color: ADMIN_COLORS.textMuted,
            textDecoration: 'none',
          }}
        >
          <ArrowLeft size={13} /> Team &amp; Advisors
        </Link>

        <section
          style={{
            marginTop: 12,
            background: '#fff',
            border: `1px solid ${ADMIN_COLORS.border}`,
            borderRadius: 12,
            padding: 22,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 16,
              flexWrap: 'wrap',
            }}
          >
            <div>
              <p style={eyebrow}>Details · card and profile header</p>
              <h1 style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 700, color: ADMIN_COLORS.textHeading }}>
                {name}
              </h1>
              <p style={{ ...adminFieldHint, marginTop: 6, maxWidth: 640 }}>
                Written once here. The /team card and the top of the full profile both show them.
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {saved && !dirty && (
                <span style={{ fontSize: 12, color: ADMIN_COLORS.success }}>Saved</span>
              )}
              {dirty && (
                <span style={{ fontSize: 12, color: ADMIN_COLORS.warning }}>Unsaved changes</span>
              )}
              <SaveButton type="button" onClick={save} saving={saving} disabled={!dirty || saving}>
                {saving ? <Loader2 size={14} className="animate-spin" /> : null}
                {saving ? 'Saving…' : 'Save details'}
              </SaveButton>
            </div>
          </div>

          <div
            style={{
              marginTop: 18,
              display: 'grid',
              gap: 16,
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            }}
          >
            {fields.map((f) => (
              <div
                key={f.key}
                style={{
                  gridColumn: f.type === 'media' || f.type === 'richtext' ? '1 / -1' : undefined,
                }}
              >
                <label style={adminLabel}>{f.label}</label>
                <FieldInput field={f} value={form[f.key]} onChange={(v) => set(f.key, v)} />
                {f.hint && <p style={adminFieldHint}>{f.hint}</p>}
              </div>
            ))}
          </div>

          {error && (
            <p style={{ margin: '14px 0 0', fontSize: 12, color: ADMIN_COLORS.danger }}>{error}</p>
          )}

          {canDelete && !isFounder && (
            <div style={{ marginTop: 18, paddingTop: 14, borderTop: `1px solid ${ADMIN_COLORS.borderSoft}` }}>
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                style={{ ...adminButtonGhost, color: ADMIN_COLORS.danger, borderColor: '#F3C2C2' }}
              >
                <Trash2 size={14} /> Delete member
              </button>
            </div>
          )}
        </section>

        {!page && (
          <section
            style={{
              marginTop: 16,
              marginBottom: 24,
              background: '#fff',
              border: `1px dashed ${ADMIN_COLORS.borderInput}`,
              borderRadius: 12,
              padding: 22,
            }}
          >
            <p style={eyebrow}>Full profile</p>
            <p style={{ margin: '6px 0 14px', fontSize: 13, color: ADMIN_COLORS.textBody, maxWidth: 640 }}>
              {name} has no full profile yet, so the /team card shows no highlights and no
              &quot;Read the full profile&quot; link. Creating one adds a page at /team/&lt;name&gt; with
              a header, a &quot;Selected experience&quot; list (its first three items become the card
              highlights) and &quot;Areas of expertise&quot;, all edited on this screen.
            </p>
            {canLinkProfile ? (
              <button type="button" onClick={createProfile} disabled={creating} style={adminButtonPrimary}>
                {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                Create full profile
              </button>
            ) : (
              <p style={adminFieldHint}>
                Available once migration 109 is applied.
              </p>
            )}
          </section>
        )}
      </div>

      {page && (
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', flex: 1 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 24px 10px',
            }}
          >
            <p style={eyebrow}>Full profile · sections</p>
            <Link
              href={publicPathForPageSlug(page.slug)}
              target="_blank"
              rel="noreferrer"
              style={{ ...adminButtonGhost, textDecoration: 'none' }}
            >
              View live profile <ArrowUpRight size={13} />
            </Link>
          </div>
          <PageBuilder
            eyebrow="Full profile"
            pageSlug={page.slug}
            pageTitle={page.title}
            pageStatus={page.status}
            pageMetaTitle={page.metaTitle}
            pageMetaDescription={page.metaDescription}
            initialSections={sections}
          />
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title={`Delete ${name}?`}
        body="The member is removed from Team & Advisors immediately and their card leaves /team. Their profile page's sections are kept, and are picked up again if a member of the same name creates a profile. To take someone off the site without deleting, untick Published instead."
        confirmLabel="Delete"
        destructive
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      />
    </TeamProfileContext.Provider>
  );
}

const eyebrow: React.CSSProperties = {
  margin: 0,
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
  color: ADMIN_COLORS.textMuted,
};
