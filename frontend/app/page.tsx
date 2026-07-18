"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { RefreshCw } from "lucide-react";

import { ConnectionBanner } from "@/components/connection-banner";
import { DevicePicker } from "@/components/device-picker";
import { TemperatureDial } from "@/components/temperature-dial";
import { StatusPillGrid } from "@/components/status-pill-grid";
import { QuickActions } from "@/components/quick-actions";
import { Button } from "@/components/ui/button";
import { useDevices } from "@/hooks/use-devices";
import { useDeviceStatus } from "@/hooks/use-device-status";
import { useTemperatureLimits, clampToLimits } from "@/hooks/use-temperature-limits";
import { accentForMode, modeLabels } from "@/lib/property-labels";

export default function DashboardPage() {
  const { devices, loading: devicesLoading } = useDevices();
  const [selectedMac, setSelectedMac] = useState<string | null>(null);

  useEffect(() => {
  const first = devices[0];
  if (!selectedMac && first) setSelectedMac(first.mac);
  }, [devices, selectedMac]);

  const { status, polledAt, loading, error, sending, sendCommand, refresh } =
    useDeviceStatus(selectedMac);
  const [limits] = useTemperatureLimits();

  const accent = accentForMode(status?.Mod, status?.Pow === 1);
  const modeLabel = status?.Mod !== undefined ? (modeLabels[status.Mod] ?? "—") : "—";

  return (
    <div className="space-y-6">
      <ConnectionBanner />

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <DevicePicker devices={devices} selectedMac={selectedMac} onSelect={setSelectedMac} />
      </div>

      {!devicesLoading && devices.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="glass-surface rounded-xl p-8 text-center"
        >
          <p className="mb-1 font-medium">No AC connected yet</p>
          <p className="text-sm text-muted-foreground">
            Head to Devices to scan your network and pair your Gree unit.
          </p>
        </motion.div>
      )}

      {selectedMac && (
        <>
          {error && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="glass-surface flex flex-col items-center gap-2 rounded-xl py-8">
            <TemperatureDial
              targetTemp={status?.SetTem ?? 24}
              minTemp={limits.minTemp}
              maxTemp={limits.maxTemp}
              accentColor={accent}
              modeLabel={modeLabel}
              powerOn={status?.Pow === 1}
              disabled={sending || loading}
              onIncrement={() =>
                sendCommand({ TemUn: 0, SetTem: clampToLimits((status?.SetTem ?? 24) + 1, limits) })
              }
              onDecrement={() =>
                sendCommand({ TemUn: 0, SetTem: clampToLimits((status?.SetTem ?? 24) - 1, limits) })
              }
            />
            <Button
              variant={status?.Pow === 1 ? "secondary" : "default"}
              className="mt-2"
              disabled={sending}
              onClick={() => sendCommand({ Pow: status?.Pow === 1 ? 0 : 1 })}
            >
              {status?.Pow === 1 ? "Turn off" : "Turn on"}
            </Button>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              {polledAt ? `Updated ${timeAgo(polledAt)}` : "—"}
              <button onClick={refresh} aria-label="Refresh now" className="rounded-full p-1 hover:bg-accent">
                <RefreshCw className="size-3" />
              </button>
            </div>
          </div>

          <section className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground">Quick actions</h2>
            <QuickActions mac={selectedMac} status={status} sendCommand={sendCommand} />
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground">Status</h2>
            <StatusPillGrid status={status} />
          </section>
        </>
      )}
    </div>
  );
}

function timeAgo(unixSeconds: number): string {
  const seconds = Math.round(Date.now() / 1000 - unixSeconds);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  return `${Math.round(seconds / 60)}m ago`;
}
