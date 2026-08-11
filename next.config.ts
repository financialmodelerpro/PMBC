import type { NextConfig } from 'next';

/**
 * Allowed remote hosts for `next/image`. The Supabase project domain is
 * pulled from `SUPABASE_URL` (or its public mirror) so admin-uploaded
 * assets stored in Supabase Storage render without a config change. Other
 * hosts are added explicitly. Only add a host here once you have confirmed
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

// Cloudinary, a common admin choice for hosted images. Safe to keep
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
  async redirects() {
    return [
      {
        // /about was merged into the home page. A 301 rather than Next's
        // `permanent: true`, which emits a 308: both are permanent, but 301 is
        // what search engines and old bookmarks have handled for two decades,
        // and some older clients still mishandle 308 on a GET.
        source: '/about',
        destination: '/',
        statusCode: 301,
      },
      {
        // Service 06 became "Real Estate Financial Modeling" at /services/refm
        // on 2026-08-11 (migration 047). Same 301 reasoning as above. Straight
        // to the final URL, not through another redirect, so an indexed link
        // resolves in one hop and passes its signal once.
        //
        // This `source` is the one place in live source that still carries the
        // old slug, and it has to: it is the address being redirected FROM.
        source: '/services/real-estate-modeling',
        destination: '/services/refm',
        statusCode: 301,
      },
    ];
  },
};

export default nextConfig;
