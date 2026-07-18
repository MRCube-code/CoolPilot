"use client";

import Link from "next/link";
import { PlusCircle } from "lucide-react";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import type { BoundDevice } from "@/lib/types";

interface DevicePickerProps {
  devices: BoundDevice[];
  selectedMac: string | null;
  onSelect: (mac: string) => void;
}

export function DevicePicker({ devices, selectedMac, onSelect }: DevicePickerProps) {
  if (devices.length === 0) {
    return (
      <Button asChild variant="outline">
        <Link href="/devices">
          <PlusCircle /> Add your first AC
        </Link>
      </Button>
    );
  }

  return (
    <Select value={selectedMac ?? undefined} onValueChange={onSelect}>
      <SelectTrigger className="w-[220px]">
        <SelectValue placeholder="Select a device" />
      </SelectTrigger>
      <SelectContent>
        {devices.map((d) => (
          <SelectItem key={d.mac} value={d.mac}>
            {d.name || d.mac}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
