import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: { serverActions: { bodySizeLimit: '6mb' } },
  poweredByHeader: false,
  reactStrictMode: true,
  images: {
    remotePatterns:
      process.env.CLOUDINARY_CLOUD_NAME && /^[a-z0-9_-]+$/i.test(process.env.CLOUDINARY_CLOUD_NAME)
        ? [
            {
              protocol: 'https',
              hostname: 'res.cloudinary.com',
              pathname: `/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/**`,
              search: '',
            },
          ]
        : [],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
    ];
  },
};

export default nextConfig;
