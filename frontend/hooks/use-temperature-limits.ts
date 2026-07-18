"use client";

import { useLocalStorage } from "./use-local-storage";

export interface TemperatureLimits {
  minTemp: number;
  maxTemp: number;
  pinEnabled: boolean;
  /** Never store a real PIN in plaintext even for a toy client-side lock —
   * this is a simple non-cryptographic hash (see lib/simple-hash.ts),
   * which stops "someone glances at localStorage in devtools" but is NOT
   * a real security boundary. Said explicitly in the Settings UI too. */
  pinHash: string | null;
}

const DEFAULT_LIMITS: TemperatureLimits = {
  minTemp: 18,
  maxTemp: 30,
  pinEnabled: false,
  pinHash: null,
};

export function useTemperatureLimits() {
  return useLocalStorage<TemperatureLimits>("coolpilot:temperature-limits", DEFAULT_LIMITS);
}

export function clampToLimits(value: number, limits: TemperatureLimits): number {
  return Math.min(limits.maxTemp, Math.max(limits.minTemp, value));
}
