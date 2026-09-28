import type { NextConfig } from "next";

// Interface hébergée sans le serveur de jeu (ex. Vercel) : l'API de la régie est relayée vers ce serveur.
const gameServer = process.env.NEXT_PUBLIC_GAME_SERVER_URL?.replace(/\/+$/, "");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  transpilePackages: ["three"],
  async rewrites() {
    return gameServer ? [{ source: "/api/admin/:path*", destination: `${gameServer}/api/admin/:path*` }] : [];
  },
};

export default nextConfig;
