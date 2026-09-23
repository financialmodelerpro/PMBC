'use client';

import { useState } from 'react';

import { ADMIN_COLORS, adminBadge, adminCard, adminInput, adminTable, adminTd, adminTh, adminThead } from '@/lib/admin/styles';
import { IMPORT_FIELDS, IMPORT_LIMITS, guessMapping, parseCsv, type ImportField, type ImportMapping, type PlannedRow } from '@/lib/growth/importModel';

import { sendJson } from '../ui/client';
import { Field, NoticeLine, PrimaryButton, GhostButton, useAction } from '../ui/kit';

type Summary = { rows: number; toImport: number; skipped: number; newCompanies: number; contacts: number; suppressed: number; leads: number; outreach: number };
type Preview = { plan: PlannedRow[]; summary: Summary; truncated: boolean; dryRun: boolean; created?: { companies: number; contacts: number; leads: number; activities: number }; errors?: string[] };

/** Upload, map columns, preview with validation, dry run, import. */
export function ImportWizard({ canImport }: { canImport: boolean }) {
  const [csv, setCsv] = useState('');
  const [filename, setFilename] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<ImportMapping>({});
  const [preview, setPreview] = useState<Preview | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const { busy, notice, setNotice, run } = useAction();

  async function onFile(file: File | undefined) {
    setPreview(null);
    setConfirmed(false);
    if (!file) return;
    if (file.size > IMPORT_LIMITS.bytes) {
      setNotice({ tone: 'error', text: 'The file is larger than 2 MB. Split it and import in parts.' });
      return;
    }
    const text = await file.text();
    const rows = parseCsv(text);
    if (rows.length < 2) {
      setNotice({ tone: 'error', text: 'The file needs a header row and at least one data row.' });
      return;
    }
    setCsv(text);
    setFilename(file.name);
    setHeaders(rows[0]);
    setMapping(guessMapping(rows[0]));
    setNotice({ tone: 'ok', text: `${rows.length - 1} rows read. Check the column mapping, then preview.` });
  }

  const call = (dryRun: boolean) =>
    run(
      dryRun ? 'preview' : 'import',
      async () => {
        const r = await sendJson<Preview>('POST', '/api/admin/growth/import', { csv, filename, mapping, dryRun });
        setPreview(r);
        if (!dryRun) {
          setConfirmed(false);
          return `Imported: ${r.created?.companies ?? 0} companies, ${r.created?.contacts ?? 0} contacts, ${r.created?.leads ?? 0} leads, ${r.created?.activities ?? 0} past outreach records.${r.errors?.length ? ` ${r.errors.length} rows failed; see below.` : ''}`;
        }
        return `Dry run: ${r.summary.toImport} rows would import and ${r.summary.skipped} would be skipped. Nothing was written.`;
      },
      { refresh: !dryRun },
    );

  return (
    <>
      <section style={{ ...adminCard, marginBottom: 16 }}>
        <Field label="CSV file" hint={`Up to ${IMPORT_LIMITS.rows} rows and 2 MB. The first row must be the column names.`}>
          <input type="file" accept=".csv,text/csv" onChange={(e) => onFile(e.target.files?.[0])} style={adminInput} />
        </Field>
        <NoticeLine notice={notice} />
      </section>

      {headers.length > 0 && (
        <section style={{ ...adminCard, marginBottom: 16 }}>
          <h2 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700 }}>Map the columns</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 10 }}>
            {IMPORT_FIELDS.map((f) => (
              <Field key={f.key} label={`${f.label}${'required' in f && f.required ? ' (required)' : ''}`}>
                <select
                  value={mapping[f.key as ImportField] ?? ''}
                  onChange={(e) => {
                    const next = { ...mapping };
                    if (e.target.value === '') delete next[f.key as ImportField];
                    else next[f.key as ImportField] = Number(e.target.value);
                    setMapping(next);
                    setPreview(null);
                  }}
                  style={adminInput}
                >
                  <option value="">Not in the file</option>
                  {headers.map((h, i) => (
                    <option key={`${h}-${i}`} value={i}>
                      {h || `Column ${i + 1}`}
                    </option>
                  ))}
                </select>
              </Field>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
            <PrimaryButton onClick={() => call(true)} disabled={busy !== null || mapping.company_name === undefined}>
              {busy === 'preview' ? 'Checking' : 'Preview and dry run'}
            </PrimaryButton>
          </div>
        </section>
      )}

      {preview && (
        <section style={{ ...adminCard, padding: 0 }}>
          <div style={{ padding: '16px 20px' }}>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{preview.dryRun ? 'Dry run' : 'Import result'}</h2>
            <p style={{ margin: '6px 0 0', fontSize: 13 }}>
              {preview.summary.rows} rows: {preview.summary.toImport} to import, {preview.summary.skipped} skipped. New companies {preview.summary.newCompanies}, new contacts {preview.summary.contacts}, leads {preview.summary.leads}, past outreach records {preview.summary.outreach}. Suppressed emails {preview.summary.suppressed} (imported as do not contact).
              {preview.truncated && ` Only the first ${IMPORT_LIMITS.rows} rows are read.`}
            </p>
            {preview.errors && preview.errors.length > 0 && <p style={{ margin: '6px 0 0', fontSize: 12, color: ADMIN_COLORS.danger }}>{preview.errors.join('; ')}</p>}
            {preview.dryRun && (
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 12 }}>
                {canImport ? (
                  <>
                    <label style={{ fontSize: 13, display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} /> I have checked the dry run. Import {preview.summary.toImport} rows as source Pilot.
                    </label>
                    <PrimaryButton onClick={() => call(false)} disabled={busy !== null || !confirmed || preview.summary.toImport === 0}>
                      {busy === 'import' ? 'Importing' : 'Import'}
                    </PrimaryButton>
                  </>
                ) : (
                  <span style={{ fontSize: 13, color: ADMIN_COLORS.warning }}>Importing needs 088_growth_prospecting.sql applied first.</span>
                )}
                <GhostButton onClick={() => setPreview(null)}>Change mapping</GhostButton>
              </div>
            )}
          </div>
          <div style={{ overflowX: 'auto', maxHeight: 520 }}>
            <table style={adminTable}>
              <thead style={adminThead}>
                <tr>
                  <th style={adminTh}>Line</th>
                  <th style={adminTh}>Company</th>
                  <th style={adminTh}>Contact</th>
                  <th style={adminTh}>Lead and outreach</th>
                  <th style={adminTh}>Checks</th>
                </tr>
              </thead>
              <tbody>
                {preview.plan.map((p) => (
                  <tr key={p.line} style={{ verticalAlign: 'top', background: p.action === 'skip' ? ADMIN_COLORS.dangerBg : undefined }}>
                    <td style={{ ...adminTd, fontSize: 12 }}>{p.line}</td>
                    <td style={{ ...adminTd, fontSize: 12 }}>
                      {p.company.name}
                      {p.company.existingId && <div style={{ color: ADMIN_COLORS.textMuted }}>On file</div>}
                    </td>
                    <td style={{ ...adminTd, fontSize: 12 }}>
                      {p.contact ? (
                        <>
                          {p.contact.name}
                          {p.contact.email && <div>{p.contact.email}</div>}
                          {p.contact.suppressed && <span style={adminBadge('danger')}>Suppressed</span>}
                        </>
                      ) : (
                        ''
                      )}
                    </td>
                    <td style={{ ...adminTd, fontSize: 12 }}>
                      {p.lead?.title}
                      {p.outreach && <div style={{ color: ADMIN_COLORS.textMuted }}>Outreach {p.outreach.date}{p.outreach.channel ? ` by ${p.outreach.channel}` : ''}</div>}
                    </td>
                    <td style={{ ...adminTd, fontSize: 12 }}>
                      <span style={adminBadge(p.action === 'skip' ? 'danger' : 'success')}>{p.action === 'skip' ? 'Skip' : 'Import'}</span>
                      {p.problems.map((x) => (
                        <div key={x} style={{ color: ADMIN_COLORS.danger }}>{x}</div>
                      ))}
                      {p.warnings.map((x) => (
                        <div key={x} style={{ color: ADMIN_COLORS.warning }}>{x}</div>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
