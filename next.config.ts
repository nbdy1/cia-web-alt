import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    serverActions: {
      allowedOrigins: ["ciadraft.portalsi.com"],
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
