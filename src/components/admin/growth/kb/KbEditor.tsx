'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { SaveButton } from '@/components/admin/SaveButton';
import { ADMIN_COLORS, adminCard, adminFieldHint, adminInput, adminLabel, adminTextarea } from '@/lib/admin/styles';
import { KB_LIMITS, SITE_SERVICE_OPTIONS, approvalProblems, kbKind, type KbContent, type KbKind, type KbStatus } from '@/lib/growth/kbModel';

import { KbActions } from './KbActions';

export type KbEditorItem = {
  id: string | null;
  kind: KbKind;
  title: string;
  content: KbContent;
  site_service_slug: string | null;
  case_study_id: string | null;
  related_service_slugs: string[];
  status: KbStatus;
};

type CaseStudyOption = { id: string; title: string; status: string };

/** Lists are edited as one entry per line. */
function toForm(kind: KbKind, content: KbContent): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of kbKind(kind).fields) {
    const v = content[f.key];
    out[f.key] = Array.isArray(v) ? v.join('\n') : typeof v === 'string' ? v : '';
  }
  return out;
}

function fromForm(kind: KbKind, form: Record<string, string>): KbContent {
  const out: KbContent = {};
  for (const f of kbKind(kind).fields) {
    const v = form[f.key] ?? '';
    out[f.key] = f.type === 'list' ? v.split(/\r?\n/).map((x) => x.trim()).filter(Boolean) : v;
  }
  return out;
}

/**
 * Create or edit one Knowledge Base item. Saving changes the working copy only;
 * Approve saves first, then publishes exactly what is on screen to AI agents.
 */
