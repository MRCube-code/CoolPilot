"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Send } from "lucide-react";

import { ConnectionBanner } from "@/components/connection-banner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api";
import type { SystemDiagnostics } from "@/lib/types";

export default function DeveloperToolsPage() {
  const [diagnostics, setDiagnostics] = useState<SystemDiagnostics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rawMac, setRawMac] = useState("");
  const [rawJson, setRawJson] = useState('{\n  "Pow": 1,\n  "SetTem": 24\n}');
  const [rawResult, setRawResult] = useState<string | null>(null);

  async function load() {
    try {
      const result = await api.systemDiagnostics();
      setDiagnostics(result);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load diagnostics");
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, []);

  async function sendRaw() {
    setRawResult(null);
    try {
      const values = JSON.parse(rawJson);
      const result = await api.sendCommand(rawMac, values);
      setRawResult(JSON.stringify(result, null, 2));
    } catch (err) {
      setRawResult(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return (
    <div className="space-y-6">
      <ConnectionBanner />
      <h1 className="text-2xl font-semibold tracking-tight">Developer Tools</h1>
      <p className="text-sm text-muted-foreground">
        Everything on this page is real — it reads GET /api/diagnostics directly, no placeholder data.
      </p>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Poller</CardTitle>
          <Button variant="ghost" size="icon" onClick={load} aria-label="Refresh">
            <RefreshCw className="size-4" />
          </Button>
        </CardHeader>
        <CardContent>
          {diagnostics ? (
            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              <Stat label="Interval" value={`${diagnostics.poller.interval_seconds}s`} />
              <Stat label="Cycles run" value={String(diagnostics.poller.cycle_count)} />
              <Stat
                label="Last cycle"
                value={diagnostics.poller.last_cycle_at ? new Date(diagnostics.poller.last_cycle_at * 1000).toLocaleTimeString() : "—"}
              />
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">Loading…</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Per-device diagnostics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {diagnostics?.devices.length === 0 && (
            <p className="text-sm text-muted-foreground">No devices bound.</p>
          )}
          {diagnostics?.devices.map((d) => (
            <div key={d.mac} className="space-y-2 rounded-lg bg-accent/40 p-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm">{d.mac}</span>
                <Badge variant={d.consecutive_failures > 0 ? "warning" : "success"}>
                  {d.consecutive_failures > 0 ? `${d.consecutive_failures} recent failures` : "healthy"}
                </Badge>
              </div>
              <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                <Stat label="Cipher" value={d.cipher_mode.toUpperCase()} />
                <Stat label="Commands sent" value={String(d.total_commands)} />
                <Stat label="Status reads" value={String(d.total_status_reads)} />
                <Stat label="Rebinds" value={String(d.total_rebinds)} />
                <Stat label="Total errors" value={String(d.total_errors)} />
                <Stat
                  label="Last success"
                  value={d.last_success_at ? new Date(d.last_success_at * 1000).toLocaleTimeString() : "—"}
                />
              </dl>
              {d.last_error && <p className="text-xs text-destructive">Last error: {d.last_error}</p>}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Raw command sender</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Sends exactly the JSON below to POST /api/devices/{"{mac}"}/command — bypasses every
            quick-action mapping, useful for testing a property directly.
          </p>
          <div className="space-y-1.5">
            <Label>Device MAC</Label>
            <input
              className="flex h-9 w-full rounded-lg border border-input bg-background/50 px-3 text-sm"
              value={rawMac}
              onChange={(e) => setRawMac(e.target.value)}
              placeholder="580d0d54b6ea"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Values (JSON)</Label>
            <textarea
              className="h-32 w-full rounded-lg border border-input bg-background/50 p-3 font-mono text-xs"
              value={rawJson}
              onChange={(e) => setRawJson(e.target.value)}
            />
          </div>
          <Button onClick={sendRaw} disabled={!rawMac}>
            <Send className="size-4" /> Send
          </Button>
          {rawResult && (
            <pre className="overflow-auto rounded-lg bg-accent/40 p-3 text-xs">{rawResult}</pre>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}
