import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Silence the workspace root inference warning
  turbopack: {
    root: path.resolve(__dirname),
  },
  // Security headers
  async headers() {
    const commonHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    ];
    return [
      {
        // Everything except /embed is denied framing entirely.
        source: "/((?!embed).*)",
        headers: [{ key: "X-Frame-Options", value: "DENY" }, ...commonHeaders],
      },
      {
        // The public donate widget is meant to be embedded on the Lighthouse Care
        // WordPress site. Allow framing from those origins only (CSP frame-ancestors
        // supersedes X-Frame-Options in modern browsers), and keep it off everywhere else.
        source: "/embed/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value:
              "frame-ancestors 'self' https://lighthousecare.org.au https://www.lighthousecare.org.au;",
          },
          ...commonHeaders,
        ],
      },
    ];
  },
};

export default nextConfig;
