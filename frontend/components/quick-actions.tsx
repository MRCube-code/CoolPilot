"use client";

import { useState } from "react";
import type { ComponentType } from "react";
import { Moon, Leaf, Wind, Sparkles, Home, Volume1, Sliders, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { fanSpeedLabels, modeLabels, FanSpeed, Mode } from "@/lib/property-labels";
import type { DeviceStatus } from "@/lib/types";
import { useSmartCool } from "@/hooks/use-smart-cool";

interface QuickActionsProps {
  mac: string | null;
  status: DeviceStatus | null;
  sendCommand: (values: Record<string, number>) => Promise<void>;
}

function formatCountdown(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function QuickActions({ mac, status, sendCommand }: QuickActionsProps) {
  const smartCool = useSmartCool(mac, sendCommand);
  const [customOpen, setCustomOpen] = useState(false);

  const isOn = (val: number | undefined) => val === 1;

  return (
    <div className="space-y-3">
      {smartCool.active && (
        <Card className="flex items-center justify-between border-primary/30 p-4">
          <div>
            <p className="text-sm font-medium">Smart Cool running</p>
            <p className="text-xs text-muted-foreground">
              Turbo on at 24° — switching to Auto fan at 25° in {formatCountdown(smartCool.secondsRemaining)}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={smartCool.cancel}>
            <X className="size-4" /> Cancel
          </Button>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <ActionButton
          icon={Sparkles}
          label="Smart Cool"
          active={smartCool.active}
          onClick={smartCool.active ? smartCool.cancel : smartCool.start}
          disabled={!mac}
        />
        <ActionButton
          icon={Moon}
          label="Sleep"
          active={isOn(status?.SwhSlp)}
          onClick={() =>
            sendCommand({ Pow: 1, Mod: Mode.COOL, SwhSlp: isOn(status?.SwhSlp) ? 0 : 1 })
          }
          disabled={!mac}
        />
        <ActionButton
          icon={Leaf}
          label="Eco"
          active={isOn(status?.SvSt)}
          onClick={() => sendCommand({ SvSt: isOn(status?.SvSt) ? 0 : 1 })}
          disabled={!mac}
        />
        <ActionButton
          icon={Wind}
          label="Turbo"
          active={isOn(status?.Tur)}
          onClick={() => sendCommand({ Tur: isOn(status?.Tur) ? 0 : 1 })}
          disabled={!mac}
        />
        <ActionButton
          icon={Home}
          label="Away"
          active={false}
          onClick={() => sendCommand({ Pow: 1, Mod: Mode.COOL, TemUn: 0, SetTem: 30, WdSpd: FanSpeed.AUTO })}
          disabled={!mac}
        />
        <ActionButton
          icon={Volume1}
          label="Silent"
          active={isOn(status?.Quiet)}
          onClick={() => sendCommand({ Quiet: isOn(status?.Quiet) ? 0 : 1 })}
          disabled={!mac}
        />
        <ActionButton
          icon={Home}
          label="Comfort"
          active={false}
          onClick={() => sendCommand({ Pow: 1, Mod: Mode.AUTO, WdSpd: FanSpeed.AUTO, Tur: 0, Quiet: 0 })}
          disabled={!mac}
        />
        <ActionButton icon={Sliders} label="Custom" active={false} onClick={() => setCustomOpen(true)} disabled={!mac} />
      </div>

      <CustomModeDialog
        open={customOpen}
        onOpenChange={setCustomOpen}
        status={status}
        onApply={sendCommand}
      />
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  active,
  onClick,
  disabled,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`glass-surface flex flex-col items-center gap-2 rounded-xl px-3 py-4 text-sm font-medium transition-colors disabled:opacity-40 ${
        active ? "border-primary/50 bg-primary/10 text-primary" : "hover:bg-accent/50"
      }`}
    >
      <Icon className="size-5" />
      {label}
    </button>
  );
}

/**
 * "Custom Mode" from the brief — a direct manual editor over mode/fan/temp
 * rather than a fixed preset, since there's no single "custom" opcode to
 * toggle. Sends exactly what you set, nothing implied.
 */
function CustomModeDialog({
  open,
  onOpenChange,
  status,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  status: DeviceStatus | null;
  onApply: (values: Record<string, number>) => Promise<void>;
}) {
  const [mode, setMode] = useState(String(status?.Mod ?? Mode.COOL));
  const [fan, setFan] = useState(String(status?.WdSpd ?? FanSpeed.AUTO));
  const [temp, setTemp] = useState(status?.SetTem ?? 24);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Custom mode</DialogTitle>
          <DialogDescription>Set mode, fan speed, and target temperature directly.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Mode</Label>
            <Select value={mode} onValueChange={setMode}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(modeLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Fan speed</Label>
            <Select value={fan} onValueChange={setFan}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(fanSpeedLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Target temperature</Label>
              <span className="tabular-nums text-sm font-medium">{temp}°C</span>
            </div>
            <Slider
  min={16}
  max={30}
  step={1}
  value={[temp]}
  onValueChange={([v]) => setTemp(v ?? temp)}
/>
          </div>
        </div>

        <Button
          onClick={async () => {
            await onApply({ Pow: 1, Mod: Number(mode), WdSpd: Number(fan), TemUn: 0, SetTem: temp });
            onOpenChange(false);
          }}
        >
          Apply
        </Button>
      </DialogContent>
    </Dialog>
  );
}
