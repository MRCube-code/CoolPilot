"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Automation, AutomationActionType, AutomationTriggerType } from "@/lib/types";

const TRIGGER_OPTIONS: { value: AutomationTriggerType; label: string; placeholder: string }[] = [
  { value: "time", label: "At a specific time", placeholder: "22:00" },
  { value: "outdoor_temp", label: "Outdoor temperature", placeholder: ">35" },
  { value: "turbo_runtime", label: "Turbo has been running", placeholder: "15" },
  { value: "presence", label: "Nobody's home", placeholder: "n/a" },
];

const ACTION_OPTIONS: { value: AutomationActionType; label: string; needsValue: boolean }[] = [
  { value: "smart_cool", label: "Start Smart Cool", needsValue: false },
  { value: "sleep_mode", label: "Enable Sleep mode", needsValue: false },
  { value: "power_off", label: "Turn AC off", needsValue: false },
  { value: "set_temperature", label: "Set temperature", needsValue: true },
  { value: "turbo_off", label: "Turn Turbo off", needsValue: false },
];

export function AutomationFormDialog({ onCreate }: { onCreate: (a: Automation) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [triggerType, setTriggerType] = useState<AutomationTriggerType>("time");
  const [triggerValue, setTriggerValue] = useState("22:00");
  const [actionType, setActionType] = useState<AutomationActionType>("smart_cool");
  const [actionValue, setActionValue] = useState("24");

  const actionNeedsValue = ACTION_OPTIONS.find((a) => a.value === actionType)?.needsValue;

  function reset() {
    setName("");
    setTriggerType("time");
    setTriggerValue("22:00");
    setActionType("smart_cool");
    setActionValue("24");
  }

  function submit() {
    if (!name.trim()) return;
    onCreate({
      id: crypto.randomUUID(),
      name: name.trim(),
      enabled: true,
      trigger: { type: triggerType, value: triggerValue },
      action: { type: actionType, value: actionNeedsValue ? Number(actionValue) : undefined },
      createdAt: Date.now(),
    });
    reset();
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> New automation
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New automation</DialogTitle>
          <DialogDescription>
            Runs entirely in this browser for now — see Settings for why. Persisted to a real
            backend rules engine is Phase 3.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Bedtime cooldown" />
          </div>

          <div className="space-y-1.5">
            <Label>Trigger</Label>
            <Select value={triggerType} onValueChange={(v) => setTriggerType(v as AutomationTriggerType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRIGGER_OPTIONS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {triggerType !== "presence" && (
              <Input
                value={triggerValue}
                onChange={(e) => setTriggerValue(e.target.value)}
                placeholder={TRIGGER_OPTIONS.find((t) => t.value === triggerType)?.placeholder}
              />
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Action</Label>
            <Select value={actionType} onValueChange={(v) => setActionType(v as AutomationActionType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACTION_OPTIONS.map((a) => (
                  <SelectItem key={a.value} value={a.value}>
                    {a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {actionNeedsValue && (
              <Input
                type="number"
                value={actionValue}
                onChange={(e) => setActionValue(e.target.value)}
                placeholder="24"
              />
            )}
          </div>
        </div>

        <Button onClick={submit} disabled={!name.trim()}>
          Create automation
        </Button>
      </DialogContent>
    </Dialog>
  );
}
