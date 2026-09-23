/**
 * Pilot CSV import (Unit 2.5, 2026-09-23). Pure: parsing, column mapping and
 * the row plan, shared by the preview, the import and the verifier.
 *
 * Flow: upload, map columns, preview (validation, duplicates within the file
 * and against the database, suppression), dry run (the same plan, nothing
 * written), import. Everything imported is source "pilot". Past outreach in a
 * row becomes a dated activity on the contact's timeline. A suppressed email
 * is imported as do not contact, flagged, and can never be contacted: the
 * suppression check runs on every send regardless.
 */

import { z } from 'zod';

import { isGrowthService, normaliseDomain, normaliseEmail, PIPELINE_STAGES } from './model';
import { companyNameKey } from './signalsModel';

export const IMPORT_LIMITS = { rows: 2000, bytes: 2_000_000, cell: 2000 } as const;

export const IMPORT_FIELDS = [
  { key: 'company_name', label: 'Company name', required: true },
  { key: 'website_domain', label: 'Website or domain' },
  { key: 'sector', label: 'Sector' },
  { key: 'city', label: 'City' },
  { key: 'country', label: 'Country' },
  { key: 'scale_sar', label: 'Known scale (SAR)' },
  { key: 'contact_name', label: 'Contact name' },
  { key: 'contact_title', label: 'Contact job title' },
  { key: 'contact_email', label: 'Contact email' },
  { key: 'contact_phone', label: 'Contact phone' },
  { key: 'contact_linkedin', label: 'Contact LinkedIn' },
  { key: 'decision_maker', label: 'Decision-maker (yes or no)' },
  { key: 'lead_title', label: 'Lead title' },
  { key: 'deal_size_sar', label: 'Deal size (SAR)' },
  { key: 'service', label: 'Service' },
  { key: 'stage', label: 'Pipeline stage' },
  { key: 'last_outreach_date', label: 'Last outreach date' },
  { key: 'last_outreach_channel', label: 'Last outreach channel' },
  { key: 'outreach_note', label: 'Outreach note' },
  { key: 'notes', label: 'Notes' },
] as const;
export type ImportField = (typeof IMPORT_FIELDS)[number]['key'];
export type ImportMapping = Partial<Record<ImportField, number>>;

/** RFC 4180 CSV: commas, double-quoted cells with "" escapes, CRLF or LF rows. A leading BOM is dropped. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const s = text.replace(/^﻿/, '');
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quoted) {
      if (ch === '"' && s[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && s[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

const ALIASES: Record<ImportField, RegExp> = {
  company_name: /^(company|company name|organisation|organization|account|firm)$/i,
  website_domain: /^(website|domain|web|url|company website)$/i,
  sector: /^(sector|industry)$/i,
  city: /^city$/i,
  country: /^country$/i,
  scale_sar: /^(scale|project size|size|scale sar)$/i,
  contact_name: /^(contact|contact name|name|full name|person)$/i,
  contact_title: /^(title|job title|role|position|designation)$/i,
  contact_email: /^(email|e-mail|contact email|email address)$/i,
  contact_phone: /^(phone|mobile|telephone|contact phone)$/i,
  contact_linkedin: /^(linkedin|linkedin url|profile)$/i,
  decision_maker: /^(decision maker|decision-maker|dm)$/i,
  lead_title: /^(lead|lead title|opportunity)$/i,
  deal_size_sar: /^(deal size|deal size sar|value|deal value)$/i,
  service: /^(service|interest)$/i,
  stage: /^(stage|status|pipeline stage)$/i,
  last_outreach_date: /^(last outreach|last contacted|last contact date|outreach date|date contacted)$/i,
  last_outreach_channel: /^(channel|outreach channel)$/i,
  outreach_note: /^(outreach note|outreach|message|last message)$/i,
  notes: /^(notes|note|comments)$/i,
};

/** A first guess at the mapping from the header names. */
export function guessMapping(headers: string[]): ImportMapping {
  const out: ImportMapping = {};
  headers.forEach((h, i) => {
    const name = h.trim();
    for (const f of IMPORT_FIELDS) if (out[f.key] === undefined && ALIASES[f.key].test(name)) out[f.key] = i;
  });
  return out;
}

