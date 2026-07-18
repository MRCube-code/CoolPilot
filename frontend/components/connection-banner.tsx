"use client";

import { useEffect, useState } from "react";
import { WifiOff, Loader2 } from "lucide-react";
import { api } from "@/lib/api";

export function ConnectionBanner() {
  const [state, setState] = useState<"checking" | "ok" | "down">("checking");
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    api
      .health()
      .then(() => !cancelled && setState("ok"))
      .catch((err) => {
        if (cancelled) return;
        setState("down");
        setMessage(err instanceof Error ? err.message : "Backend unreachable");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state === "ok") return null;

  return (
    <div className="mb-4 flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      {state === "checking" ? (
        <Loader2 className="size-4 shrink-0 animate-spin" />
      ) : (
        <WifiOff className="size-4 shrink-0" />
      )}
      <span>
        {state === "checking"
          ? "Checking connection to the CoolPilot backend…"
          : message || "Can't reach the backend. Make sure it's running and NEXT_PUBLIC_API_BASE_URL is correct."}
      </span>
    </div>
  );
}
