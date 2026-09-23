/**
 * Pilot CSV import, the server side (Unit 2.5, 2026-09-23). Server only.
 *
 * `previewImport` builds the plan (nothing is written): it is both the
 * preview and the dry run. `runImport` builds the same plan and applies the
 * rows marked import, recording one growth_imports row that every created
 * company, contact and lead points back to. Suppression is read in bulk and
 * fails closed: if any source cannot be read, the import refuses.
 */

import { toolsDb } from '@/lib/tools/db';
import { UNSUBSCRIBED_EVENT } from '@/lib/tools/leads/reminders';

import { logActivity } from './activity';
import type { WriteResult } from './api';
import { growthDb, tableExists } from './db';
import type { Actor } from './kb';
import { IMPORT_LIMITS, parseCsv, planImport, summarisePlan, type ImportMapping, type Lookups, type PlannedRow } from './importModel';
import { createCompany, createContact, createLead, rescoreCompany } from './prospects';
import { companyNameKey } from './signalsModel';
import { domainsOf } from './suppression';

async function chunked<T>(items: string[], size: number, fn: (chunk: string[]) => Promise<T[]>): Promise<T[]> {
  const out: T[] = [];
  for (let k = 0; k < items.length; k += size) out.push(...(await fn(items.slice(k, k + size))));
  return out;
}

/** Which of these emails are suppressed, read in bulk from the same three sources as checkSuppression. Throws if any cannot be read. */
export async function suppressedEmails(emails: string[]): Promise<Set<string>> {
  const out = new Set<string>();
  if (!emails.length) return out;
  const { data: list, error } = await growthDb().from('growth_suppressions').select('kind, value').is('removed_at', null).limit(20000);
  if (error) throw new Error(`suppression list: ${error.message}`);
  const byEmail = new Set((list ?? []).filter((r: { kind: string }) => r.kind === 'email').map((r: { value: string }) => r.value));
  const byDomain = new Set((list ?? []).filter((r: { kind: string }) => r.kind === 'domain').map((r: { value: string }) => r.value));
  for (const e of emails) if (byEmail.has(e) || domainsOf(e).some((d) => byDomain.has(d))) out.add(e);

  const optOuts = await chunked(emails, 200, async (chunk) => {
    const { data, error: err } = await growthDb().from('growth_contacts').select('email').in('email', chunk).in('consent_status', ['opted_out', 'do_not_contact']);
    if (err) throw new Error(`growth contacts: ${err.message}`);
    return (data ?? []).map((r: { email: string }) => r.email);
  });
  for (const e of optOuts) out.add(e);

  const toolLeads = await chunked(emails, 200, async (chunk) => {
    const { data, error: err } = await toolsDb().from('tool_leads').select('id, email').in('email', chunk);
    if (err) throw new Error(`valuation leads: ${err.message}`);
    return (data ?? []) as { id: string; email: string }[];
  });
  if (toolLeads.length) {
    const unsubscribed = await chunked(
      toolLeads.map((l) => l.id),
      200,
      async (chunk) => {
        const { data, error: err } = await toolsDb().from('tool_lead_events').select('lead_id').eq('event_type', UNSUBSCRIBED_EVENT).in('lead_id', chunk);
        if (err) throw new Error(`valuation unsubscribes: ${err.message}`);
        return (data ?? []).map((r: { lead_id: string }) => r.lead_id);
      },
    );
    const ids = new Set(unsubscribed);
    for (const l of toolLeads) if (ids.has(l.id)) out.add(l.email.trim().toLowerCase());
  }
  return out;
}

