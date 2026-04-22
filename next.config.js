const { networkInterfaces } = require('os');

// Collect all local non-loopback IPv4 addresses so cross-origin _next/* requests
// from any device on the same LAN work without the "Blocked cross-origin" warning.
function getLocalIPs() {
  const ips = [];
  try {
    const ifaces = networkInterfaces();
    for (const iface of Object.values(ifaces)) {
      for (const addr of iface || []) {
        if (addr.family === 'IPv4' && !addr.internal) {
          ips.push(addr.address);
        }
      }
    }
  } catch {}
  return ips;
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone output for Docker deployments (Dockerfile copies .next/standalone).
  output: 'standalone',
  // Avoid running ESLint in `next build` on Vercel to prevent heap OOM on very large codebases.
  // Keep lint enforcement via `yarn lint` in CI/local workflows.
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Type checking can exceed memory limits on hosted builders for this monorepo-scale app.
  // Keep strict checks in a separate `yarn typecheck` step instead of blocking deploy builds.
  typescript: {
    ignoreBuildErrors: true,
  },
  // Keep Prisma client external so its internal "graph" is not broken in production (avoids "reading 'graph'" error).
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', '@prisma/adapter-pg'],
  },
  allowedDevOrigins: getLocalIPs(),
  async headers() {
    const enableCsp = process.env.SECURITY_CSP === '1';
    // upgrade-insecure-requests: only when explicitly enabled AND not local dev (localhost/0.0.0.0/127.0.0.1 or LOCAL_DEV=1).
    const allowUpgradeInsecure =
      process.env.SECURITY_UPGRADE_INSECURE_REQUESTS === '1' &&
      process.env.LOCAL_DEV !== '1';
    // Keep CSP conservative to avoid breaking Next.js/dev tooling.
    const csp = [
      "default-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'",
      "object-src 'none'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "style-src 'self' 'unsafe-inline'",
      // Next.js dev builds need unsafe-eval; keep this minimal but compatible.
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:",
      "connect-src 'self' https: wss:",
      ...(allowUpgradeInsecure ? ['upgrade-insecure-requests'] : []),
    ].join('; ');

    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          ...(enableCsp ? [{ key: 'Content-Security-Policy', value: csp }] : []),
        ],
      },
    ];
  },
  async redirects() {
    return [
      { source: '/ai/policy-harmonization', destination: '/alignment', permanent: true },
      { source: '/scheduling/availability', destination: '/scheduling/calendar', permanent: false },
    ];
  },
  env: {
    NEXT_PUBLIC_APP_NAME: 'Thea',
    NEXT_PUBLIC_APP_FULL_NAME: 'Thea EHR',
    NEXT_PUBLIC_COMPANY: 'Thea Technologies',
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Ensure pdfkit font files are accessible
      config.resolve.alias = {
        ...config.resolve.alias,
      };
    } else {
      config.resolve.fallback = {
        ...(config.resolve.fallback || {}),
        fs: false,
        path: false,
        module: false,
        crypto: false,
      };
    }
    return config;
  },
};

module.exports = nextConfig;
