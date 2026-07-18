import type { CapacitorConfig } from "@capacitor/cli";

/**
 * appId is a reverse-domain package identifier — Android treats it as a
 * permanent identity once published (can't change it without shipping a
 * brand new app listing). "com.mrcube.coolpilot" is a reasonable default
 * matching the GitHub org (MRCube-code) but is NOT something I can verify
 * you actually want — change it now, before any real release, not after.
 */
const config: CapacitorConfig = {
  appId: "com.mrcube.coolpilot",
  appName: "CoolPilot",
  webDir: "out", // matches next.config.mjs's static export output directory
  server: {
    // Capacitor 8 defaults to https already — set explicitly so the value
    // backend/app/main.py's CORS allowlist needs (https://localhost) is
    // documented in one obvious place instead of relying on an implicit
    // default that could change between Capacitor versions.
    androidScheme: "https",
  },
};

export default config;
