import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    const headers = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      { key: "X-Frame-Options", value: "DENY" },
      {
        key: "Content-Security-Policy",
        value: [
          "default-src 'self'",
          "base-uri 'self'",
          "form-action 'self'",
          "frame-ancestors 'none'",
          "img-src 'self' data: blob: https:",
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
          "font-src 'self' data: https://fonts.gstatic.com",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://pagead2.googlesyndication.com",
          "connect-src 'self' https://*.supabase.co",
          "frame-src 'self' https://googleads.g.doubleclick.net https://*.supabase.co",
        ].join("; "),
      },
      ...(process.env.ENABLE_HSTS === "true"
        ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]
        : []),
    ];

    return [{ source: "/:path*", headers }];
  },
};

export default nextConfig;
