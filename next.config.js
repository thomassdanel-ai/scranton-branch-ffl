/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'sleepercdn.com',
      },
    ],
  },
  async headers() {
    // Content-Security-Policy:
    //   - script-src needs 'unsafe-inline' for Next's hydration/runtime chunks,
    //     and 'unsafe-eval' in dev for HMR. We keep 'unsafe-eval' in prod for
    //     now (cost of removing it is migrating to nonce-based CSP and rewiring
    //     a couple of client-side libs). Revisit once we add a nonce middleware.
    //   - style-src needs 'unsafe-inline' for Tailwind's JIT and Next's
    //     next/font injected style tags.
    //   - connect-src allows Supabase REST + Realtime (wss) and the Sleeper API.
    //   - img-src allows the Sleeper CDN avatars.
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://sleepercdn.com",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.sleeper.app",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join('; ');

    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
