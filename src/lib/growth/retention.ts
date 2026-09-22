/**
 * Retention preview (Unit 1.4, 2026-09-22). Server only, read only.
 *
 * Lists the Growth contacts the retention rule would affect today: contacts
 * who never replied, whose last contact (or, if never contacted, the date they
 * were added) is older than the retention period. "Never replied" means no
 * lead for that contact has reached Replied or any later stage. Nothing is
 * deleted or anonymised here; that action comes in a later unit, with approval.
 */

import { growthDb } from './db';
import type { PipelineStage } from './model';

/** Stages that mean the contact has replied at some point. */
export const REPLIED_STAGES: PipelineStage[] = ['replied', 'qualified', 'meeting_booked', 'opportunity', 'proposal', 'won'];

export type RetentionCandidate = {
  id: string;
  full_name: string;
  email: string | null;
  company: string | null;
  lastTouch: string;
  is_test: boolean;
};

/** The cut-off: `months` calendar months before `now`. */
export function retentionCutoff(months: number, now = new Date()): Date {
  const d = new Date(now);
  d.setUTCMonth(d.getUTCMonth() - months);
  return d;
}

export async function retentionPreview(months: number, opts: { includeTest?: boolean; now?: Date } = {}): Promise<{ rows: RetentionCandidate[]; cutoff: string; error: string | null }> {
  const cutoff = retentionCutoff(months, opts.now).toISOString();
  try {
    let q = growthDb()
      .from('growth_contacts')
      .select('id, full_name, email, created_at, last_contacted_at, is_test, company:growth_companies(name)')
      .or(`last_contacted_at.lt.${cutoff},and(last_contacted_at.is.null,created_at.lt.${cutoff})`)
      .order('created_at')
      .limit(1000);
    if (!opts.includeTest) q = q.eq('is_test', false);
    const { data, error } = await q;
    if (error) return { rows: [], cutoff, error: error.message };
    const contacts = (data ?? []) as unknown as { id: string; full_name: string; email: string | null; created_at: string; last_contacted_at: string | null; is_test: boolean; company: { name: string } | null }[];
    if (!contacts.length) return { rows: [], cutoff, error: null };

    const replied = new Set<string>();
    for (let k = 0; k < contacts.length; k += 200) {
      const { data: leads, error: lErr } = await growthDb().from('growth_leads').select('contact_id').in('contact_id', contacts.slice(k, k + 200).map((c) => c.id)).in('stage', REPLIED_STAGES);
      if (lErr) return { rows: [], cutoff, error: lErr.message };
      for (const l of (leads ?? []) as { contact_id: string }[]) replied.add(l.contact_id);
    }
    const rows = contacts
      .filter((c) => !replied.has(c.id))
      .map((c) => ({ id: c.id, full_name: c.full_name, email: c.email, company: c.company?.name ?? null, lastTouch: c.last_contacted_at ?? c.created_at, is_test: c.is_test }));
    return { rows, cutoff, error: null };
  } catch (err) {
    return { rows: [], cutoff, error: err instanceof Error ? err.message : 'load failed' };
  }
}
