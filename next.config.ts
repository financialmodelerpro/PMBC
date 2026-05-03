import type { NextConfig } from 'next';

/**
 * Allowed remote hosts for `next/image`. The Supabase project domain is
 * pulled from `SUPABASE_URL` (or its public mirror) so admin-uploaded
 * assets stored in Supabase Storage render without a config change. Other
 * hosts are added explicitly — only add a host here once you've confirmed
 * its content is trusted (next/image fetches and re-encodes whatever it
 * loads, and a mistake here is a vector for hot-linking abuse).
 */
function supabaseHostname(): string | null {
  const raw =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '';
  if (!raw) return null;
  try {
    return new URL(raw).hostname;
  } catch {
    return null;
  }
}

const remotePatterns: NonNullable<NextConfig['images']>['remotePatterns'] = [];

const supabaseHost = supabaseHostname();
if (supabaseHost) {
  remotePatterns.push({
    protocol: 'https',
    hostname: supabaseHost,
    pathname: '/storage/v1/object/public/**',
  });
}

// Catch-all for any Supabase project (handy in preview builds where the
// project ref differs from production).
remotePatterns.push({
  protocol: 'https',
  hostname: '*.supabase.co',
  pathname: '/storage/v1/object/public/**',
});

// Cloudinary — common admin choice for hosted images. Safe to keep
// permanently; remove if not used.
remotePatterns.push({
  protocol: 'https',
  hostname: 'res.cloudinary.com',
});

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns,
  },
};

export default nextConfig;
