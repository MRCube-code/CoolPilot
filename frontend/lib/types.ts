/**
 * These types mirror backend/app/main.py's actual response shapes,
 * field-for-field. If a route in main.py changes shape, update it here —
 * don't let the two drift, that's exactly the kind of silent mismatch
 * that causes "works in Postman, breaks in the UI" bugs.
 */

export type CipherMode = "ecb" | "gcm";

/** GET /api/devices/discover — one entry per device that answered the broadcast scan */
export interface DiscoveredDevice {
  mac: string;
  ip: string;
  name: string;
  firmware: string;
  cipher_mode: CipherMode;
  already_bound: boolean;
}

/** GET /api/devices — devices bound this backend session */
export interface BoundDevice {
  mac: string;
  ip: string;
  name: string;
  cipher_mode: CipherMode;
  last_status: DeviceStatus | null;
  last_status_at: number | null; // unix seconds
}

/**
 * Raw property dict as returned by the AC — keys are the Gree opcodes
 * (Pow, Mod, SetTem, ...), not renamed to English. See
 * lib/property-labels.ts for the human-readable mapping, and
 * docs/GREE_PROTOCOL.md section 4 in the repo root for what each one means.
 * Every field is optional because not every unit reports every key —
 * do not assume any of these are always present.
 */
export interface DeviceStatus {
  Pow?: number;
  Mod?: number;
  SetTem?: number;
  WdSpd?: number;
  Air?: number;
  Blo?: number;
  Health?: number;
  SwhSlp?: number;
  Lig?: number;
  SwingLfRig?: number;
  SwUpDn?: number;
  Quiet?: number;
  Tur?: number;
  StHt?: number;
  TemUn?: number;
  HeatCoolType?: number;
  TemRec?: number;
  SvSt?: number;
  TemSen?: number;
  [key: string]: number | undefined;
}

/** GET /api/devices/{mac}/status */
export interface StatusResponse {
  cached: boolean;
  polled_at: number | null;
  status: DeviceStatus;
}

/** GET /api/devices/{mac}/diagnostics and the per-device entries inside GET /api/diagnostics */
export interface DeviceDiagnostics {
  mac: string;
  ip: string;
  cipher_mode: CipherMode;
  bound: boolean;
  bound_at: number | null;
  last_success_at: number | null;
  last_error: string | null;
  last_error_at: number | null;
  consecutive_failures: number;
  total_commands: number;
  total_status_reads: number;
  total_errors: number;
  total_rebinds: number;
}

/** GET /api/diagnostics */
export interface SystemDiagnostics {
  poller: {
    interval_seconds: number;
    cycle_count: number;
    last_cycle_at: number | null;
  };
  devices: DeviceDiagnostics[];
}

/**
 * --- Not yet backed by the API — Phase 3+ ---
 * These types describe what the automations/energy UI works with TODAY,
 * entirely client-side (see lib/mock-data.ts and hooks/use-local-storage.ts).
 * They're kept here, clearly marked, so swapping to a real backend later
 * is a hook-body change, not a component rewrite.
 */

export type AutomationTriggerType = "time" | "outdoor_temp" | "turbo_runtime" | "presence";

export interface AutomationTrigger {
  type: AutomationTriggerType;
  /** "22:00" for time triggers, ">35" / "<25" style comparisons for temp triggers, minutes for turbo_runtime */
  value: string;
}

export type AutomationActionType = "smart_cool" | "sleep_mode" | "power_off" | "set_temperature" | "turbo_off";

export interface AutomationAction {
  type: AutomationActionType;
  value?: number;
}

export interface Automation {
  id: string;
  name: string;
  enabled: boolean;
  trigger: AutomationTrigger;
  action: AutomationAction;
  createdAt: number;
}

export interface EnergyDayPoint {
  date: string; // YYYY-MM-DD
  runtimeMinutes: number;
  estimatedKwh: number;
  estimatedCost: number;
}
