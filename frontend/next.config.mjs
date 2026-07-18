const isCapacitorBuild = process.env.CAP_BUILD === "true";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Capacitor bundles static files into the APK — there's no Next.js
  // server on a phone, so the Capacitor build needs a full static export.
  // Normal `next dev` / `next build` for the regular website must NOT set
  // this, or dev mode and any future server-only features break. Run
  // `npm run build:capacitor` (sets CAP_BUILD=true) instead of `next
  // build` directly when building for Android.
  ...(isCapacitorBuild
    ? {
        output: "export",
        // Static export needs unoptimized images — there's no server
        // running on the phone to do on-demand image optimization.
        images: { unoptimized: true },
        // Without this, a hard refresh (or Capacitor loading a deep link
        // directly) on e.g. /devices looks for a file literally named
        // "devices" instead of "devices/index.html" and 404s. This is a
        // known Next static-export + Capacitor gotcha, not optional here.
        trailingSlash: true,
      }
    : {}),
};

export default nextConfig;
