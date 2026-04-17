/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  basePath: process.env.EIDOLON_BASE_PATH || '',
  distDir: process.env.EIDOLON_NEXT_DIST_DIR || '.next',
  allowedDevOrigins: [
    '127.0.0.1',
    'localhost',
    'eidolon.sven.systems',
    'sven.systems',
  ],
  webpack(config) {
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
    };
    return config;
  },
  async rewrites() {
    const apiBase = process.env.NEXT_PUBLIC_EIDOLON_API || 'http://127.0.0.1:9479';
    return [
      { source: '/v1/eidolon/:path*', basePath: false, destination: `${apiBase}/v1/eidolon/:path*` },
    ];
  },
};
module.exports = nextConfig;
