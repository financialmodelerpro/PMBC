'use client';

import { useState } from 'react';

import { adminCard, adminInput, adminTextarea, ADMIN_COLORS } from '@/lib/admin/styles';
import { suggestKeyword, type MatchableKeyword } from '@/lib/growth/keywordLibrary';
import { TRIGGER_TYPES } from '@/lib/growth/model';

import { sendJson } from '../ui/client';
import { Field, GhostButton, NoticeLine, PrimaryButton, grid, useAction } from '../ui/kit';

const today = () => new Date(Date.now() + 3 * 3_600_000).toISOString().slice(0, 10);

/**
 * Adds a signal by hand. The evidence link is required; the server flags a
 * likely duplicate. A summary that fits a keyword in the library suggests its
 * trigger type, which stays a suggestion until chosen.
 */
export function SignalAddForm({ companies, keywords = [] }: { companies: { id: string; name: string }[]; keywords?: MatchableKeyword[] }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ trigger_type: 'new_project', signal_date: today(), company_id: '', company_name: '', summary: '', evidence_url: '', source_name: '' });
  const { busy, notice, run } = useAction();
  const match = form.summary.trim().length >= 10 ? suggestKeyword(`${form.company_name} ${form.summary}`, keywords) : null;
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  const submit = () =>
    run('add', async () => {
      const data = await sendJson<{ signal: { duplicateWhy: string | null } }>('POST', '/api/admin/growth/signals', {
        ...form,
        company_id: form.company_id || null,
        company_name: form.company_id ? null : form.company_name,
      });
      setForm({ ...form, summary: '', evidence_url: '', source_name: '', company_name: '', company_id: '' });
      const why = data.signal.duplicateWhy;
      return why ? `Added, and flagged as a possible duplicate (${why === 'same_evidence' ? 'same evidence link' : 'same company and trigger within two weeks'}).` : 'Signal added to the inbox.';
    });

  if (!open) {
    return (
      <div style={{ marginBottom: 16 }}>
        <PrimaryButton onClick={() => setOpen(true)}>Add a signal</PrimaryButton>
        <NoticeLine notice={notice} />
      </div>
    );
  }
  return (
    <section style={{ ...adminCard, marginBottom: 16 }} aria-labelledby="add-signal">
      <h2 id="add-signal" style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 700, color: ADMIN_COLORS.textHeading }}>
        Add a signal
      </h2>
      <div style={grid}>
        <Field label="Trigger">
          <select value={form.trigger_type} onChange={set('trigger_type')} style={adminInput}>
            {TRIGGER_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Date">
          <input type="date" value={form.signal_date} onChange={set('signal_date')} style={adminInput} />
        </Field>
        <Field label="Existing company">
          <select value={form.company_id} onChange={set('company_id')} style={adminInput}>
            <option value="">Not on file yet</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        {!form.company_id && (
          <Field label="Company name">
            <input value={form.company_name} onChange={set('company_name')} style={adminInput} placeholder="As the source names it" />
          </Field>
        )}
      </div>
      <div style={{ ...grid, marginTop: 12 }}>
        <Field label="Evidence link" hint="Required. A page anyone can open that shows the event." style={{ gridColumn: '1 / -1' }}>
          <input value={form.evidence_url} onChange={set('evidence_url')} style={adminInput} placeholder="https://" />
        </Field>
        <Field label="Summary" style={{ gridColumn: '1 / -1' }}>
          <textarea value={form.summary} onChange={set('summary')} style={{ ...adminTextarea, minHeight: 72 }} placeholder="What happened, in a sentence or two" />
        </Field>
        {match && match.trigger !== form.trigger_type && (
          <p style={{ gridColumn: '1 / -1', margin: 0, fontSize: 12, color: ADMIN_COLORS.textMuted }} data-suggested-trigger={match.trigger}>
            Fits the keyword &quot;{match.keyword}&quot;, which suggests {TRIGGER_TYPES.find((t) => t.value === match.trigger)?.label}.{' '}
            <GhostButton onClick={() => setForm({ ...form, trigger_type: match.trigger })}>Use it</GhostButton>
          </p>
        )}
        <Field label="Source name" hint="Optional, e.g. Argaam or Saudi Gazette">
          <input value={form.source_name} onChange={set('source_name')} style={adminInput} />
        </Field>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <PrimaryButton onClick={submit} disabled={busy !== null}>
          {busy ? 'Adding' : 'Add signal'}
        </PrimaryButton>
        <GhostButton onClick={() => setOpen(false)}>Close</GhostButton>
      </div>
      <NoticeLine notice={notice} />
    </section>
  );
}
