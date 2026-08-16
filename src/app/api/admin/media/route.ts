import { NextResponse } from 'next/server';

import { canDelete, forbidden, getAdminSession } from '@/lib/auth/requireAdmin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { writeAudit } from '@/lib/audit';
import { ALLOWED_UPLOAD_MIME, humanBytes, maxBytesForMime } from '@/lib/media';

const BUCKETS = ['cms-assets', 'article-covers', 'case-study-images', 'team-photos'] as const;
type Bucket = (typeof BUCKETS)[number];

// Images, animated images and documents share the 10 MB ceiling; video gets 25
// MB, since a few seconds of even modest-bitrate mp4 clears 10 MB easily and a
// background clip that cannot be uploaded is not a usable feature.
const ALLOWED_MIME = ALLOWED_UPLOAD_MIME;

function isBucket(v: string | null): v is Bucket {
  return !!v && (BUCKETS as readonly string[]).includes(v);
}

function sanitizeName(name: string): string {
  const dot = name.lastIndexOf('.');
  const base = (dot >= 0 ? name.slice(0, dot) : name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'file';
  const ext = dot >= 0 ? name.slice(dot).toLowerCase().replace(/[^a-z0-9.]/g, '') : '';
  return `${Date.now()}_${base}${ext}`;
}

export async function GET(req: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const bucket = url.searchParams.get('bucket') ?? 'cms-assets';
  if (!isBucket(bucket)) {
    return NextResponse.json({ error: 'Unknown bucket' }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.storage
    .from(bucket)
    .list('', { limit: 200, sortBy: { column: 'created_at', order: 'desc' } });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const files = (data ?? [])
    .filter((f) => f.id !== null) // skip folder placeholders
    .map((f) => ({
      name: f.name,
      size: (f.metadata as { size?: number } | null)?.size ?? null,
      mimetype: (f.metadata as { mimetype?: string } | null)?.mimetype ?? null,
      created_at: f.created_at ?? null,
      url: supabase.storage.from(bucket).getPublicUrl(f.name).data.publicUrl,
    }));

  return NextResponse.json({ bucket, buckets: BUCKETS, files });
}

/**
 * Upload is a two call handshake, and the file itself passes through neither.
 *
 * WHY THE BYTES NO LONGER COME THROUGH HERE
 * A multipart POST of the file put the whole thing in the request body of a
 * serverless function. Any request body ceiling anywhere in front of that
 * function then applies to the upload, and those rejections happen before any
 * code here runs, so nothing in this route can catch them or shape the
 * response. The symptom was an upload dying on a plain text "Request Entity
 * Too Large" that the admin then tried to parse as JSON.
 *
 * A signed upload URL removes the question. `sign` returns a short lived URL,
 * the browser PUTs the file straight to Supabase Storage, and `complete`
 * records it. Both calls here carry a few hundred bytes of JSON, so no body
 * limit between the browser and this function is reachable no matter how large
 * the file is. It is also faster and cheaper: the bytes make one trip instead
 * of two, and no function holds a video in memory.
 *
 * WHAT STILL ENFORCES THE LIMITS
 *  - `sign` refuses an unsupported type or an oversized declared size, so the
 *    normal path gets a clear error before a byte moves.
 *  - the declared size is a client claim, so the bucket carries a real
 *    `file_size_limit` as well (see scripts/configure-storage-buckets.mjs).
 *    Storage rejects an oversized PUT with a JSON 413 regardless of what the
 *    browser claimed.
 */
export async function POST(req: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: {
    action?: string;
    bucket?: string;
    filename?: string;
    contentType?: string;
    size?: number;
    name?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Expected a JSON body with an action of "sign" or "complete"' },
      { status: 400 },
    );
  }

  const bucket = body.bucket || 'cms-assets';
  if (!isBucket(bucket)) {
    return NextResponse.json({ error: 'Unknown bucket' }, { status: 400 });
  }
  const supabase = createSupabaseServerClient();

  if (body.action === 'sign') {
    const filename = (body.filename || '').trim();
    if (!filename) return NextResponse.json({ error: 'filename is required' }, { status: 400 });

    const contentType = (body.contentType || '').trim();
    // Type before size, so an unsupported file reports what is actually wrong
    // with it rather than a size limit it was never eligible for.
    if (contentType && !ALLOWED_MIME.has(contentType)) {
      return NextResponse.json(
        { error: `${filename}: unsupported type ${contentType}` },
        { status: 415 },
      );
    }
    const size = typeof body.size === 'number' && Number.isFinite(body.size) ? body.size : 0;
    const limit = maxBytesForMime(contentType);
    if (size > limit) {
      return NextResponse.json(
        {
          error: `${filename} is ${humanBytes(size)}, over the ${humanBytes(limit)} limit for this file type`,
        },
        { status: 413 },
      );
    }

    const objectName = sanitizeName(filename);
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUploadUrl(objectName);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      ok: true,
      bucket,
      name: objectName,
      path: data.path,
      token: data.token,
      signedUrl: data.signedUrl,
      publicUrl: supabase.storage.from(bucket).getPublicUrl(objectName).data.publicUrl,
    });
  }

  if (body.action === 'complete') {
    const name = (body.name || '').trim();
    if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });

    // Confirm the object is really there before reporting success and writing
    // an audit row. The browser did the upload, so its word is not evidence:
    // a PUT that failed halfway would otherwise be recorded as an upload and
    // leave a URL in section content pointing at nothing.
    const { data: found, error: listError } = await supabase.storage
      .from(bucket)
      .list('', { search: name, limit: 1 });
    if (listError) return NextResponse.json({ error: listError.message }, { status: 500 });
    const object = (found ?? []).find((f) => f.name === name);
    if (!object) {
      return NextResponse.json(
        { error: `Upload did not complete: ${name} is not in ${bucket}` },
        { status: 404 },
      );
    }

    await writeAudit(supabase, {
      adminId: session.user.id,
      action: 'upload',
      entityType: 'media',
      entityId: bucket,
      metadata: { names: [name], size: (object.metadata as { size?: number } | null)?.size ?? null },
    });

    return NextResponse.json({
      ok: true,
      name,
      size: (object.metadata as { size?: number } | null)?.size ?? null,
      url: supabase.storage.from(bucket).getPublicUrl(name).data.publicUrl,
    });
  }

  return NextResponse.json(
    { error: 'Unknown action. Expected "sign" or "complete".' },
    { status: 400 },
  );
}

export async function DELETE(req: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // An uploaded file can be referenced from any number of sections, so removing
  // one is the least reversible thing in the media library.
  if (!canDelete(session)) {
    return forbidden('Editors cannot delete media. Upload a replacement and repoint the section instead.');
  }

  let body: { bucket?: string; name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { bucket, name } = body;
  if (!isBucket(bucket ?? null) || !name) {
    return NextResponse.json({ error: 'bucket and name are required' }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.storage.from(bucket as Bucket).remove([name]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAudit(supabase, {
    adminId: session.user.id,
    action: 'delete',
    entityType: 'media',
    entityId: bucket,
    metadata: { name },
  });

  return NextResponse.json({ ok: true });
}
