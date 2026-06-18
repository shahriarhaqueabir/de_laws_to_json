import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for Transformers.js and other WASM/Worker based libraries
  // to enable high-performance shared memory features.
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'require-corp',
          },
        ],
      },
    ];
  },
  // Suppress warnings from Transformers.js about local models during build
  serverExternalPackages: ['@huggingface/transformers'],
};

export default nextConfig;
