import type { NextConfig } from "next";

const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN ?? "characterdev.systems";

const nextConfig: NextConfig = {
  output: "standalone",
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