export const importRequestSchema = z.object({
  filename: z.string().trim().max(200).optional(),
  csv: z.string().max(IMPORT_LIMITS.bytes, 'The file is larger than 2 MB'),
  mapping: z.record(z.string(), z.number().int().min(0).max(200)),
  dryRun: z.boolean(),
});

export type Lookups = {
  /** Existing companies by normalised domain and by name key. */
  companiesByDomain: Map<string, { id: string; name: string }>;
  companiesByName: Map<string, { id: string; name: string }>;
  contactsByEmail: Map<string, { id: string; full_name: string; company_id: string | null }>;
  suppressed: Set<string>;
};

export type PlannedRow = {
  line: number;
  company: { name: string; domain: string | null; existingId: string | null; sector: string | null; city: string | null; country: string | null; scaleSar: number | null };
  contact: { name: string; title: string | null; email: string | null; phone: string | null; linkedin: string | null; decisionMaker: boolean; existingId: string | null; suppressed: boolean } | null;
  lead: { title: string; dealSizeSar: number | null; service: string | null; stage: string } | null;
  outreach: { date: string; channel: string | null; note: string | null } | null;
  notes: string | null;
  problems: string[];
  warnings: string[];
  action: 'import' | 'skip';
};

const num = (s: string | undefined): number | null | typeof Number.NaN => {
  const t = (s ?? '').trim().toLowerCase().replace(/,/g, '').replace(/^sar\s*/, '');
  if (!t) return null;
  const m = t.match(/^(\d+(?:\.\d+)?)\s*(k|m|mn|million|b|bn|billion)?$/);
  if (!m) return Number.NaN;
  const mult = ({ k: 1e3, m: 1e6, mn: 1e6, million: 1e6, b: 1e9, bn: 1e9, billion: 1e9 } as Record<string, number>)[m[2] ?? ''] ?? 1;
  return Math.round(Number(m[1]) * mult);
};

/** Dates as YYYY-MM-DD, DD/MM/YYYY or D Mon YYYY. Null when blank, NaN-like 'bad' when unreadable. */
export function readDate(s: string | undefined): string | null | 'bad' {
  const t = (s ?? '').trim();
  if (!t) return null;
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  const d = new Date(t);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return 'bad';
}

const STAGE_VALUES = PIPELINE_STAGES.map((s) => s.value) as string[];

