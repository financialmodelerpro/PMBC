'use client';

import { Fragment, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronRight } from 'lucide-react';

import { useCanDelete } from '@/components/admin/AdminRoleProvider';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { ADMIN_COLORS, adminBadge, adminButtonDanger, adminTable, adminTd, adminTh, adminThead } from '@/lib/admin/styles';

/** One valuation, formatted on the server so the dates read the same as the rest of the console. */
export type ValuationView = {
  id: string;
  projectName: string;
  versionsLabel: string;
  country: string;
  toolName: string;
  dealLabel: string;
  amount: string;
  emailLabel: string;
  emailTone: 'neutral' | 'success' | 'warning' | 'danger';
  createdLabel: string;
};

export type PersonView = {
  email: string;
  name: string;
  contactLine: string;
  bookingClicks: number;
  belowMinimum: boolean;
  isTest: boolean;
  latestLabel: string;
  valuations: ValuationView[];
};

type Pending = { title: string; body: string; label: string; emails?: string[]; ids?: string[] };

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

const linkButton = {
  background: 'none',
  border: 'none',
  padding: 0,
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 600,
  color: ADMIN_COLORS.danger,
} as const;

function toggled(set: Set<string>, value: string): Set<string> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

/**
 * The Tool Leads list (since 2026-09-22): one row per email, its valuations collapsed beneath it
 * behind an arrow, closed by default. Admins can delete a person, a single valuation, or every
 * ticked person at once, each behind a confirmation. Editors see no checkboxes or delete controls;
 * the route refuses them anyway.
 *
 * Each person is two `tbody` groups, their row and their valuations, so the arrow can point at the
 * valuations with `aria-controls` and hide them as one.
 */