async function lookupsFor(rows: string[][], mapping: ImportMapping): Promise<Lookups> {
  const col = (k: keyof ImportMapping) => mapping[k];
  const body = rows.slice(1, IMPORT_LIMITS.rows + 1);
  const val = (r: string[], i: number | undefined) => (i === undefined ? '' : (r[i] ?? '').trim());
  const emails = [...new Set(body.map((r) => val(r, col('contact_email')).toLowerCase()).filter((e) => e.includes('@')))];
  const [companies, contacts, suppressed] = await Promise.all([
    growthDb().from('growth_companies').select('id, name, website_domain').eq('is_test', false).limit(20000),
    chunked(emails, 200, async (chunk) => {
      const { data } = await growthDb().from('growth_contacts').select('id, full_name, company_id, email').in('email', chunk);
      return (data ?? []) as { id: string; full_name: string; company_id: string | null; email: string }[];
    }),
    suppressedEmails(emails),
  ]);
  if (companies.error) throw new Error(`companies: ${companies.error.message}`);
  const lookups: Lookups = { companiesByDomain: new Map(), companiesByName: new Map(), contactsByEmail: new Map(), suppressed };
  for (const c of (companies.data ?? []) as { id: string; name: string; website_domain: string | null }[]) {
    if (c.website_domain) lookups.companiesByDomain.set(c.website_domain, c);
    const key = companyNameKey(c.name);
    if (key && !lookups.companiesByName.has(key)) lookups.companiesByName.set(key, c);
  }
  for (const c of contacts) lookups.contactsByEmail.set(c.email, c);
  return lookups;
}

export type ImportPreview = { headers: string[]; plan: PlannedRow[]; summary: ReturnType<typeof summarisePlan>; truncated: boolean };

export async function previewImport(csv: string, mapping: ImportMapping): Promise<WriteResult<ImportPreview>> {
  const rows = parseCsv(csv);
  if (rows.length < 2) return { ok: false, status: 422, error: 'The file needs a header row and at least one data row' };
  if (mapping.company_name === undefined) return { ok: false, status: 422, error: 'Map the company name column' };
  let lookups: Lookups;
  try {
    lookups = await lookupsFor(rows, mapping);
  } catch (err) {
    return { ok: false, status: 503, error: `Could not check duplicates and suppression, so nothing can be imported: ${err instanceof Error ? err.message : 'read failed'}` };
  }
  const plan = planImport(rows, mapping, lookups);
  return { ok: true, value: { headers: rows[0], plan, summary: summarisePlan(plan), truncated: rows.length - 1 > IMPORT_LIMITS.rows } };
}

export type ImportResult = ImportPreview & { importId: string; created: { companies: number; contacts: number; leads: number; activities: number }; errors: string[] };

