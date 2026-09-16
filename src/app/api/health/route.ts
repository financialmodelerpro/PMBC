import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Which build is serving. Compare `sha` with `git rev-parse HEAD` after a
 * deploy to confirm the deployment is the commit you pushed.
 *
 * Reads only Vercel's build metadata. No database call, so it answers even
 * when Supabase does not, which is what a health check should do.
 */
export function GET() {
  return NextResponse.json(
    {
      ok: true,
      sha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
      ref: process.env.VERCEL_GIT_COMMIT_REF ?? null,
      env: process.env.VERCEL_ENV ?? 'local',
    },
    { headers: { 'cache-control': 'no-store' } },
  );
}
