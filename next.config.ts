import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // A stray package-lock.json in the user's home directory (above this
    // project) makes Turbopack mis-infer the workspace root, which can
    // break file-system route discovery. Pin it explicitly.
    root: path.join(__dirname),
  },
  async redirects() {
    // Moonstock was replaced by Top BUY (docs/features_topbuy.md).
    return [{ source: '/moonstock', destination: '/topbuy', permanent: true }];
  },
};

export default nextConfig;
