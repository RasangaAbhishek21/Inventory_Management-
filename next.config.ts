import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";

// Serwist 9 injects the SW via a webpack plugin, so builds run with `next build
// --webpack` (see the "build" script). This flag just quiets Serwist's Turbopack notice.
process.env.SERWIST_SUPPRESS_TURBOPACK_WARNING = "1";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.js",
  swDest: "public/sw.js",
  // Registered manually in src/components/pwa/RegisterSW.tsx (App Router auto-register
  // is unreliable), so no register script is injected here.
  register: false,
  // The SW is a build-time asset; disable it in `next dev` so HMR isn't cached.
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {};

export default withSerwist(nextConfig);
