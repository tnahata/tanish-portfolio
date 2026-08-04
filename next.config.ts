import type { NextConfig } from 'next';
import { withBotId } from 'botid/next/config';

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
      {
        source: '/projects/discovery-agent',
        destination: '/projects/noiseless',
        permanent: true,
      },
    ];
  },
};

export default withBotId(nextConfig);
