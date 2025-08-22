/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Enable server actions for potential future enhancements
    serverActions: {
      bodySizeLimit: '10mb', // Support large CSV imports
    },
  },
  // Optimize production builds
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  // Alternative: Consider using webpack config for custom worker setup
  // webpack: (config) => { ... }
};

export default nextConfig;