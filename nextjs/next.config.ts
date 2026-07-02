import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob: https://cdn.jsdelivr.net https://unpkg.com https://huggingface.co",
              "script-src-elem 'self' 'unsafe-inline' blob: https://cdn.jsdelivr.net https://unpkg.com https://huggingface.co",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
              "connect-src 'self' http://localhost:9000 http://localhost:* https://cdn.jsdelivr.net https://unpkg.com https://*.supabase.co wss://*.supabase.co https://*.qdrant.io https://huggingface.co https://us.aws.cdn.hf.co",
              "worker-src 'self' blob: https://cdn.jsdelivr.net https://unpkg.com https://huggingface.co https://us.aws.cdn.hf.co",
              "child-src 'self' blob:",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
  serverExternalPackages: ["@huggingface/transformers"],
  turbopack: {
    root: path.resolve("."),
  },
};

export default nextConfig;
