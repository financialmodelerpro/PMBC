import { NextResponse } from 'next/server';
import { z } from 'zod';

import { auditGrowth, fail, ownerRequest } from '@/lib/growth/api';
import { introSchema, logCheckin, saveIntroduction } from '@/lib/growth/partners';

export const dynamic = 'force-dynamic';

const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('checkin'), note: z.string().trim().max(2000).nullable().optional() }),
  z.object({ action: z.literal('intro'), id: z.string().uuid().nullable().optional(), intro: introSchema }),
]);

/** Logs a check-in (setting the next one), or records or updates an introduction. */
export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const r = await ownerRequest(req, schema);
  if (!r.ok) return r.response;
  const { id } = await props.params;
  if (r.data.action === 'checkin') {
    const res = await logCheckin(id, r.data.note ?? null, r.actor);
    if (!res.ok) return fail(res.status, res.error);
    await auditGrowth(r.adminId, 'update', 'growth_partners', id, { checkin: true, next_checkin_due: res.value.next_checkin_due });
    return NextResponse.json({ partner: res.value });
  }
  const res = await saveIntroduction(id, r.data.id ?? null, r.data.intro, r.actor);
  if (!res.ok) return fail(res.status, res.error);
  await auditGrowth(r.adminId, r.data.id ? 'update' : 'create', 'growth_introductions', res.value.id, { outcome: res.value.outcome, lead_id: res.value.lead_id });
  return NextResponse.json({ introduction: res.value });
}
