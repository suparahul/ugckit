/** @type {import('next').NextConfig} */
export default {
  // media/ lives outside the project and is read in place, so image
  // optimisation is off — files are streamed by app/media/[...path]/route.ts.
  images: { unoptimized: true },
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
};
