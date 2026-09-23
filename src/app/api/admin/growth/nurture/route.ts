import { NextResponse } from 'next/server';
import { z } from 'zod';

import { auditGrowth, fail, ownerRequest } from '@/lib/growth/api';
import { actOnContent, magnetSchema, runSequence, saveMagnet, saveStep, sendLeadMagnet, setSubscription, stepSchema, syncToBrevo } from '@/lib/growth/nurture';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('sync') }),
  z.object({ action: z.literal('run') }),
  z.object({ action: z.literal('subscribe'), contact_id: z.string().uuid() }),
  z.object({ action: z.literal('unsubscribe'), contact_id: z.string().uuid(), reason: z.string().trim().max(300).optional() }),
  z.object({ action: z.literal('send_magnet'), contact_id: z.string().uuid(), magnet_id: z.string().uuid() }),
  z.object({ action: z.literal('save_step'), id: z.string().uuid().nullable().optional(), step: stepSchema }),
  z.object({ action: z.literal('save_magnet'), id: z.string().uuid().nullable().optional(), magnet: magnetSchema }),
  z.object({ action: z.literal('approve_step'), id: z.string().uuid() }),
  z.object({ action: z.literal('archive_step'), id: z.string().uuid() }),
  z.object({ action: z.literal('approve_magnet'), id: z.string().uuid() }),
  z.object({ action: z.literal('archive_magnet'), id: z.string().uuid() }),
]);

/** Nurture: sync, run the sequence, subscriptions, lead magnets, and the sequence and magnet content. */
export async function POST(req: Request) {
  const r = await ownerRequest(req, schema);
  if (!r.ok) return r.response;
  const d = r.data;
  const done = async (entity: string, id: string | null, after: unknown) => {
    await auditGrowth(r.adminId, 'update', entity, id, after);
  };
  switch (d.action) {
    case 'sync': {
      const res = await syncToBrevo();
      await done('growth_contacts', null, { nurture_sync: res.mode, synced: res.synced });
      return NextResponse.json(res);
    }
    case 'run': {
      const res = await runSequence();
      await done('growth_messages', null, { nurture_run: res.mode, sent: res.sent });
      return NextResponse.json(res);
    }
    case 'subscribe':
    case 'unsubscribe': {
      const res = await setSubscription(d.contact_id, d.action === 'subscribe', r.actor, d.action === 'unsubscribe' ? d.reason : undefined);
      if (!res.ok) return fail(res.status, res.error, res.code);
      await done('growth_contacts', d.contact_id, { nurture_status: d.action === 'subscribe' ? 'subscribed' : 'unsubscribed' });
      return NextResponse.json({ ok: true });
    }
    case 'send_magnet': {
      const res = await sendLeadMagnet(d.contact_id, d.magnet_id, r.actor);
      if (!res.ok) return fail(res.status, res.error, res.code);
      await done('growth_messages', res.value.messageId, { lead_magnet: d.magnet_id, mode: res.value.mode });
      return NextResponse.json(res.value);
    }
    case 'save_step': {
      const res = await saveStep(d.id ?? null, d.step, r.actor);
      if (!res.ok) return fail(res.status, res.error);
      await done('growth_nurture_steps', res.value.id, { step: res.value.step, status: 'draft' });
      return NextResponse.json({ step: res.value });
    }
    case 'save_magnet': {
      const res = await saveMagnet(d.id ?? null, d.magnet, r.actor);
      if (!res.ok) return fail(res.status, res.error);
      await done('growth_lead_magnets', res.value.id, { title: res.value.title, status: 'draft' });
      return NextResponse.json({ magnet: res.value });
    }
    default: {
      const table = d.action.endsWith('step') ? 'growth_nurture_steps' : 'growth_lead_magnets';
      const res = await actOnContent(table, d.id, d.action.startsWith('approve') ? 'approve' : 'archive', r.actor);
      if (!res.ok) return fail(res.status, res.error);
      await done(table, d.id, { status: res.value.status });
      return NextResponse.json(res.value);
    }
  }
}
