import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Configure for static export (required for Tauri)
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },

  // Skip API routes during build since they won't be used in Tauri
  async generateBuildId() {
    return 'tauri-build';
  },

  webpack: (config, { isServer }) => {
    if (isServer) {
      // Handle native modules for server-side rendering
      config.externals = config.externals || [];
      config.externals.push({
        'cpu-features': 'commonjs cpu-features',
        'ssh2': 'commonjs ssh2',
        'node-ssh': 'commonjs node-ssh',
      });
    }

    // Ignore native modules in client-side bundle
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
      crypto: false,
      stream: false,
      util: false,
      url: false,
      zlib: false,
      http: false,
      https: false,
      assert: false,
      os: false,
      path: false,
    };

    return config;
  },
  serverExternalPackages: ['ssh2', 'node-ssh', 'cpu-features'],
};

export default nextConfig;
