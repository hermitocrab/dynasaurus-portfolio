import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: '/login', destination: '/auth/login', permanent: true },
      { source: '/intro.html', destination: '/intro', permanent: true },
    ];
  },
  async headers() {
    const noStoreHeaders = [
      { key: 'Cache-Control', value: 'no-store, max-age=0, must-revalidate' },
    ];
    const publicContentHeaders = [
      { key: 'Cache-Control', value: 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800' },
    ];

    return [
      { source: '/', headers: noStoreHeaders },
      { source: '/mini', headers: noStoreHeaders },
      { source: '/pricing', headers: noStoreHeaders },
      { source: '/intro', headers: publicContentHeaders },
      { source: '/about', headers: publicContentHeaders },
      { source: '/method/rua', headers: publicContentHeaders },
      { source: '/faq', headers: publicContentHeaders },
      { source: '/privacy', headers: publicContentHeaders },
      { source: '/auth/:path*', headers: noStoreHeaders },
      { source: '/payment/:path*', headers: noStoreHeaders },
      {
        source: '/api/:path*',
        headers: [
          ...noStoreHeaders,
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
