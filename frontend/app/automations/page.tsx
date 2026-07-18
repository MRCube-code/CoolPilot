"use client";

import { AlertTriangle } from "lucide-react";

import { ConnectionBanner } from "@/components/connection-banner";
import { AutomationCard } from "@/components/automation-card";
import { AutomationFormDialog } from "@/components/automation-form-dialog";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { useDevices } from "@/hooks/use-devices";
import { useDeviceStatus } from "@/hooks/use-device-status";
import { useAutomationRunner } from "@/hooks/use-automation-runner";
import { useSmartCool } from "@/hooks/use-smart-cool";
import type { Automation } from "@/lib/types";

export default function AutomationsPage() {
  const { devices } = useDevices();
  // Automations act on the first paired device for now — multi-device
  // automation targeting is Phase 3 (needs a per-rule device selector +
  // real backend persistence, not worth building into localStorage-only
  // rules that don't survive Phase 3's rewrite anyway).
  const mac = devices[0]?.mac ?? null;
  const { sendCommand } = useDeviceStatus(mac);
  const smartCool = useSmartCool(mac, sendCommand);

  const [automations, setAutomations, hydrated] = useLocalStorage<Automation[]>("coolpilot:automations", []);

  useAutomationRunner(automations, sendCommand, smartCool.start);

  function toggle(id: string, enabled: boolean) {
    setAutomations((prev) => prev.map((a) => (a.id === id ? { ...a, enabled } : a)));
  }

  function remove(id: string) {
    setAutomations((prev) => prev.filter((a) => a.id !== id));
  }

  function create(a: Automation) {
    setAutomations((prev) => [...prev, a]);
  }

  return (
    <div className="space-y-6">
      <ConnectionBanner />

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Automations</h1>
        <AutomationFormDialog onCreate={create} />
      </div>

      <div className="flex gap-3 rounded-xl border border-accent-heat/30 bg-accent-heat/10 px-4 py-3 text-sm">
        <AlertTriangle className="size-4 shrink-0 text-accent-heat" />
        <div className="text-accent-heat">
          <p className="font-medium">Two real limitations, not bugs:</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            <li>Only <strong>time</strong> triggers actually run right now — outdoor-temperature and
              presence triggers need the weather/presence integrations, which aren't built yet.</li>
            <li>Automations only fire while this app is open in a browser tab — there's no background
              scheduler on the backend yet (Phase 3).</li>
          </ul>
        </div>
      </div>

      {!mac && (
        <p className="text-sm text-muted-foreground">Pair a device in Device Manager first.</p>
      )}

      {hydrated && automations.length === 0 && mac && (
        <p className="text-sm text-muted-foreground">No automations yet — create one above.</p>
      )}

      <div className="space-y-2">
        {automations.map((a) => (
          <AutomationCard key={a.id} automation={a} onToggle={toggle} onDelete={remove} />
        ))}
      </div>
    </div>
  );
}
