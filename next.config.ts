import path from "node:path";
import type { NextConfig } from "next";

const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN ?? "characterdev.systems";

const nextConfig: NextConfig = {
  output: "standalone",
  // Pin the project root. Without this Next walks up, finds the stray
  // package-lock.json in the parent "webdev" folder and treats THAT as the root:
  // it then watches every sibling project and fails to resolve "tailwindcss",
  // which loops and pegs CPU/RAM/disk.
  turbopack: { root: path.resolve(process.cwd()) },
  async headers() {
    return [
      {
        // The worker must never be cached, or a bad version could stick on
        // teachers' phones. Content-Type must be JS for registration to succeed.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
  async redirects() {
    return [
      // BK replaced the earlier BP name. Keep historic links usable while
      // making /bk the only canonical route family.
      { source: "/bp", destination: "/bk", permanent: true },
      { source: "/bp/:path*", destination: "/bk/:path*", permanent: true },
      { source: "/admin/bp", destination: "/admin/bk", permanent: true },
      { source: "/admin/bp/:path*", destination: "/admin/bk/:path*", permanent: true },
    ];
  },
  experimental: {
    serverActions: {
      // Cloudflare Tunnel and its local reverse proxy must preserve the tenant
      // host for Server Actions. Explicitly allow the apex and school subdomains
      // while retaining the prior draft host during the infrastructure move.
      allowedOrigins: ["ciadraft.portalsi.com", appDomain, `*.${appDomain}`],
    },
  },
  images: {
    remotePatterns: [
      {
        // Supabase Storage — covers any project subdomain
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
