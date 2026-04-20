/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  basePath: process.env.MARKETPLACE_BASE_PATH || '',
  distDir: process.env.MARKETPLACE_NEXT_DIST_DIR || '.next',
  allowedDevOrigins: [
    '127.0.0.1',
    'localhost',
    'market.sven.systems',
    'sven.systems',
  ],
  webpack(config) {
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
    };
    return config;
  },
  async rewrites() {
    const apiBase = process.env.NEXT_PUBLIC_MARKETPLACE_API || 'http://127.0.0.1:9478';
    return [
      { source: '/v1/market/:path*', basePath: false, destination: `${apiBase}/v1/market/:path*` },
    ];
  },
};
module.exports = nextConfig;
