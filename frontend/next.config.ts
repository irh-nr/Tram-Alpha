import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  async rewrites() {
    return [
      {
        source: '/backend/:path*',
        destination: 'http://8.229.68.75:8000/:path*',
      },
    ];
  },
};

export default nextConfig;
