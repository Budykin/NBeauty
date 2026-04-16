import type { NextConfig } from "next";

const backendBaseUrl = process.env.BACKEND_INTERNAL_URL;
const allowedDevOrigins = process.env.ALLOWED_DEV_ORIGINS
  ?.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  devIndicators: false,
  ...(allowedDevOrigins && allowedDevOrigins.length > 0 ? { allowedDevOrigins } : {}),
  async rewrites() {
    if (!backendBaseUrl) {
      return [];
    }

    return [
      {
        source: "/api/:path*",
        destination: `${backendBaseUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
