import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    // Supabase Storage serves the media library. Add your project host here
    // once you know it, or images from the picker will not render.
    remotePatterns: [{ protocol: 'https', hostname: '*.supabase.co' }],
  },
};

export default nextConfig;
