"use client";

import { Trash2 } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import type { Automation } from "@/lib/types";

const TRIGGER_LABELS: Record<Automation["trigger"]["type"], (v: string) => string> = {
  time: (v) => `At ${v}`,
  outdoor_temp: (v) => `When outdoor temp ${v}°C`,
  turbo_runtime: (v) => `When Turbo has run for ${v} min`,
  presence: () => `When nobody's home`,
};

const ACTION_LABELS: Record<Automation["action"]["type"], (v?: number) => string> = {
  smart_cool: () => "Start Smart Cool",
  sleep_mode: () => "Enable Sleep mode",
  power_off: () => "Turn AC off",
  set_temperature: (v) => `Set temperature to ${v}°C`,
  turbo_off: () => "Turn Turbo off",
};

export function AutomationCard({
  automation,
  onToggle,
  onDelete,
}: {
  automation: Automation;
  onToggle: (id: string, enabled: boolean) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Card className="flex items-center justify-between p-4">
      <div className="min-w-0">
        <p className="truncate font-medium">{automation.name}</p>
        <p className="truncate text-sm text-muted-foreground">
          {TRIGGER_LABELS[automation.trigger.type](automation.trigger.value)} →{" "}
          {ACTION_LABELS[automation.action.type](automation.action.value)}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Switch checked={automation.enabled} onCheckedChange={(v) => onToggle(automation.id, v)} />
        <Button variant="ghost" size="icon" onClick={() => onDelete(automation.id)} aria-label="Delete automation">
          <Trash2 className="size-4" />
        </Button>
      </div>
    </Card>
  );
}
