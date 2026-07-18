"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FanSpeed } from "@/lib/property-labels";

const SMART_COOL_DURATION_MS = 15 * 60 * 1000;
const STORAGE_KEY = "coolpilot:smart-cool-until";

type SendCommand = (values: Record<string, number>) => Promise<void>;

/**
 * Implements the exact Smart Cool sequence from the brief: 24°C + Turbo on
 * -> wait 15 minutes -> Turbo off + Auto fan + 25°C. This is real command
 * dispatch through the same sendCommand the rest of the dashboard uses,
 * not a simulated/fake countdown — every phase transition actually calls
 * the backend. The "until" timestamp is persisted to localStorage so
 * refreshing the page mid-sequence doesn't lose track and leave Turbo
 * running forever.
 */
export function useSmartCool(mac: string | null, sendCommand: SendCommand) {
  const [active, setActive] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const finish = useCallback(async () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
    setActive(false);
    setSecondsRemaining(0);
    window.localStorage.removeItem(STORAGE_KEY);
    await sendCommand({ Tur: 0, WdSpd: FanSpeed.AUTO, TemUn: 0, SetTem: 25 });
  }, [sendCommand]);

  const armTimers = useCallback(
    (untilMs: number) => {
      const msLeft = untilMs - Date.now();
      setActive(true);
      setSecondsRemaining(Math.max(0, Math.round(msLeft / 1000)));

      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => {
        setSecondsRemaining(Math.max(0, Math.round((untilMs - Date.now()) / 1000)));
      }, 1000);

      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(finish, Math.max(0, msLeft));
    },
    [finish],
  );

  const start = useCallback(async () => {
    if (!mac) return;
    await sendCommand({ Pow: 1, TemUn: 0, SetTem: 24, Tur: 1 });
    const until = Date.now() + SMART_COOL_DURATION_MS;
    window.localStorage.setItem(STORAGE_KEY, String(until));
    armTimers(until);
  }, [mac, sendCommand, armTimers]);

  const cancel = useCallback(async () => {
    await finish();
  }, [finish]);

  // Resume an in-progress sequence after a page reload.
  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return;
    const until = Number(stored);
    if (Number.isNaN(until) || until <= Date.now()) {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }
    armTimers(until);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return { active, secondsRemaining, start, cancel };
}
