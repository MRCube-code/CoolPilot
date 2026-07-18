/**
 * ⚠️ EVERYTHING IN THIS FILE IS PLACEHOLDER DATA. ⚠️
 *
 * The backend does not compute energy costs, runtime history, or
 * statistics yet (see README.md roadmap — that's Phase 4, and it needs
 * real measured runtime + your actual electricity tariff, not a guessed
 * wattage figure). The Energy and Statistics pages import from here so
 * the UI can be built and reviewed now, but every number on those pages
 * is fake and every card that uses this data says so visibly — do not
 * remove those labels when wiring in real data later, remove this whole
 * file instead and point the charts at a real API response.
 */

import type { EnergyDayPoint } from "./types";

export const MOCK_DATA_WARNING =
  "Placeholder data — not connected to your real AC's energy usage yet.";

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

// Deterministic fake pattern (not random) so screenshots/reviews are
// reproducible — heavier runtime midweek, lighter on weekends, roughly
// what a Bangladesh cooling-season household might look like, but this
// is illustrative shape only, not a claim about your actual usage.
const SHAPE = [4.2, 5.8, 6.1, 5.4, 6.8, 3.1, 2.4];
const TARIFF_PER_KWH = 9.5; // BDT — placeholder, replace with your real tariff in Settings once that's wired up

export const mockEnergyLast7Days: EnergyDayPoint[] = Array.from({ length: 7 }, (_, i) => {
  const hours = SHAPE[i] ?? 4;
  const kwh = Math.round(hours * 1.35 * 10) / 10; // ~1.35kW average draw for an 18,000 BTU inverter unit, illustrative only
  return {
    date: daysAgo(6 - i),
    runtimeMinutes: Math.round(hours * 60),
    estimatedKwh: kwh,
    estimatedCost: Math.round(kwh * TARIFF_PER_KWH),
  };
});

export const mockModeDistribution = [
  { name: "Cool", value: 68, color: "var(--accent-cool)" },
  { name: "Dry", value: 14, color: "var(--accent-eco)" },
  { name: "Fan", value: 9, color: "var(--accent-off)" },
  { name: "Off", value: 9, color: "var(--muted-foreground)" },
];

export const mockAiSuggestions = [
  {
    id: "s1",
    text: "Outdoor temperature has been under 28°C for the last hour — this would be a good time to run fan-only mode instead of cooling.",
  },
  {
    id: "s2",
    text: "Turbo has been used 9 times this week, usually within 10 minutes of turning the unit on. The Smart Cool quick action does this automatically and turns itself off — worth using instead of manual Turbo.",
  },
  {
    id: "s3",
    text: "Most of this week's runtime happened between 1pm–5pm. A pre-cooling automation an hour earlier, at a higher target temperature, typically uses less energy than cooling from a hot room quickly.",
  },
];
