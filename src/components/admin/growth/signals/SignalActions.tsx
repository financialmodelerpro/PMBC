'use client';

import { useState } from 'react';

import { adminInput } from '@/lib/admin/styles';
import { TRIGGER_TYPES } from '@/lib/growth/model';

import { sendJson } from '../ui/client';
import { Field, GhostButton, NoticeLine, PrimaryButton, useAction } from '../ui/kit';

type Option = { id: string; name: string };
type LeadOption = { id: string; title: string; company_id: string | null };

/**
 * Triage for one signal: convert into a prospect and lead, attach to an
 * existing company (and optionally a lead), dismiss with a reason, reopen, or
 * clear a duplicate flag. The trigger type can be changed at any time: a
 * keyword match from the feed only suggests it.
 */
export function SignalActions({
  signal,
  companies,
  leads,
}: {
  signal: { id: string; status: string; trigger_type: string; company_id: string | null; company_name: string | null; duplicate_of?: string | null };
  companies: Option[];
  leads: LeadOption[];
}) {
  const [mode, setMode] = useState<'none' | 'convert' | 'attach' | 'dismiss'>('none');
  const [companyId, setCompanyId] = useState(signal.company_id ?? '');
  const [newName, setNewName] = useState(signal.company_name ?? '');
  const [domain, setDomain] = useState('');
  const [leadTitle, setLeadTitle] = useState('');
  const [leadId, setLeadId] = useState('');
  const [reason, setReason] = useState('');
  const { busy, notice, run } = useAction();
  const url = `/api/admin/growth/signals/${signal.id}`;

  const act = (body: Record<string, unknown>, done: string) =>
    run(String(body.action), async () => {
      await sendJson('PATCH', url, body);
      setMode('none');
      return done;
    });

  const row = { display: 'flex', gap: 6, flexWrap: 'wrap' as const };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 220 }}>
      <select
        aria-label="Trigger type"
        value={signal.trigger_type}
        disabled={busy !== null}
        onChange={(e) => act({ action: 'retype', trigger_type: e.target.value }, 'Trigger changed.')}
        style={{ ...adminInput, fontSize: 12, padding: '4px 8px' }}
      >
        {TRIGGER_TYPES.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>
      <div style={row}>
        {signal.status !== 'converted' && <GhostButton onClick={() => setMode(mode === 'convert' ? 'none' : 'convert')}>Convert</GhostButton>}
        {signal.status !== 'converted' && <GhostButton onClick={() => setMode(mode === 'attach' ? 'none' : 'attach')}>Attach</GhostButton>}
        {signal.status !== 'dismissed' && signal.status !== 'converted' && (
          <GhostButton onClick={() => setMode(mode === 'dismiss' ? 'none' : 'dismiss')} danger>
            Dismiss
          </GhostButton>
        )}
        {(signal.status === 'dismissed' || signal.status === 'attached') && (
          <GhostButton onClick={() => act({ action: 'reopen' }, 'Reopened.')} disabled={busy !== null}>
            Reopen
          </GhostButton>
        )}
        {signal.duplicate_of && (
          <GhostButton onClick={() => act({ action: 'not_duplicate' }, 'Duplicate flag cleared.')} disabled={busy !== null}>
            Not a duplicate
          </GhostButton>
        )}
      </div>

      {mode === 'convert' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Field label="Company">
            <select value={companyId} onChange={(e) => setCompanyId(e.target.value)} style={adminInput}>
              <option value="">Create a new company</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          {!companyId && (
            <>
              <Field label="New company name">
                <input value={newName} onChange={(e) => setNewName(e.target.value)} style={adminInput} />
              </Field>
              <Field label="Website domain" hint="Optional. Used to catch duplicates.">
                <input value={domain} onChange={(e) => setDomain(e.target.value)} style={adminInput} placeholder="example.com.sa" />
              </Field>
            </>
          )}
          <Field label="Lead title" hint="Optional. Defaults to the company and the trigger.">
            <input value={leadTitle} onChange={(e) => setLeadTitle(e.target.value)} style={adminInput} />
          </Field>
          <PrimaryButton
            disabled={busy !== null}
            onClick={() =>
              act(
                { action: 'convert', company_id: companyId || null, company: companyId ? null : { name: newName, website_domain: domain || null }, lead_title: leadTitle || null },
                'Converted: the company and lead are in Prospects.',
              )
            }
          >
            Convert to prospect
          </PrimaryButton>
        </div>
      )}

      {mode === 'attach' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Field label="Company">
            <select value={companyId} onChange={(e) => { setCompanyId(e.target.value); setLeadId(''); }} style={adminInput}>
              <option value="">Choose a company</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          {companyId && (
            <Field label="Lead" hint="Optional">
              <select value={leadId} onChange={(e) => setLeadId(e.target.value)} style={adminInput}>
                <option value="">The company only</option>
                {leads
                  .filter((l) => l.company_id === companyId)
                  .map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.title}
                    </option>
                  ))}
              </select>
            </Field>
          )}
          <PrimaryButton disabled={busy !== null || !companyId} onClick={() => act({ action: 'attach', company_id: companyId, lead_id: leadId || null }, 'Attached.')}>
            Attach
          </PrimaryButton>
        </div>
      )}

      {mode === 'dismiss' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Field label="Reason" hint="Required. Kept with the signal.">
            <input value={reason} onChange={(e) => setReason(e.target.value)} style={adminInput} placeholder="e.g. below minimum size, not our sector" />
          </Field>
          <PrimaryButton disabled={busy !== null || reason.trim().length < 3} onClick={() => act({ action: 'dismiss', reason }, 'Dismissed.')}>
            Dismiss signal
          </PrimaryButton>
        </div>
      )}
      <NoticeLine notice={notice} />
    </div>
  );
}
