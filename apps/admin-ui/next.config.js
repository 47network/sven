/** @type {import('next').NextConfig} */
const adminBasePath =
  process.env.PLAYWRIGHT === '1' ? '' : (process.env.ADMIN_BASE_PATH ?? '/admin47');

const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  basePath: adminBasePath,
  distDir: process.env.ADMIN_NEXT_DIST_DIR || '.next',
  allowedDevOrigins: [
    '127.0.0.1',
    'localhost',
    'sven.systems',
    'app.sven.systems',
    'admin.sven.systems',
    'sven.glyph.47matrix.online',
    'sven.47matrix.online',
  ],
  async rewrites() {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3000';
    return [
      {
        source: '/v1/:path*',
        basePath: false,
        destination: `${apiBase}/v1/:path*`,
      },
      {
        source: '/api/:path*',
        basePath: false,
        destination: `${apiBase}/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
