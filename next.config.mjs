/** @type {import('next').NextConfig} */
const nextConfig = {
  // pg is only used on the server in "db" mode; keep it out of the bundle.
  serverExternalPackages: ['pg', 'pg-mem'],
};

export default nextConfig;
