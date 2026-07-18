"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { DeviceStatus } from "@/lib/types";

const POLL_INTERVAL_MS = 5000;

/**
 * The AC never pushes changes (docs/GREE_PROTOCOL.md section 5), and the
 * backend's own poller only refreshes its cache every ~10s (backend/app/
 * gree/poller.py). This hook polls the CACHED endpoint (fresh=false, the
 * default) on its own faster interval so the UI feels responsive without
 * hammering the AC directly — every poll here is just reading the
 * backend's in-memory cache, not a new UDP round trip.
 */
export function useDeviceStatus(mac: string | null) {
  const [status, setStatus] = useState<DeviceStatus | null>(null);
  const [polledAt, setPolledAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = useCallback(
    async (fresh = false) => {
      if (!mac) return;
      try {
        const result = await api.getStatus(mac, fresh);
        setStatus(result.status);
        setPolledAt(result.polled_at);
        setError(null);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Failed to read status");
      } finally {
        setLoading(false);
      }
    },
    [mac],
  );

  useEffect(() => {
    if (!mac) return;
    setLoading(true);
    fetchStatus(true); // force one fresh read on mount / device switch
    intervalRef.current = setInterval(() => fetchStatus(false), POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [mac, fetchStatus]);

  /** Optimistically updates local state, sends the command, then
   * reconciles with whatever the AC actually reports back. If the AC
   * rejects/ignores the change the next poll will correct the optimistic
   * guess — better to feel instant and occasionally self-correct than to
   * feel laggy on every single tap. */
  const sendCommand = useCallback(
    async (values: Record<string, number>) => {
      if (!mac) return;
      setStatus((prev) => (prev ? { ...prev, ...values } : prev));
      setSending(true);
      try {
        await api.sendCommand(mac, values);
        await fetchStatus(true);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Command failed");
        await fetchStatus(true); // reconcile back to whatever's actually true
      } finally {
        setSending(false);
      }
    },
    [mac, fetchStatus],
  );

  return { status, polledAt, loading, error, sending, sendCommand, refresh: () => fetchStatus(true) };
}
