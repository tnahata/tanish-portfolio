import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    unoptimized: false,
  },
  async redirects() {
    return [
      {
        source: '/projects/ai-agent',
        destination: '/projects/discovery-agent',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
