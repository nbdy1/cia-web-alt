import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    serverActions: {
      allowedOrigins: ["ciadraft.portalsi.com"],
    },
  },
};

export default nextConfig;
