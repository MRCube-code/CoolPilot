"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import {
  Gauge,
  Wand2,
  Zap,
  Settings as SettingsIcon,
  Router,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: Gauge },
  { href: "/devices", label: "Devices", icon: Router },
  { href: "/automations", label: "Automations", icon: Wand2 },
  { href: "/energy", label: "Energy", icon: Zap },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="ambient-mesh min-h-dvh">
      {/* Desktop sidebar */}
      <div className="mx-auto flex max-w-6xl">
        <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-1 border-r border-border/60 px-4 py-6 md:flex">
          <div className="mb-6 flex items-center gap-2 px-2">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold">
              C
            </div>
            <span className="text-lg font-semibold tracking-tight">CoolPilot</span>
          </div>

          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <Icon className="size-4.5" />
                {item.label}
              </Link>
            );
          })}

          <div className="mt-auto flex items-center justify-between px-2">
            <Link href="/developer" className="text-xs text-muted-foreground hover:text-foreground">
              Developer Tools
            </Link>
            <ThemeToggle />
          </div>
        </aside>

        <div className="min-h-dvh w-full">
          {/* Mobile top bar */}
          <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border/60 bg-background/70 px-4 py-3 backdrop-blur-lg md:hidden">
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
                C
              </div>
              <span className="font-semibold tracking-tight">CoolPilot</span>
            </div>
            <ThemeToggle />
          </header>

          <main className="mx-auto w-full max-w-4xl px-4 pt-6 pb-24 md:px-8 md:pt-10 md:pb-12">
            {children}
          </main>
        </div>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border/60 bg-background/80 backdrop-blur-lg md:hidden">
        <div className="mx-auto flex max-w-4xl items-center justify-around px-2 py-2">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 text-[11px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="size-5" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
