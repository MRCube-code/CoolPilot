"use client";

import { motion } from "framer-motion";
import { Minus, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SIZE = 260;
const STROKE = 14;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

interface TemperatureDialProps {
  targetTemp: number;
  minTemp?: number;
  maxTemp?: number;
  accentColor: string;
  modeLabel: string;
  powerOn: boolean;
  onIncrement?: () => void;
  onDecrement?: () => void;
  disabled?: boolean;
}

export function TemperatureDial({
  targetTemp,
  minTemp = 16,
  maxTemp = 30,
  accentColor,
  modeLabel,
  powerOn,
  onIncrement,
  onDecrement,
  disabled,
}: TemperatureDialProps) {
  const fraction = Math.min(1, Math.max(0, (targetTemp - minTemp) / (maxTemp - minTemp)));
  const dashOffset = CIRCUMFERENCE * (1 - fraction);

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} className="-rotate-90">
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            strokeWidth={STROKE}
            className="fill-none stroke-muted"
          />
          <motion.circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            strokeWidth={STROKE}
            strokeLinecap="round"
            className="fill-none"
            stroke={accentColor}
            strokeDasharray={CIRCUMFERENCE}
            initial={false}
            animate={{ strokeDashoffset: dashOffset, opacity: powerOn ? 1 : 0.35 }}
            transition={{ type: "spring", stiffness: 120, damping: 20 }}
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
          <span
            className="text-xs font-medium uppercase tracking-wide"
            style={{ color: powerOn ? accentColor : undefined }}
          >
            {powerOn ? modeLabel : "Off"}
          </span>
          <motion.span
            key={targetTemp}
            initial={{ opacity: 0.4, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.15 }}
            className="tabular-nums text-6xl font-semibold tracking-tight"
          >
            {targetTemp}°
          </motion.span>
          <span className="text-xs text-muted-foreground">target</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Button
          variant="glass"
          size="icon"
          className="rounded-full"
          onClick={onDecrement}
          disabled={disabled || !onDecrement}
          aria-label="Decrease temperature"
        >
          <Minus />
        </Button>
        <Button
          variant="glass"
          size="icon"
          className="rounded-full"
          onClick={onIncrement}
          disabled={disabled || !onIncrement}
          aria-label="Increase temperature"
        >
          <Plus />
        </Button>
      </div>
    </div>
  );
}