export function KbEditor({ item, caseStudies }: { item: KbEditorItem; caseStudies: CaseStudyOption[] }) {
  const router = useRouter();
  const cfg = kbKind(item.kind);
  const [title, setTitle] = useState(item.title);
  const [form, setForm] = useState<Record<string, string>>(() => toForm(item.kind, item.content));
  const siteService = item.site_service_slug ?? '';
  const [caseStudy, setCaseStudy] = useState(item.case_study_id ?? '');
  const [related, setRelated] = useState<string[]>(item.related_service_slugs);
  const [saved, setSaved] = useState({ title: item.title, form: toForm(item.kind, item.content), siteService: item.site_service_slug ?? '', caseStudy: item.case_study_id ?? '', related: item.related_service_slugs });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  const archived = item.status === 'archived';
  const dirty = title !== saved.title || caseStudy !== saved.caseStudy || JSON.stringify(related) !== JSON.stringify(saved.related) || JSON.stringify(form) !== JSON.stringify(saved.form);
  const payload = () => ({
    title,
    content: fromForm(item.kind, form),
    case_study_id: cfg.link === 'case_study' ? caseStudy || null : null,
    related_service_slugs: cfg.link === 'related_services' ? SITE_SERVICE_OPTIONS.map((o) => o.slug).filter((slug) => related.includes(slug)) : [],
  });
  const problems = useMemo(
    () => approvalProblems({ kind: item.kind, title, content: fromForm(item.kind, form), site_service_slug: siteService || null, case_study_id: caseStudy || null, related_service_slugs: related }),
    [item.kind, title, form, siteService, caseStudy, related],
  );

  async function save(): Promise<boolean> {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(item.id ? `/api/admin/growth/kb/${item.id}` : '/api/admin/growth/kb', {
        method: item.id ? 'PATCH' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(item.id ? payload() : { kind: item.kind, ...payload() }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; item?: { id: string } };
      if (!res.ok) throw new Error(data.error || 'Save failed');
      if (!item.id && data.item) {
        router.push(`/admin/growth/knowledge-base/${data.item.id}`);
        return true;
      }
      setSaved({ title, form, siteService, caseStudy, related });
      setMessage({ tone: 'ok', text: item.status === 'approved' ? 'Saved. AI agents keep the approved copy until you approve again.' : 'Saved as a draft.' });
      router.refresh();
      return true;
    } catch (err) {
      setMessage({ tone: 'error', text: err instanceof Error ? err.message : 'Save failed' });
      return false;
    } finally {
      setSaving(false);
    }
  }

  const field = (label: string, control: React.ReactNode, hint?: string, required?: boolean) => (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={adminLabel}>
        {label}
        {required ? ' (required to approve)' : ''}
      </span>
      {control}
      {hint && <span style={adminFieldHint}>{hint}</span>}
    </label>
  );

  return (
    <div style={{ ...adminCard, display: 'flex', flexDirection: 'column', gap: 18 }}>
      {archived && (
        <p style={{ margin: 0, fontSize: 13, color: ADMIN_COLORS.warning, background: ADMIN_COLORS.warningBg, padding: '10px 12px', borderRadius: 8 }}>
          Archived. Restore it as a draft to edit it.
        </p>
      )}
      <fieldset disabled={archived || saving} style={{ border: 0, padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 }}>
        {field(cfg.titleLabel, <input value={title} maxLength={KB_LIMITS.title} onChange={(e) => setTitle(e.target.value)} style={adminInput} />, undefined, true)}
        {cfg.link === 'site_page' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={adminLabel}>Site page</span>
            {siteService ? (
              <a href={`/services/${siteService}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: ADMIN_COLORS.primary }}>
                /services/{siteService}
              </a>
            ) : (
              <span style={{ fontSize: 13, color: ADMIN_COLORS.danger }}>No site page: this is not one of the site services.</span>
            )}
            <span style={adminFieldHint}>Each Growth service is one of the site&apos;s nine services, named as on the site and linked to its own page.</span>
          </div>
        )}
        {cfg.link === 'related_services' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={adminLabel}>Related services</span>
            <div role="group" aria-label="Related services" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {SITE_SERVICE_OPTIONS.map((o) => {
                const on = related.includes(o.slug);
                return (
                  <label key={o.slug} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '6px 10px', border: `1px solid ${on ? ADMIN_COLORS.primary : ADMIN_COLORS.border}`, borderRadius: 999, background: on ? '#EEF3F9' : '#FFFFFF' }}>
                    <input type="checkbox" checked={on} onChange={() => setRelated((r) => (on ? r.filter((x) => x !== o.slug) : [...r, o.slug]))} />
                    {o.title}
                  </label>
                );
              })}
            </div>
            <span style={adminFieldHint}>The services this offer leads into. Agents read them with the approved offer.</span>
          </div>
        )}
        {cfg.link === 'case_study' &&
          field(
            'Case study record',
            <select value={caseStudy} onChange={(e) => setCaseStudy(e.target.value)} style={adminInput}>
              <option value="">{caseStudies.length ? 'Choose a case study' : 'No case studies yet: add one under Case Studies'}</option>
              {caseStudies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                  {c.status !== 'published' ? ` (${c.status})` : ''}
                </option>
              ))}
            </select>,
            'Links to the existing record in Case Studies. Nothing is copied.',
            true,
          )}
        {cfg.fields.map((f) =>
          field(
            f.label,
            f.type === 'text' ? (
              <input value={form[f.key] ?? ''} maxLength={KB_LIMITS.text} onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))} style={adminInput} />
            ) : (
              <textarea
                value={form[f.key] ?? ''}
                rows={f.type === 'list' ? 5 : 6}
                maxLength={f.type === 'list' ? KB_LIMITS.listItem * KB_LIMITS.listItems : KB_LIMITS.textarea}
                onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
                style={adminTextarea}
              />
            ),
            [f.type === 'list' ? 'One per line.' : '', f.hint ?? ''].filter(Boolean).join(' ') || undefined,
            f.required,
          ),
        )}
      </fieldset>

      {!archived && problems.length > 0 && (
        <p style={{ margin: 0, fontSize: 12, color: ADMIN_COLORS.textMuted }}>Before approving: {problems.join('; ')}.</p>
      )}
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {!archived && (
          <SaveButton onClick={save} saving={saving} disabled={!dirty && Boolean(item.id)}>
            {saving ? 'Saving' : item.id ? 'Save' : 'Create draft'}
          </SaveButton>
        )}
        {item.id && (
          <KbActions
            id={item.id}
            actions={archived ? ['restore'] : ['approve', 'archive']}
            onBeforeApprove={async () => (dirty ? save() : true)}
            disabledReason={problems.length ? `Not ready: ${problems.join('; ')}` : null}
          />
        )}
      </div>
      {message && <p style={{ margin: 0, fontSize: 13, color: message.tone === 'ok' ? ADMIN_COLORS.success : ADMIN_COLORS.danger }}>{message.text}</p>}
    </div>
  );
}
