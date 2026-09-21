/**
 * Save and return (since 2026-09-21). Each lead gets a resume link id, emailed with the results, so
 * the person can come back, change their inputs and run the valuation again; the new run is saved as
 * a version of the same project (`processVersionUpdate`), not a new lead.
 *
 * The id is 16 characters from the booking link alphabet (about 93 bits), random, and separate from
 * the access token. It is stored as one `resume_link` event on the lead, its unique `dedupe_key`
 * being the lookup, so no new table is needed. Opening the link hands the page that lead's token,
 * because editing the valuation needs it: the link is as private as the email it arrives in, and the
 * email says so.
 */

import { randomBytes } from 'node:crypto';

import { SITE_HREF } from '@/lib/brand/letterhead';

import { BOOKING_LINK_ALPHABET } from '../bookingLinks';
import { toolsDb, type ToolLeadRow } from '../db';
import { insertLeadEvent } from './store';

export const RESUME_EVENT = 'resume_link';
export const RESUME_ID_LENGTH = 16;
const RESUME_ID_RE = new RegExp(`^[${BOOKING_LINK_ALPHABET}]{${RESUME_ID_LENGTH}}$`);
const dedupeKey = (id: string) => `${RESUME_EVENT}:${id}`;

export function isResumeId(id: unknown): id is string {
  return typeof id === 'string' && RESUME_ID_RE.test(id);
}

/** A new id, unbiased: bytes at or above the largest multiple of the alphabet size are skipped. */
export function newResumeId(bytes: (n: number) => Uint8Array = (n) => randomBytes(n)): string {
  const size = BOOKING_LINK_ALPHABET.length;
  const limit = 256 - (256 % size);
  let out = '';
  while (out.length < RESUME_ID_LENGTH) {
    for (const b of bytes(RESUME_ID_LENGTH * 2)) {
      if (b >= limit) continue;
      out += BOOKING_LINK_ALPHABET[b % size];
      if (out.length === RESUME_ID_LENGTH) break;
    }
  }
  return out;
}

/** The lead's resume id, created on first use. Null when it could not be stored. */
export async function resumeIdForLead(leadId: string): Promise<string | null> {
  try {
    const { data } = await toolsDb().from('tool_lead_events').select('dedupe_key').eq('lead_id', leadId).eq('event_type', RESUME_EVENT).order('created_at', { ascending: true }).limit(1);
    const key = ((data ?? [])[0] as { dedupe_key?: string } | undefined)?.dedupe_key ?? '';
    if (key.startsWith(`${RESUME_EVENT}:`)) return key.slice(RESUME_EVENT.length + 1);
  } catch {
    return null;
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    const id = newResumeId();
    const outcome = await insertLeadEvent({ lead_id: leadId, event_type: RESUME_EVENT, source: 'system', dedupe_key: dedupeKey(id) });
    if (outcome === 'inserted') return id;
    if (outcome === 'failed') return null;
  }
  return null;
}

/** The absolute link the emails carry, on the live https host. */
export function resumeHref(toolSlug: string, id: string): string {
  return `${SITE_HREF}/tools/${toolSlug}?resume=${id}`;
}

export async function resumeLinkForLead(lead: Pick<ToolLeadRow, 'id' | 'tool_slug'>): Promise<string | null> {
  const id = await resumeIdForLead(lead.id);
  return id ? resumeHref(lead.tool_slug, id) : null;
}

/** The lead a resume id belongs to, or null for an unknown or malformed id. */
export async function leadIdForResume(id: string): Promise<string | null> {
  if (!isResumeId(id)) return null;
  try {
    const { data } = await toolsDb().from('tool_lead_events').select('lead_id').eq('dedupe_key', dedupeKey(id)).eq('event_type', RESUME_EVENT).maybeSingle();
    return (data as { lead_id?: string } | null)?.lead_id ?? null;
  } catch {
    return null;
  }
}
