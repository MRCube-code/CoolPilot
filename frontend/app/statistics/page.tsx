"use client";

import { AlertTriangle, Sparkles } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { ConnectionBanner } from "@/components/connection-banner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MOCK_DATA_WARNING, mockAiSuggestions, mockModeDistribution } from "@/lib/mock-data";

export default function StatisticsPage() {
  return (
    <div className="space-y-6">
      <ConnectionBanner />
      <h1 className="text-2xl font-semibold tracking-tight">Statistics</h1>

      <div className="flex gap-3 rounded-xl border border-accent-heat/30 bg-accent-heat/10 px-4 py-3 text-sm text-accent-heat">
        <AlertTriangle className="size-4 shrink-0" />
        <span>{MOCK_DATA_WARNING} This page needs a history of real polled status to compute anything real.</span>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Mode distribution — last 7 days</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <div className="h-48 w-48 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={mockModeDistribution}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                  >
                    {mockModeDistribution.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: "0.75rem",
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              {mockModeDistribution.map((m) => (
                <div key={m.name} className="flex items-center gap-2 text-sm">
                  <span className="size-2.5 rounded-full" style={{ background: m.color }} />
                  {m.name} — {m.value}%
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" /> AI suggestions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {mockAiSuggestions.map((s) => (
            <p key={s.id} className="rounded-lg bg-accent/50 p-3 text-sm">
              {s.text}
            </p>
          ))}
          <p className="text-xs text-muted-foreground">
            These are illustrative examples of the kind of suggestion the feature will generate —
            real suggestions need real runtime history + weather data (Phase 5).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
