/**
 * Mirrors backend/app/gree/properties.py. Kept in sync by hand — there are
 * only ~20 fields and they change rarely (only when docs/GREE_PROTOCOL.md
 * gets new evidence), so a generated/shared schema would be more ceremony
 * than the two files are worth right now.
 */

export const Mode = {
  AUTO: 0,
  COOL: 1,
  DRY: 2,
  FAN: 3,
  HEAT: 4,
} as const;

export const FanSpeed = {
  AUTO: 0,
  LOW: 1,
  MEDIUM_LOW: 2,
  MEDIUM: 3,
  MEDIUM_HIGH: 4,
  HIGH: 5,
} as const;

export const modeLabels: Record<number, string> = {
  [Mode.AUTO]: "Auto",
  [Mode.COOL]: "Cool",
  [Mode.DRY]: "Dry",
  [Mode.FAN]: "Fan",
  [Mode.HEAT]: "Heat",
};

export const fanSpeedLabels: Record<number, string> = {
  [FanSpeed.AUTO]: "Auto",
  [FanSpeed.LOW]: "Low",
  [FanSpeed.MEDIUM_LOW]: "Med-low",
  [FanSpeed.MEDIUM]: "Medium",
  [FanSpeed.MEDIUM_HIGH]: "Med-high",
  [FanSpeed.HIGH]: "High",
};

export const propertyLabels: Record<string, string> = {
  Pow: "Power",
  Mod: "Mode",
  SetTem: "Target temperature",
  WdSpd: "Fan speed",
  Air: "Fresh air valve",
  Blo: "X-Fan",
  Health: "Health / cold plasma",
  SwhSlp: "Sleep mode",
  Lig: "Display light",
  SwingLfRig: "Horizontal swing",
  SwUpDn: "Vertical swing",
  Quiet: "Quiet mode",
  Tur: "Turbo",
  StHt: "8°C frost protection",
  TemUn: "Temperature unit",
  TemRec: "Fahrenheit half-degree bit",
  SvSt: "Power saving",
  TemSen: "Internal sensor temperature",
};

/** Mode number -> the CSS accent token (defined in app/globals.css) that
 * should color the dial, status pills, etc. Keeping this as the single
 * source of truth is what makes the whole UI tint consistently. */
export function accentForMode(mod: number | undefined, powerOn: boolean | undefined): string {
  if (!powerOn) return "var(--accent-off)";
  switch (mod) {
    case Mode.COOL:
      return "var(--accent-cool)";
    case Mode.HEAT:
      return "var(--accent-heat)";
    case Mode.DRY:
      return "var(--accent-eco)";
    default:
      return "var(--accent-cool)";
  }
}
