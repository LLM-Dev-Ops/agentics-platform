/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  transpilePackages: ['@agentics/sdk'],
  async rewrites() {
    const apiOrigin = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    return [
      {
        source: '/v1/:path*',
        destination: `${apiOrigin}/v1/:path*`,
      },
    ]
  },
}

export default nextConfig
