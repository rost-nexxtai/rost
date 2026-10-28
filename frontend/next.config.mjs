const backend = process.env.BACKEND_URL ?? 'http://localhost:8080';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // The browser calls /api/* on this origin; Next proxies it to the backend, so the session cookie stays first-party.
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${backend}/api/:path*` }];
  },
};

export default nextConfig;
