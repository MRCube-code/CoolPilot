"use client";

import { useEffect, useRef } from "react";
import type { Automation } from "@/lib/types";
import { Mode } from "@/lib/property-labels";

type SendCommand = (values: Record<string, number>) => Promise<void>;
type StartSmartCool = () => Promise<void>;

const CHECK_INTERVAL_MS = 30_000;

/**
 * Only "time" triggers are actually evaluated — we have real data for
 * those (the browser clock). "outdoor_temp" needs the weather integration
 * (not built — Phase 3+, see README.md roadmap) and "presence" needs a
 * presence signal this app doesn't have any source for. Rather than fake
 * those triggers ever firing, this runner just skips them; the UI badges
 * this honestly (see app/automations/page.tsx) instead of implying every
 * automation is equally "live."
 *
 * This also only runs while a browser tab has this page mounted — there
 * is no background/server-side scheduler yet. That's a real limitation,
 * not a bug, and it's stated in Settings.
 */
export function useAutomationRunner(
  automations: Automation[],
  sendCommand: SendCommand,
  startSmartCool: StartSmartCool,
) {
  const lastFiredMinuteRef = useRef<Record<string, string>>({});

  useEffect(() => {
    const check = async () => {
      const now = new Date();
      const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

      for (const automation of automations) {
        if (!automation.enabled || automation.trigger.type !== "time") continue;
        if (automation.trigger.value !== hhmm) continue;
        if (lastFiredMinuteRef.current[automation.id] === hhmm) continue; // already fired this minute

        lastFiredMinuteRef.current[automation.id] = hhmm;
        await runAction(automation, sendCommand, startSmartCool);
      }
    };

    check();
    const interval = setInterval(check, CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [automations, sendCommand, startSmartCool]);
}

async function runAction(automation: Automation, sendCommand: SendCommand, startSmartCool: StartSmartCool) {
  switch (automation.action.type) {
    case "smart_cool":
      await startSmartCool();
      break;
    case "sleep_mode":
      await sendCommand({ Pow: 1, Mod: Mode.COOL, SwhSlp: 1 });
      break;
    case "power_off":
      await sendCommand({ Pow: 0 });
      break;
    case "set_temperature":
      if (automation.action.value !== undefined) {
        await sendCommand({ TemUn: 0, SetTem: automation.action.value });
      }
      break;
    case "turbo_off":
      await sendCommand({ Tur: 0 });
      break;
  }
}
