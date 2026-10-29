const backend = process.env.BACKEND_URL ?? 'http://localhost:8080';

// Like BACKEND_URL, the headers below are fixed at build time (Next writes them into the build).

/**
 * Partner origins that may frame the bank view (/embed), besides this site itself: space- or comma-separated,
 * e.g. "https://app.banca.ro https://*.banca.ro". Anything that isn't an origin fails the build, so a typo can't
 * slip another directive into the header.
 */
const embedAncestors = (process.env.EMBED_FRAME_ANCESTORS ?? '').split(/[\s,]+/).filter(Boolean);
for (const origin of embedAncestors) {
  if (!/^https?:\/\/(\*\.)?[a-z0-9.-]+(:\d+)?$/i.test(origin)) {
    throw new Error(`EMBED_FRAME_ANCESTORS: "${origin}" is not an origin like https://app.banca.ro`);
  }
}

// HSTS only when the site is served over HTTPS: on plain http it would be ignored at best, a lockout at worst.
const hsts = ['1', 'true'].includes((process.env.HSTS ?? '').toLowerCase());

const everywhere = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Nothing in the app uses these. The payslip photo is an <input type="file" capture>, which opens the
  // system picker and needs no camera permission.
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), hid=(), midi=(), display-capture=(), accelerometer=(), gyroscope=(), magnetometer=(), browsing-topics=()',
  },
  ...(hsts ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000' }] : []),
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  // A self-contained server in .next/standalone, so the Docker image doesn't need node_modules.
  output: 'standalone',
  // Type-check the app without tests: they read backend seed files that aren't in the Docker build context.
  typescript: { tsconfigPath: 'tsconfig.build.json' },
  poweredByHeader: false,
  // The browser calls /api/* on this origin; Next proxies it to the backend, so the session cookie stays first-party.
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${backend}/api/:path*` }];
  },
  async headers() {
    return [
      // No other site may frame the app...
      {
        source: '/:path((?!embed(?:/|$)).*)',
        headers: [...everywhere, { key: 'X-Frame-Options', value: 'DENY' }, { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" }],
      },
      // ...except the bank view, made to be framed by this site and the partners in EMBED_FRAME_ANCESTORS.
      {
        source: '/embed/:path*',
        headers: [...everywhere, { key: 'Content-Security-Policy', value: ["frame-ancestors 'self'", ...embedAncestors].join(' ') }],
      },
    ];
  },
};

export default nextConfig;
