const backend = process.env.BACKEND_URL ?? 'http://localhost:8080';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // A self-contained server in .next/standalone, so the Docker image doesn't need node_modules.
  output: 'standalone',
  // The browser calls /api/* on this origin; Next proxies it to the backend, so the session cookie stays first-party.
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${backend}/api/:path*` }];
  },
};

export default nextConfig;
