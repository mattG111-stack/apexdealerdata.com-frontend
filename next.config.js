/** @type {import('next').NextConfig} */

// Where the API lives.
//
// Locally this is empty, so the browser calls /api on the same origin and the
// rewrite below proxies it to the backend on :8000 — one URL, no CORS.
//
// On Railway the backend is a different service, so NEXT_PUBLIC_API_BASE is set
// to its public URL and the browser calls it directly. The rewrite must then be
// disabled: 127.0.0.1:8000 inside the frontend container is the frontend
// itself, and proxying there makes every API call fail.
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "";
const LOCAL_PROXY = process.env.API_PROXY_TARGET || "http://127.0.0.1:8000";

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async rewrites() {
    if (API_BASE) return [];
    return [{ source: "/api/:path*", destination: `${LOCAL_PROXY}/api/:path*` }];
  },
};

module.exports = nextConfig;
