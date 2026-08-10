import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/requireAdmin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { writeAudit } from '@/lib/audit';
import {
  DOCUMENT_MIME,
  IMAGE_MIME,
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
  VIDEO_MIME,
  isVideoMime,
} from '@/lib/media';

const BUCKETS = ['cms-assets', 'article-covers', 'case-study-images', 'team-photos'] as const;
type Bucket = (typeof BUCKETS)[number];

// Images, animated images and documents share the 10 MB ceiling; video gets 25
// MB, since a few seconds of even modest-bitrate mp4 clears 10 MB easily and a
// background clip that cannot be uploaded is not a usable feature.
const ALLOWED_MIME = new Set<string>([
  ...IMAGE_MIME,
  ...VIDEO_MIME,
  ...DOCUMENT_MIME,
]);

function maxBytesFor(mime: string): number {
  return isVideoMime(mime) ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
}

function humanMb(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

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

export async function POST(req: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Expected multipart form data' }, { status: 400 });
  }

  const bucket = (form.get('bucket') as string) || 'cms-assets';
  if (!isBucket(bucket)) {
    return NextResponse.json({ error: 'Unknown bucket' }, { status: 400 });
  }

  const files = form.getAll('file').filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  const uploaded: Array<{ name: string; url: string }> = [];

  for (const file of files) {
    // Type is checked before size, so an unsupported file reports what is
    // actually wrong with it rather than a size limit it was never eligible for.
    if (file.type && !ALLOWED_MIME.has(file.type)) {
      return NextResponse.json(
        { error: `${file.name}: unsupported type ${file.type}` },
        { status: 415 },
      );
    }
    const limit = maxBytesFor(file.type || '');
    if (file.size > limit) {
      return NextResponse.json(
        { error: `${file.name} exceeds the ${humanMb(limit)} limit` },
        { status: 413 },
      );
    }

    const objectName = sanitizeName(file.name);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const { error } = await supabase.storage.from(bucket).upload(objectName, bytes, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    uploaded.push({
      name: objectName,
      url: supabase.storage.from(bucket).getPublicUrl(objectName).data.publicUrl,
    });
  }

  await writeAudit(supabase, {
    adminId: session.user.id,
    action: 'upload',
    entityType: 'media',
    entityId: bucket,
    metadata: { names: uploaded.map((u) => u.name) },
  });

  return NextResponse.json({ ok: true, uploaded });
}

export async function DELETE(req: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
