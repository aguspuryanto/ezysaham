import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Ada lockfile lain di folder home; kunci root workspace ke folder ini.
  turbopack: { root: path.resolve(__dirname) },
};

export default nextConfig;
