

const nextConfig = {
  experimental: {
    turbo: false,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  output: "standalone",
};

module.exports = nextConfig;
