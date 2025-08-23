import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
