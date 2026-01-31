import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@agent-workspace/core", "@agent-workspace/utils", "@agent-workspace/agent"],
  serverExternalPackages: ["gray-matter"],
};

export default nextConfig;
