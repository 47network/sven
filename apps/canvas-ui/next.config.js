/** @type {import('next').NextConfig} */
const canvasBasePath = process.env.CANVAS_BASE_PATH || '';

const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  ...(canvasBasePath
    ? {
        basePath: canvasBasePath,
        assetPrefix: canvasBasePath,
      }
    : {}),
  async rewrites() {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3000';
    return [
      {
        source: '/v1/:path*',
        destination: `${apiBase}/v1/:path*`,
      },
      {
        source: '/api/:path*',
        destination: `${apiBase}/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
