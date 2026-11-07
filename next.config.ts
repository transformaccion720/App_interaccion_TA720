import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // En Vercel dejamos que su propio builder empaquete la app; standalone se
  // usa solo para el servidor local (scripts de start usan .next/standalone).
  output: process.env.VERCEL ? undefined : "standalone",
  // Prisma y su CLI se resuelven desde node_modules en tiempo de ejecución:
  // evita que el bundler de Next rompa las rutas de los binarios del engine.
  serverExternalPackages: ["@prisma/client", "prisma"],
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
