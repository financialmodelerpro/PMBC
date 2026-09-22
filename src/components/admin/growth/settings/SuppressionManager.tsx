'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { SaveButton } from '@/components/admin/SaveButton';
import { ADMIN_COLORS, adminBadge, adminButtonGhost, adminCard, adminInput, adminLabel, adminTable, adminTd, adminTh, adminThead } from '@/lib/admin/styles';

export type SuppressionView = {
  id: string;
  kind: 'email' | 'domain';
  value: string;
  reason: string;
  sourceLabel: string;
  addedLabel: string;
  removedLabel: string | null;
  removedReason: string | null;
  isTest: boolean;
};

async function call(url: string, body?: unknown): Promise<Record<string, unknown>> {
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body ?? {}) });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok && res.status !== 207) throw new Error(typeof data.error === 'string' ? data.error : 'Request failed');
  return data;
}

/** Add, import and remove suppression entries. Removal needs a reason and keeps the entry as history. */
export function SuppressionManager({ rows }: { rows: SuppressionView[] }) {
  const router = useRouter();
  const [kind, setKind] = useState<'email' | 'domain'>('email');
  const [value, setValue] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [removeReason, setRemoveReason] = useState('');

  async function run(key: string, fn: () => Promise<string>) {
    setBusy(key);
    setMessage(null);
    try {
      setMessage({ tone: 'ok', text: await fn() });
      router.refresh();
    } catch (err) {
      setMessage({ tone: 'error', text: err instanceof Error ? err.message : 'Failed' });
    } finally {
      setBusy(null);
    }
  }

  const add = () =>
    run('add', async () => {
      const data = await call('/api/admin/growth/suppressions', { kind, value, reason });
      setValue('');
      setReason('');
      const row = data.row as { value: string } | undefined;
      return `Suppressed ${row?.value ?? value}.`;
    });

  const importNow = () =>
    run('import', async () => {
      const r = (await call('/api/admin/growth/suppressions/import')) as { added?: number; alreadySuppressed?: number; found?: { valuation: number; contacts: number }; errors?: string[] };
      const errs = r.errors?.length ? ` ${r.errors.length} could not be read: ${r.errors.join('; ')}` : '';
      return `Found ${r.found?.valuation ?? 0} valuation tool unsubscribes and ${r.found?.contacts ?? 0} Growth contact opt-outs. Added ${r.added ?? 0}, already suppressed ${r.alreadySuppressed ?? 0}.${errs}`;
    });

  const remove = (id: string) =>
    run(`remove-${id}`, async () => {
      await call(`/api/admin/growth/suppressions/${id}`, { reason: removeReason });
      setRemoving(null);
      setRemoveReason('');
      return 'Removed. The entry stays in the history below.';
    });

  const live = rows.filter((r) => !r.removedLabel);
  const removed = rows.filter((r) => r.removedLabel);

  return (
    <>
      <section style={{ ...adminCard, marginBottom: 16 }}>
        <h2 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 700, color: ADMIN_COLORS.textHeading }}>Add to the list</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: 12, alignItems: 'end' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={adminLabel}>Type</span>
            <select value={kind} onChange={(e) => setKind(e.target.value as 'email' | 'domain')} style={adminInput}>
              <option value="email">Email</option>
              <option value="domain">Domain</option>
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={adminLabel}>{kind === 'email' ? 'Email' : 'Domain'}</span>
            <input value={value} onChange={(e) => setValue(e.target.value)} placeholder={kind === 'email' ? 'name@example.com' : 'example.com'} style={adminInput} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={adminLabel}>Reason</span>
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why it must never be contacted" style={adminInput} />
          </label>
          <SaveButton onClick={add} saving={busy === 'add'} disabled={!value.trim() || !reason.trim() || Boolean(busy)}>
            {busy === 'add' ? 'Adding' : 'Suppress'}
          </SaveButton>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginTop: 16, paddingTop: 16, borderTop: `1px solid ${ADMIN_COLORS.borderSoft}` }}>
          <button type="button" onClick={importNow} disabled={Boolean(busy)} style={adminButtonGhost}>
            {busy === 'import' ? 'Importing' : 'Import existing opt-outs'}
          </button>
          <span style={{ fontSize: 12, color: ADMIN_COLORS.textMuted, flex: '1 1 260px' }}>
            Valuation tool unsubscribes and Growth contacts marked opted out or do not contact. Safe to run again. The send check reads both live, so nothing is missed between imports.
          </span>
        </div>
        {message && <p style={{ margin: '12px 0 0', fontSize: 13, color: message.tone === 'ok' ? ADMIN_COLORS.success : ADMIN_COLORS.danger }}>{message.text}</p>}
      </section>

      {[
        { title: `Suppressed (${live.length})`, list: live, empty: 'Nothing is suppressed yet.' },
        { title: `Removed (${removed.length})`, list: removed, empty: 'No entries have been removed.' },
      ].map((group) => (
        <section key={group.title} style={{ ...adminCard, padding: 0, marginBottom: 16 }}>
          <h2 style={{ margin: 0, padding: '16px 20px', fontSize: 15, fontWeight: 700, color: ADMIN_COLORS.textHeading }}>{group.title}</h2>
          <div style={{ overflowX: 'auto' }}>
            <table style={adminTable}>
              <thead style={adminThead}>
                <tr>
                  <th style={adminTh}>Email or domain</th>
                  <th style={adminTh}>Reason</th>
                  <th style={adminTh}>Source</th>
                  <th style={adminTh}>Added</th>
                  <th style={adminTh} />
                </tr>
              </thead>
              <tbody>
                {group.list.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ ...adminTd, fontSize: 13, color: ADMIN_COLORS.textMuted }}>
                      {group.empty}
                    </td>
                  </tr>
                )}
                {group.list.map((r) => (
                  <tr key={r.id}>
                    <td style={{ ...adminTd, fontSize: 13, wordBreak: 'break-all', minWidth: 160 }}>
                      <span style={adminBadge('neutral')}>{r.kind}</span> {r.value}
                      {r.isTest && <span style={{ ...adminBadge('warning'), marginLeft: 4 }}>Test</span>}
                    </td>
                    <td style={{ ...adminTd, fontSize: 13, minWidth: 160 }}>
                      {r.reason}
                      {r.removedLabel && (
                        <div style={{ fontSize: 12, color: ADMIN_COLORS.textMuted, marginTop: 4 }}>
                          Removed {r.removedLabel}: {r.removedReason}
                        </div>
                      )}
                    </td>
                    <td style={{ ...adminTd, fontSize: 12 }}>{r.sourceLabel}</td>
                    <td style={{ ...adminTd, fontSize: 12, whiteSpace: 'nowrap' }}>{r.addedLabel}</td>
                    <td style={{ ...adminTd, textAlign: 'right', minWidth: removing === r.id ? 240 : undefined }}>
                      {!r.removedLabel &&
                        (removing === r.id ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'stretch' }}>
                            <input autoFocus value={removeReason} onChange={(e) => setRemoveReason(e.target.value)} placeholder="Reason for removing" style={adminInput} aria-label={`Reason for removing ${r.value}`} />
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                              <button type="button" onClick={() => { setRemoving(null); setRemoveReason(''); }} style={{ ...adminButtonGhost, padding: '5px 10px', fontSize: 12 }}>
                                Cancel
                              </button>
                              <button type="button" onClick={() => remove(r.id)} disabled={!removeReason.trim() || Boolean(busy)} style={{ ...adminButtonGhost, padding: '5px 10px', fontSize: 12, color: ADMIN_COLORS.danger }}>
                                {busy === `remove-${r.id}` ? 'Removing' : 'Remove'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button type="button" onClick={() => { setRemoving(r.id); setRemoveReason(''); }} style={{ ...adminButtonGhost, padding: '5px 10px', fontSize: 12, color: ADMIN_COLORS.danger }}>
                            Remove
                          </button>
                        ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </>
  );
}
