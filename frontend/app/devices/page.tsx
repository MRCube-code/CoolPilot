"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Loader2, RadioTower, Trash2, Wifi } from "lucide-react";

import { ConnectionBanner } from "@/components/connection-banner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api";
import { useDevices } from "@/hooks/use-devices";
import type { DiscoveredDevice } from "@/lib/types";

export default function DevicesPage() {
  const { devices: bound, refresh } = useDevices();
  const [scanning, setScanning] = useState(false);
  const [found, setFound] = useState<DiscoveredDevice[] | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [bindingMac, setBindingMac] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState<Record<string, string>>({});

  async function scan() {
    setScanning(true);
    setScanError(null);
    try {
      const result = await api.discoverDevices();
      setFound(result);
    } catch (err) {
      setScanError(err instanceof ApiError ? err.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  }

  async function bind(d: DiscoveredDevice) {
    setBindingMac(d.mac);
    try {
      await api.bindDevice({
        mac: d.mac,
        ip: d.ip,
        cipher_mode: d.cipher_mode,
        name: nameDraft[d.mac] || d.name,
      });
      await refresh();
      setFound((prev) => prev?.map((x) => (x.mac === d.mac ? { ...x, already_bound: true } : x)) ?? null);
    } catch (err) {
      setScanError(err instanceof ApiError ? err.message : "Bind failed");
    } finally {
      setBindingMac(null);
    }
  }

  async function forget(mac: string) {
    await api.forgetDevice(mac);
    await refresh();
  }

  return (
    <div className="space-y-6">
      <ConnectionBanner />
      <h1 className="text-2xl font-semibold tracking-tight">Device Manager</h1>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Paired devices</h2>
        {bound.length === 0 && (
          <p className="text-sm text-muted-foreground">No devices paired yet — scan below.</p>
        )}
        <div className="space-y-2">
          {bound.map((d) => (
            <Card key={d.mac} className="flex items-center justify-between p-4">
              <div>
                <p className="font-medium">{d.name || d.mac}</p>
                <p className="text-xs text-muted-foreground">
                  {d.ip} · {d.mac} · {d.cipher_mode.toUpperCase()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={d.last_status ? "success" : "outline"}>
                  {d.last_status ? "Responding" : "No status yet"}
                </Badge>
                <Button variant="ghost" size="icon" onClick={() => forget(d.mac)} aria-label="Forget device">
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground">Scan for devices on this network</h2>
          <Button onClick={scan} disabled={scanning} size="sm">
            {scanning ? <Loader2 className="size-4 animate-spin" /> : <RadioTower className="size-4" />}
            {scanning ? "Scanning…" : "Scan"}
          </Button>
        </div>

        {scanError && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {scanError}
          </div>
        )}

        {found && found.length === 0 && !scanning && (
          <p className="text-sm text-muted-foreground">
            No devices answered. Make sure this machine is on the same WiFi network as the AC, and
            that the AC is already paired via the GREE+ app — see docs/GREE_PROTOCOL.md in the repo.
          </p>
        )}

        <div className="space-y-2">
          {found?.map((d) => (
            <motion.div key={d.mac} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <Wifi className="size-4 text-primary" />
                  <div>
                    <p className="font-medium">{d.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {d.ip} · fw {d.firmware} · {d.cipher_mode.toUpperCase()}
                    </p>
                  </div>
                </div>
                {d.already_bound ? (
                  <Badge variant="success">Already paired</Badge>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="space-y-1">
                      <Label htmlFor={`name-${d.mac}`} className="sr-only">
                        Name
                      </Label>
                      <Input
                        id={`name-${d.mac}`}
                        placeholder={d.name || "Living room AC"}
                        className="h-9 w-40"
                        value={nameDraft[d.mac] ?? ""}
                        onChange={(e) => setNameDraft((prev) => ({ ...prev, [d.mac]: e.target.value }))}
                      />
                    </div>
                    <Button size="sm" onClick={() => bind(d)} disabled={bindingMac === d.mac}>
                      {bindingMac === d.mac ? <Loader2 className="size-4 animate-spin" /> : "Pair"}
                    </Button>
                  </div>
                )}
              </Card>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
}
