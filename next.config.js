/** @type {import('next').NextConfig} */
function getSupabaseCspSources() {
  const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  if (!configuredUrl) return [];

  try {
    const origin = new URL(configuredUrl).origin;
    return [origin, origin.replace(/^http/, 'ws')];
  } catch {
    return [];
  }
}

const nextConfig = {
  poweredByHeader: false,
  typescript: {
    ignoreBuildErrors: false,
  },
  async headers() {
    const supabaseSources = getSupabaseCspSources();
    const supabaseHttpSource = supabaseSources.find((source) => source.startsWith('http'));
    const securityHeaders = [
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
      { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
      { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
    ];

    if (process.env.NODE_ENV === 'production') {
      securityHeaders.push(
        { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        {
          key: 'Content-Security-Policy',
          value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline'",
            "style-src 'self' 'unsafe-inline'",
            ["img-src 'self' blob: data:", supabaseHttpSource, 'https://lh3.googleusercontent.com']
              .filter(Boolean)
              .join(' '),
            "media-src 'self' blob:",
            "font-src 'self'",
            ["connect-src 'self'", ...supabaseSources].join(' '),
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self'",
            "frame-ancestors 'none'",
            'upgrade-insecure-requests',
          ].join('; '),
        }
      );
    }

    return [
      { source: '/:path*', headers: securityHeaders },
      {
        source: '/sw.js',
        headers: [
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self'" },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ];
  },
};
module.exports = nextConfig;
