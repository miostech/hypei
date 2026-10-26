import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle for the Docker image.
  output: "standalone",
  typedRoutes: true,
  // Keep the dev overlay away from the sidebar.
  devIndicators: { position: "bottom-right" },
  poweredByHeader: false,
  images: {
    // Producers may point logos/thumbnails at their own CDNs.
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  /**
   * Baseline security headers. CSP and X-Frame-Options are deliberately absent: both need a
   * decision first — whether producers may embed the checkout in an iframe, and which Stripe
   * origins the checkout needs — and a wrong value there breaks paying customers silently.
   *
   * Permissions-Policy leaves `payment` untouched on purpose: Apple Pay and Google Pay in the
   * Stripe Payment Element depend on it.
   */
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Only takes effect over HTTPS; browsers ignore it on plain http, including localhost.
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
