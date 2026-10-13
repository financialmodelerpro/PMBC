import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { z } from 'zod';

import { getAdminSession } from '@/lib/auth/requireAdmin';
import { writeAudit } from '@/lib/audit';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const BUCKET = 'team-photos';

/** The raster formats a portrait arrives in; each is written back in its own format. */
const FORMATS = ['jpeg', 'png', 'webp', 'avif'] as const;
type Format = (typeof FORMATS)[number];

const bodySchema = z.object({ url: z.string().url().max(2000) });

/**
 * A mirrored copy of a team member's photo: the current file flipped left to
 * right and saved beside it as a new file, whose URL is returned. The member
 * record is not touched here; the screen puts the URL into the Photo field and
 * it goes live with Save details, like any other change there.
 *
 * Mirroring the file rather than flipping it in CSS keeps one orientation
 * everywhere the photo appears: the /team card, the profile, the home founder
 * block, structured data and the tool reports.
 *
 * Only a photo already in the team-photos bucket is accepted, so the route
 * never fetches an arbitrary URL. The original is never changed or deleted;
 * mirroring a mirrored copy writes a new copy facing the original way.
 */
export async function POST(req: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Expected a JSON body with the photo url' }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  const prefix = supabase.storage.from(BUCKET).getPublicUrl('').data.publicUrl.replace(/\/?$/, '/');
  const url = parsed.data.url.split(/[?#]/)[0];
  if (!url.startsWith(prefix)) {
    return NextResponse.json(
      { error: 'Only a photo uploaded to the team photos library can be mirrored' },
      { status: 400 },
    );
  }
  const source = decodeURIComponent(url.slice(prefix.length));
  if (!source || source.includes('/')) {
    return NextResponse.json({ error: 'Unrecognised photo file' }, { status: 400 });
  }

  const { data: blob, error: downloadError } = await supabase.storage.from(BUCKET).download(source);
  if (downloadError || !blob) {
    return NextResponse.json({ error: `Could not read ${source} from the photo library` }, { status: 404 });
  }

  let output: Buffer;
  let format: Format;
  try {
    const input = Buffer.from(await blob.arrayBuffer());
    const meta = await sharp(input).metadata();
    const detected = meta.format === 'jpg' ? 'jpeg' : meta.format;
    if (!detected || !(FORMATS as readonly string[]).includes(detected)) {
      return NextResponse.json(
        { error: 'Only JPEG, PNG, WebP or AVIF photos can be mirrored' },
        { status: 415 },
      );
    }
    format = detected as Format;
    // rotate() first applies any camera orientation tag, so the flip acts on
    // the photo as it is seen, not as it was stored.
    // PNG stays lossless: a quality option would make sharp reduce it to a palette.
    output = await sharp(input)
      .rotate()
      .flop()
      .toFormat(format, format === 'png' ? {} : { quality: 92 })
      .toBuffer();
  } catch {
    return NextResponse.json({ error: 'The photo could not be processed' }, { status: 422 });
  }

  const name = mirroredName(source, format);
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(name, output, {
    contentType: `image/${format}`,
    upsert: false,
  });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  await writeAudit(supabase, {
    adminId: session.user.id,
    action: 'upload',
    entityType: 'media',
    entityId: BUCKET,
    metadata: { names: [name], mirrored_from: source, size: output.length },
  });

  return NextResponse.json({
    ok: true,
    name,
    url: supabase.storage.from(BUCKET).getPublicUrl(name).data.publicUrl,
  });
}

/**
 * "1791811937091_aadil-aamir-1.png" becomes "<now>_aadil-aamir-1-mirrored.png",
 * and a mirrored file drops the suffix again, so names do not grow with each flip.
 */
function mirroredName(source: string, format: Format): string {
  const dot = source.lastIndexOf('.');
  const stem = (dot >= 0 ? source.slice(0, dot) : source).replace(/^\d+_/, '');
  const base = stem.endsWith('-mirrored') ? stem.slice(0, -'-mirrored'.length) : `${stem}-mirrored`;
  const ext = format === 'jpeg' ? (/\.jpe?g$/i.test(source) ? source.slice(dot).toLowerCase() : '.jpg') : `.${format}`;
  return `${Date.now()}_${base.slice(0, 80) || 'photo'}${ext}`;
}
