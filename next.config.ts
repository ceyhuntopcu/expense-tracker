import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Without this, Next infers the workspace root as the parent GitHub
    // folder (many repos, too many files to watch) and dev crashes on EMFILE.
    root: path.join(__dirname),
  },
};

export default nextConfig;
