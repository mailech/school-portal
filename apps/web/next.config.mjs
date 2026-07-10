/** @type {import('next').NextConfig} */
const API_URL = process.env.API_URL ?? 'http://localhost:4000';

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@app/types'],
  // Same-origin BFF proxy: the browser calls /api/* on :3000 and Next forwards
  // to the NestJS API. Keeps auth cookies same-origin (no CORS gymnastics).
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${API_URL}/api/:path*` }];
  },
};

export default nextConfig;
