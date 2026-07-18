"use client";

import Link from "next/link";
import { AlertTriangle, BarChart3 } from "lucide-react";

import { ConnectionBanner } from "@/components/connection-banner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EnergyChart } from "@/components/energy-chart";
import { Button } from "@/components/ui/button";
import { MOCK_DATA_WARNING, mockEnergyLast7Days } from "@/lib/mock-data";

export default function EnergyPage() {
  const todayCost = mockEnergyLast7Days.at(-1)?.estimatedCost ?? 0;
  const weekCost = mockEnergyLast7Days.reduce((sum, d) => sum + d.estimatedCost, 0);
  const weekKwh = mockEnergyLast7Days.reduce((sum, d) => sum + d.estimatedKwh, 0);
  const todayRuntime = mockEnergyLast7Days.at(-1)?.runtimeMinutes ?? 0;

  return (
    <div className="space-y-6">
      <ConnectionBanner />
      <h1 className="text-2xl font-semibold tracking-tight">Energy</h1>

      <div className="flex gap-3 rounded-xl border border-accent-heat/30 bg-accent-heat/10 px-4 py-3 text-sm text-accent-heat">
        <AlertTriangle className="size-4 shrink-0" />
        <span>{MOCK_DATA_WARNING} Real numbers need measured AC runtime + your tariff (Phase 4).</span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard label="Today" value={`৳${todayCost}`} sub={`${Math.round(todayRuntime / 60)}h runtime`} />
        <SummaryCard label="This week" value={`৳${weekCost}`} sub={`${weekKwh.toFixed(1)} kWh`} />
        <SummaryCard label="Est. monthly" value={`৳${Math.round((weekCost / 7) * 30)}`} sub="projected" />
        <SummaryCard label="Avg. daily runtime" value={`${(todayRuntime / 60).toFixed(1)}h`} sub="last 7 days" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Runtime (kWh) — last 7 days</CardTitle>
        </CardHeader>
        <CardContent>
          <EnergyChart data={mockEnergyLast7Days} />
        </CardContent>
      </Card>

      <Button asChild variant="outline">
        <Link href="/statistics">
          <BarChart3 /> View full statistics
        </Link>
      </Button>
    </div>
  );
}

function SummaryCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </Card>
  );
}
