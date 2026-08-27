import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone", // required for Docker/Azure Container Apps deployment
  images: {
    // Supabase Storage already serves reasonably sized files — skip Vercel's
    // optimizer to avoid the Hobby plan's monthly optimized-image cap.
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
    ],
  },
};

export default nextConfig;