export function planImport(rows: string[][], mapping: ImportMapping, lookups: Lookups, today: string = new Date().toISOString().slice(0, 10)): PlannedRow[] {
  const body = rows.slice(1, IMPORT_LIMITS.rows + 1);
  const seenEmails = new Map<string, number>();
  const seenCompanies = new Map<string, number>();
  const get = (r: string[], f: ImportField) => {
    const i = mapping[f];
    return i === undefined ? '' : (r[i] ?? '').trim().slice(0, IMPORT_LIMITS.cell);
  };
  return body.map((r, idx) => {
    const line = idx + 2;
    const problems: string[] = [];
    const warnings: string[] = [];
    const name = get(r, 'company_name');
    if (!name) problems.push('No company name');
    const domain = normaliseDomain(get(r, 'website_domain'));
    const nameKey = companyNameKey(name);
    const existing = (domain && lookups.companiesByDomain.get(domain)) || (nameKey && lookups.companiesByName.get(nameKey)) || null;
    if (existing) warnings.push(`Company already on file: ${existing.name} (the row is added to it)`);
    const companyKey = domain ?? nameKey;
    if (companyKey && seenCompanies.has(companyKey)) warnings.push(`Same company as line ${seenCompanies.get(companyKey)}`);
    else if (companyKey) seenCompanies.set(companyKey, line);

    const scale = num(get(r, 'scale_sar'));
    if (Number.isNaN(scale)) problems.push('Scale is not a number');
    const deal = num(get(r, 'deal_size_sar'));
    if (Number.isNaN(deal)) problems.push('Deal size is not a number');

    let contact: PlannedRow['contact'] = null;
    const cname = get(r, 'contact_name');
    const rawEmail = get(r, 'contact_email');
    const email = normaliseEmail(rawEmail);
    if (rawEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email ?? '')) problems.push(`Email "${rawEmail}" is not valid`);
    if (cname || email) {
      const existingContact = email ? lookups.contactsByEmail.get(email) ?? null : null;
      const suppressed = Boolean(email && lookups.suppressed.has(email));
      if (suppressed) warnings.push(`${email} is suppressed: imported as do not contact and never contactable`);
      if (existingContact) warnings.push(`Contact already on file: ${existingContact.full_name}`);
      if (email && seenEmails.has(email)) problems.push(`Email repeats line ${seenEmails.get(email)}`);
      else if (email) seenEmails.set(email, line);
      const dm = get(r, 'decision_maker').toLowerCase();
      contact = {
        name: cname || (email ? email.split('@')[0] : ''),
        title: get(r, 'contact_title') || null,
        email: email ?? null,
        phone: get(r, 'contact_phone') || null,
        linkedin: /^https?:\/\//i.test(get(r, 'contact_linkedin')) ? get(r, 'contact_linkedin') : null,
        decisionMaker: ['yes', 'y', 'true', '1', 'x'].includes(dm),
        existingId: existingContact?.id ?? null,
        suppressed,
      };
    }

    const service = get(r, 'service');
    const serviceSlug = service ? (isGrowthService(service) ? service : null) : null;
    if (service && !serviceSlug) warnings.push(`Service "${service}" is not a site service slug; left blank`);
    const stageRaw = get(r, 'stage').toLowerCase().replace(/\s+/g, '_');
    const stage = STAGE_VALUES.includes(stageRaw) ? stageRaw : stageRaw ? 'prospect' : 'prospect';
    if (stageRaw && !STAGE_VALUES.includes(stageRaw)) warnings.push(`Stage "${get(r, 'stage')}" not recognised; set to Prospect`);
    const leadTitle = get(r, 'lead_title');
    const lead = leadTitle || deal !== null || serviceSlug ? { title: leadTitle || `${name}: pilot`, dealSizeSar: typeof deal === 'number' && !Number.isNaN(deal) ? deal : null, service: serviceSlug, stage } : null;

    const d = readDate(get(r, 'last_outreach_date'));
    let outreach: PlannedRow['outreach'] = null;
    if (d === 'bad') problems.push(`Outreach date "${get(r, 'last_outreach_date')}" is not a date`);
    else if (d) {
      if (d > today) problems.push('Outreach date is in the future');
      else outreach = { date: d, channel: get(r, 'last_outreach_channel') || null, note: get(r, 'outreach_note') || null };
    } else if (get(r, 'outreach_note')) warnings.push('Outreach note without a date: kept in the notes');

    return {
      line,
      company: { name, domain, existingId: existing ? existing.id : null, sector: get(r, 'sector') || null, city: get(r, 'city') || null, country: get(r, 'country') || null, scaleSar: typeof scale === 'number' && !Number.isNaN(scale) ? scale : null },
      contact,
      lead,
      outreach,
      notes: [get(r, 'notes'), !d && get(r, 'outreach_note') ? `Outreach: ${get(r, 'outreach_note')}` : ''].filter(Boolean).join('\n') || null,
      problems,
      warnings,
      action: problems.length ? 'skip' : 'import',
    };
  });
}

export function summarisePlan(plan: PlannedRow[]) {
  return {
    rows: plan.length,
    toImport: plan.filter((p) => p.action === 'import').length,
    skipped: plan.filter((p) => p.action === 'skip').length,
    newCompanies: new Set(plan.filter((p) => p.action === 'import' && !p.company.existingId).map((p) => p.company.domain ?? companyNameKey(p.company.name))).size,
    contacts: plan.filter((p) => p.action === 'import' && p.contact && !p.contact.existingId).length,
    suppressed: plan.filter((p) => p.contact?.suppressed).length,
    leads: plan.filter((p) => p.action === 'import' && p.lead).length,
    outreach: plan.filter((p) => p.action === 'import' && p.outreach).length,
  };
}