export async function runImport(csv: string, mapping: ImportMapping, filename: string | null, actor: Actor, opts: { isTest?: boolean } = {}): Promise<WriteResult<ImportResult>> {
  if (!(await tableExists('growth_imports'))) return { ok: false, status: 503, error: 'Importing needs 088_growth_prospecting.sql applied first. Preview and dry run work now.' };
  const preview = await previewImport(csv, mapping);
  if (!preview.ok) return preview;
  const { plan } = preview.value;
  const isTest = Boolean(opts.isTest);
  const { data: imp, error } = await growthDb()
    .from('growth_imports')
    .insert({ is_test: isTest, filename, created_by_name: actor.name, rows_total: plan.length, mapping })
    .select('id')
    .single();
  if (error || !imp) return { ok: false, status: 500, error: error?.message ?? 'Could not start the import' };
  const importId = (imp as { id: string }).id;
  const created = { companies: 0, contacts: 0, leads: 0, activities: 0 };
  const errors: string[] = [];
  const companyIds = new Map<string, string>();
  const touched = new Set<string>();
  const o = { isTest, importId, skipRescore: true };

  for (const row of plan) {
    if (row.action !== 'import') continue;
    const key = row.company.domain ?? companyNameKey(row.company.name);
    let companyId = row.company.existingId ?? companyIds.get(key) ?? null;
    if (!companyId) {
      const c = await createCompany({ name: row.company.name, website_domain: row.company.domain, sector: row.company.sector, city: row.company.city, country: row.company.country, scale_sar: row.company.scaleSar, source: 'pilot', notes: row.notes }, actor, o);
      if (!c.ok) {
        errors.push(`Line ${row.line}: ${c.error}`);
        continue;
      }
      companyId = c.value.id;
      created.companies++;
    }
    companyIds.set(key, companyId);
    touched.add(companyId);

    let contactId = row.contact?.existingId ?? null;
    if (row.contact && !contactId) {
      const c = await createContact(
        companyId,
        {
          full_name: row.contact.name || 'Unknown',
          role_title: row.contact.title,
          email: row.contact.email,
          phone: row.contact.phone,
          linkedin_url: row.contact.linkedin,
          is_decision_maker: row.contact.decisionMaker,
          consent_status: row.contact.suppressed ? 'do_not_contact' : 'unknown',
          consent_source: row.contact.suppressed ? 'Pilot import: on the suppression list' : 'Pilot import',
        },
        actor,
        o,
      );
      if (c.ok) {
        contactId = c.value.id;
        created.contacts++;
      } else errors.push(`Line ${row.line}: ${c.error}`);
    }

    let leadId: string | null = null;
    if (row.lead) {
      const l = await createLead(companyId, { title: row.lead.title, contact_id: contactId, stage: row.lead.stage, deal_size_sar: row.lead.dealSizeSar, recommended_service: row.lead.service, source: 'pilot', source_ref: `import:${importId}` }, actor, o);
      if (l.ok) {
        leadId = l.value.id;
        created.leads++;
      } else errors.push(`Line ${row.line}: ${l.error}`);
    }

    if (row.outreach) {
      const at = `${row.outreach.date}T09:00:00+03:00`;
      const ok = await logActivity({
        actorType: 'system',
        actorId: 'pilot-import',
        action: 'outreach.history',
        summary: `Past outreach${row.outreach.channel ? ` by ${row.outreach.channel}` : ''} (imported)${row.outreach.note ? `: ${row.outreach.note}` : ''}`,
        companyId,
        contactId,
        leadId,
        isTest,
        occurredAt: at,
        metadata: { imported: true, import_id: importId, channel: row.outreach.channel, note: row.outreach.note, line: row.line },
      });
      if (ok) created.activities++;
      if (contactId) {
        const { data: ct } = await growthDb().from('growth_contacts').select('last_contacted_at').eq('id', contactId).maybeSingle();
        const last = (ct as { last_contacted_at: string | null } | null)?.last_contacted_at;
        if (!last || Date.parse(last) < Date.parse(at)) await growthDb().from('growth_contacts').update({ last_contacted_at: at }).eq('id', contactId);
      }
    }
  }

  for (const id of touched) await rescoreCompany(id, { actor });
  await growthDb()
    .from('growth_imports')
    .update({ companies_created: created.companies, contacts_created: created.contacts, leads_created: created.leads, activities_created: created.activities, skipped: plan.filter((p) => p.action === 'skip').length, suppressed: plan.filter((p) => p.contact?.suppressed).length, errors })
    .eq('id', importId);
  await logActivity({ actorType: 'admin', actorId: actor.id, action: 'import.completed', summary: `Pilot import${filename ? ` of ${filename}` : ''}: ${created.companies} companies, ${created.contacts} contacts, ${created.leads} leads, ${created.activities} past outreach records`, isTest, metadata: { import_id: importId, errors: errors.slice(0, 50) } });
  return { ok: true, value: { ...preview.value, importId, created, errors } };
}

export type ImportRow = { id: string; created_at: string; filename: string | null; created_by_name: string | null; rows_total: number; companies_created: number; contacts_created: number; leads_created: number; activities_created: number; skipped: number; suppressed: number; is_test: boolean };

export async function recentImports(limit = 10): Promise<ImportRow[]> {
  const { data } = await growthDb().from('growth_imports').select('*').order('created_at', { ascending: false }).limit(limit);
  return (data ?? []) as ImportRow[];
}
