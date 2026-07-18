"use client";

import { useEffect, useState } from "react";

/**
 * Plain localStorage persistence for client-only state (automations,
 * temperature-lock settings, PIN). This is explicitly a stand-in for
 * real backend persistence (Phase 3 — see README.md roadmap): it survives
 * a page reload on this device, but does not sync across devices and is
 * not enforced server-side. Don't build the PIN lock's actual security
 * guarantee on top of this — a client-side PIN only stops casual use, not
 * a determined family member with devtools open. Say so in the UI, don't
 * silently imply otherwise.
 */
export function useLocalStorage<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(initialValue);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) setValue(JSON.parse(raw));
    } catch {
      // corrupt or inaccessible storage — fall back to initialValue silently
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (!hydrated) return; // don't overwrite stored data with initialValue before we've loaded it
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // storage full / disabled — nothing useful to do here
    }
  }, [key, value, hydrated]);

  return [value, setValue, hydrated] as const;
}