export function ToolLeadsTable({ people, filtered, emptyText }: { people: PersonView[]; filtered: boolean; emptyText: string }) {
  const router = useRouter();
  const canDelete = useCanDelete();
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  const cols = canDelete ? 8 : 6;
  const allOnPage = people.length > 0 && people.every((p) => selected.has(p.email));
  const hiddenNote = filtered ? ' Valuations the current filters hide are deleted too.' : '';
  const cascadeNote = 'Their email events, versions, booking and edit links, and any reminders still to come go with them. This cannot be undone.';

  function askPerson(p: PersonView) {
    setPending({
      title: `Delete ${p.email}?`,
      body: `This deletes the lead and all ${plural(p.valuations.length, 'valuation')} under it.${hiddenNote} ${cascadeNote}`,
      label: 'Delete lead',
      emails: [p.email],
    });
  }

  function askValuation(p: PersonView, v: ValuationView) {
    const others = p.valuations.length > 1 ? ' Their other valuations are kept, and so is their reminder and unsubscribe history.' : '';
    setPending({
      title: `Delete ${v.projectName}?`,
      body: `This deletes the valuation of ${v.createdLabel} for ${p.email}, with its email events, versions and links.${others} This cannot be undone.`,
      label: 'Delete valuation',
      ids: [v.id],
    });
  }

  function askSelected() {
    const chosen = people.filter((p) => selected.has(p.email));
    const count = chosen.reduce((s, p) => s + p.valuations.length, 0);
    setPending({
      title: `Delete ${plural(chosen.length, 'lead')}?`,
      body: `This deletes ${plural(chosen.length, 'lead')} and ${plural(count, 'valuation')} under them.${hiddenNote} ${cascadeNote}`,
      label: `Delete ${plural(chosen.length, 'lead')}`,
      emails: chosen.map((p) => p.email),
    });
  }

  async function confirm() {
    if (!pending) return;
    const { emails, ids } = pending;
    setPending(null);
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/tool-leads', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ emails, ids }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; deleted?: number };
      if (!res.ok) throw new Error(data.error || 'Delete failed');
      setSelected(new Set());
      setMessage({ tone: 'ok', text: `Deleted ${plural(data.deleted ?? 0, 'valuation')}.` });
      router.refresh();
    } catch (err) {
      setMessage({ tone: 'error', text: err instanceof Error ? err.message : 'Delete failed' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {canDelete && (selected.size > 0 || message) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, fontSize: 13 }}>
          {selected.size > 0 && (
            <>
              <span style={{ color: ADMIN_COLORS.textBody }}>{plural(selected.size, 'lead')} selected</span>
              <button type="button" onClick={askSelected} disabled={busy} style={adminButtonDanger}>
                {busy ? 'Deleting' : 'Delete selected'}
              </button>
              <button type="button" onClick={() => setSelected(new Set())} style={{ ...linkButton, color: ADMIN_COLORS.textMuted }}>
                Clear selection
              </button>
            </>
          )}
          {message && <span style={{ color: message.tone === 'ok' ? ADMIN_COLORS.textMuted : ADMIN_COLORS.danger }}>{message.text}</span>}
        </div>
      )}
      <div style={{ overflowX: 'auto', background: '#FFFFFF', border: `1px solid ${ADMIN_COLORS.border}`, borderRadius: 12 }}>
        <table style={adminTable}>
          <thead style={adminThead}>
            <tr>
              {canDelete && (
                <th style={{ ...adminTh, width: 36 }}>
                  <input
                    type="checkbox"
                    aria-label="Select every lead on this page"
                    checked={allOnPage}
                    disabled={!people.length}
                    onChange={() => setSelected(allOnPage ? new Set() : new Set(people.map((p) => p.email)))}
                  />
                </th>
              )}
              <th style={adminTh}>Lead / valuation</th>
              <th style={adminTh}>Contact</th>
              <th style={adminTh}>Tool and deal size</th>
              <th style={{ ...adminTh, textAlign: 'right' }}>Base case</th>
              <th style={adminTh}>Email</th>
              <th style={adminTh}>Latest</th>
              {canDelete && <th style={adminTh} />}
            </tr>
          </thead>
          {people.length === 0 && (
            <tbody>
              <tr>
                <td colSpan={cols} style={{ ...adminTd, color: ADMIN_COLORS.textMuted, textAlign: 'center', padding: 28 }}>
                  {emptyText}
                </td>
              </tr>
            </tbody>
          )}
          {people.map((p) => {
            const isOpen = open.has(p.email);
            const panel = `valuations-${p.email}`;
            return (
              <Fragment key={p.email}>
                <tbody>
                  <tr style={{ background: '#F7F9FC' }}>
                    {canDelete && (
                      <td style={adminTd}>
                        <input type="checkbox" aria-label={`Select ${p.email}`} checked={selected.has(p.email)} onChange={() => setSelected((s) => toggled(s, p.email))} />
                      </td>
                    )}
                    <td style={adminTd}>
                      <button
                        type="button"
                        onClick={() => setOpen((s) => toggled(s, p.email))}
                        aria-expanded={isOpen}
                        aria-controls={panel}
                        style={{ display: 'flex', alignItems: 'flex-start', gap: 6, background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}
                      >
                        <ChevronRight
                          size={16}
                          aria-hidden
                          style={{ marginTop: 2, flexShrink: 0, color: ADMIN_COLORS.textMuted, transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}
                        />
                        <span>
                          <span style={{ display: 'block', fontWeight: 700, color: ADMIN_COLORS.textHeading }}>{p.name}</span>
                          <span style={{ display: 'block', fontSize: 12, color: ADMIN_COLORS.textMuted }}>
                            {plural(p.valuations.length, 'valuation')}
                            {p.bookingClicks > 0 ? `, booking clicks: ${p.bookingClicks}` : ''}
                          </span>
                        </span>
                      </button>
                      {(p.isTest || p.belowMinimum) && (
                        <div style={{ paddingLeft: 22, marginTop: 4 }}>
                          {p.isTest && <span style={adminBadge('warning')}>Test</span>}
                          {p.belowMinimum && <span style={{ ...adminBadge('neutral'), marginLeft: p.isTest ? 4 : 0 }}>Below minimum</span>}
                        </div>
                      )}
                    </td>
                    <td style={{ ...adminTd, fontSize: 13 }}>
                      <div>{p.email}</div>
                      <div style={{ color: ADMIN_COLORS.textMuted }}>{p.contactLine}</div>
                    </td>
                    <td style={adminTd} colSpan={3} />
                    <td style={{ ...adminTd, fontSize: 13, whiteSpace: 'nowrap' }}>{p.latestLabel}</td>
                    {canDelete && (
                      <td style={{ ...adminTd, textAlign: 'right' }}>
                        <button type="button" onClick={() => askPerson(p)} disabled={busy} style={linkButton}>
                          Delete
                        </button>
                      </td>
                    )}
                  </tr>
                </tbody>
                <tbody id={panel} hidden={!isOpen}>
                  {p.valuations.map((v) => (
                    <tr key={v.id}>
                      {canDelete && <td style={adminTd} />}
                      <td style={{ ...adminTd, paddingLeft: 36 }}>
                        <Link href={`/admin/tool-leads/${v.id}`} style={{ fontWeight: 600, color: ADMIN_COLORS.primary, textDecoration: 'none' }}>
                          {v.projectName}
                        </Link>
                        <div style={{ fontSize: 12, color: ADMIN_COLORS.textMuted }}>{v.versionsLabel}</div>
                      </td>
                      <td style={{ ...adminTd, fontSize: 12, color: ADMIN_COLORS.textMuted }}>{v.country}</td>
                      <td style={{ ...adminTd, fontSize: 13 }}>
                        {v.toolName}
                        <div style={{ fontSize: 12, color: ADMIN_COLORS.textMuted }}>{v.dealLabel}</div>
                      </td>
                      <td style={{ ...adminTd, fontSize: 13, textAlign: 'right', whiteSpace: 'nowrap' }}>{v.amount}</td>
                      <td style={adminTd}>
                        <span style={adminBadge(v.emailTone)}>{v.emailLabel}</span>
                      </td>
                      <td style={{ ...adminTd, fontSize: 13, whiteSpace: 'nowrap' }}>{v.createdLabel}</td>
                      {canDelete && (
                        <td style={{ ...adminTd, textAlign: 'right' }}>
                          <button type="button" onClick={() => askValuation(p, v)} disabled={busy} style={linkButton}>
                            Delete
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </Fragment>
            );
          })}
        </table>
      </div>
      <ConfirmDialog
        open={pending !== null}
        title={pending?.title ?? ''}
        body={pending?.body ?? ''}
        confirmLabel={pending?.label ?? 'Delete'}
        destructive
        onConfirm={confirm}
        onCancel={() => setPending(null)}
      />
    </>
  );
}
