/** @type {import('next').NextConfig} */
const nextConfig = {
  // The production host's build container is memory-constrained (512Mi).
  // Next's webpack build defaults to parallelizing across (CPU count - 1)
  // worker processes, each with its own heap — on a multi-core build
  // machine that easily adds up past 512Mi even though no single worker
  // is large, and the whole build gets OOM-killed. Capping to 1 trades
  // build speed for staying inside the container's memory limit.
  experimental: {
    cpus: 1,
  },
  // Type-checking and linting run as their own memory-heavy pass on top of
  // the webpack compile, and are what actually pushed the production
  // build over its 512Mi container limit. Both already run separately
  // before every merge (tsc --noEmit + eslint), so re-running them here
  // only spends memory the build doesn't have to spare.
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
