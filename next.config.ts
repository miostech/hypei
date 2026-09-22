import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle for the Docker image.
  output: "standalone",
  typedRoutes: true,
  poweredByHeader: false,
  images: {
    // Producers may point logos/thumbnails at their own CDNs.
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

export default nextConfig;
