"use client";

import { motion } from "framer-motion";
import { Fan, Gauge, Moon, Sparkles, Sun, Wind } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import { fanSpeedLabels, modeLabels } from "@/lib/property-labels";
import type { DeviceStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Pill {
  label: string;
  value: string;
  icon: LucideIcon;
  active: boolean;
}

export function StatusPillGrid({ status }: { status: DeviceStatus | null }) {
  if (!status) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="h-20 animate-pulse" />
        ))}
      </div>
    );
  }

  const pills: Pill[] = [
    {
      label: "Mode",
      value: status.Mod !== undefined ? (modeLabels[status.Mod] ?? "—") : "—",
      icon: Gauge,
      active: status.Pow === 1,
    },
    {
      label: "Fan speed",
      value: status.WdSpd !== undefined ? (fanSpeedLabels[status.WdSpd] ?? "—") : "—",
      icon: Fan,
      active: status.Pow === 1,
    },
    {
      label: "Turbo",
      value: status.Tur === 1 ? "On" : "Off",
      icon: Sparkles,
      active: status.Tur === 1,
    },
    {
      label: "Sleep",
      value: status.SwhSlp === 1 ? "On" : "Off",
      icon: Moon,
      active: status.SwhSlp === 1,
    },
    {
      label: "Quiet",
      value: status.Quiet === 1 ? "On" : "Off",
      icon: Wind,
      active: status.Quiet === 1,
    },
    {
      label: "Display",
      value: status.Lig === 1 ? "On" : "Off",
      icon: Sun,
      active: status.Lig === 1,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {pills.map((pill, i) => (
        <motion.div
          key={pill.label}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.03 }}
        >
          <Card className="flex flex-col gap-2 p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <pill.icon className={cn("size-4", pill.active && "text-primary")} />
              <span className="text-xs font-medium">{pill.label}</span>
            </div>
            <span className="text-lg font-semibold">{pill.value}</span>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
