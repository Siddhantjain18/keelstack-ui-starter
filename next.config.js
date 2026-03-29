/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  /**
   * Proxy /api/* to the KeelStack Engine backend.
   *
   * This eliminates CORS entirely in development — the browser talks to
   * localhost:3001 (Next.js), which forwards to localhost:3000 (engine).
   * Same-origin from the browser's perspective. No CORS headers needed.
   *
   * In production: deploy the engine behind the same domain (e.g., via
   * a reverse proxy or Vercel rewrites), or set CORS_ORIGIN on the engine
   * to your frontend domain.
   */
  async rewrites() {
    const engineUrl =
      process.env.KEELSTACK_API_URL ?? "http://localhost:3000";
    return [
      {
        source: "/api/:path*",
        destination: `${engineUrl}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
