import { NextResponse } from 'next/server';

import { auditGrowth, fail, ownerRequest } from '@/lib/growth/api';
import { actOnMessage, editMessage } from '@/lib/growth/outreach';
import { messageActionSchema, messageEditSchema } from '@/lib/growth/outreachModel';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Edits a draft. Editing an approved message returns it to draft. */
export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  const r = await ownerRequest(req, messageEditSchema);
  if (!r.ok) return r.response;
  const { id } = await props.params;
  const result = await editMessage(id, r.data, r.actor);
  if (!result.ok) return fail(result.status, result.error, result.code);
  await auditGrowth(r.adminId, 'update', 'growth_messages', id, { edited: true });
  return NextResponse.json({ message: result.value });
}

/** Approve, reject (with a reason), send, mark a LinkedIn message sent, mark a reply, or cancel. */
export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const r = await ownerRequest(req, messageActionSchema);
  if (!r.ok) return r.response;
  const { id } = await props.params;
  const result = await actOnMessage(id, r.data, r.actor);
  if (!result.ok) return fail(result.status, result.error, result.code);
  await auditGrowth(r.adminId, 'update', 'growth_messages', id, { action: r.data.action, status: result.value.status, send_mode: result.value.send_mode });
  return NextResponse.json({ message: result.value });
}
