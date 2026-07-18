"use client";

import Link from "next/link";
import { useState } from "react";
import { Terminal } from "lucide-react";

import { ConnectionBanner } from "@/components/connection-banner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/theme-toggle";
import { useTemperatureLimits } from "@/hooks/use-temperature-limits";
import { simpleHash } from "@/lib/simple-hash";

export default function SettingsPage() {
  const [limits, setLimits] = useTemperatureLimits();
  const [pinInput, setPinInput] = useState("");
  const [pinChallenge, setPinChallenge] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [locked, setLocked] = useState(true);

  function unlock() {
    if (!limits.pinEnabled || !limits.pinHash) {
      setLocked(false);
      return;
    }
    if (simpleHash(pinChallenge) === limits.pinHash) {
      setLocked(false);
      setPinError(null);
    } else {
      setPinError("Wrong PIN");
    }
  }

  function setPin() {
    if (pinInput.length < 4) {
      setPinError("PIN needs at least 4 digits");
      return;
    }
    setLimits((prev) => ({ ...prev, pinEnabled: true, pinHash: simpleHash(pinInput) }));
    setPinInput("");
    setPinError(null);
  }

  return (
    <div className="space-y-6">
      <ConnectionBanner />
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Theme</span>
          <ThemeToggle />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Temperature lock</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {limits.pinEnabled && locked ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">PIN-protected — enter it to change these limits.</p>
              <div className="flex gap-2">
                <Input
                  type="password"
                  inputMode="numeric"
                  placeholder="PIN"
                  value={pinChallenge}
                  onChange={(e) => setPinChallenge(e.target.value)}
                  className="w-32"
                />
                <Button onClick={unlock}>Unlock</Button>
              </div>
              {pinError && <p className="text-sm text-destructive">{pinError}</p>}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Minimum (°C)</Label>
                  <Input
                    type="number"
                    value={limits.minTemp}
                    onChange={(e) => setLimits((p) => ({ ...p, minTemp: Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Maximum (°C)</Label>
                  <Input
                    type="number"
                    value={limits.maxTemp}
                    onChange={(e) => setLimits((p) => ({ ...p, maxTemp: Number(e.target.value) }))}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Enforced on the Dashboard&apos;s +/- buttons. Not yet enforced inside the Custom
                mode dialog&apos;s slider — flagged, not hidden; see README.md.
              </p>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Require a PIN to change these limits</p>
                  <p className="text-xs text-muted-foreground">
                    Non-cryptographic, client-side only — stops casual changes, not a determined
                    person with devtools open. Real enforcement needs the auth system (Phase 3+).
                  </p>
                </div>
                <Switch
                  checked={limits.pinEnabled}
                  onCheckedChange={(v) => {
                    if (!v) setLimits((p) => ({ ...p, pinEnabled: false, pinHash: null }));
                  }}
                />
              </div>

              {limits.pinEnabled && !limits.pinHash && (
                <div className="flex gap-2">
                  <Input
                    type="password"
                    inputMode="numeric"
                    placeholder="Set a PIN"
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value)}
                    className="w-32"
                  />
                  <Button onClick={setPin}>Save PIN</Button>
                </div>
              )}
              {pinError && <p className="text-sm text-destructive">{pinError}</p>}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Language &amp; units</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <Label>Language</Label>
            <Select defaultValue="en">
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="bn">বাংলা (Bangla)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">
            UI-only selector for now — no translation strings are wired up yet, so choosing Bangla
            won&apos;t change any text. Real i18n is straightforward to add (next-intl or similar)
            once the page copy stabilizes; wiring it before that just means translating things twice.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Automation &amp; status alerts</p>
            <p className="text-xs text-muted-foreground">
              No push notification backend exists yet — this switch doesn&apos;t do anything real yet.
            </p>
          </div>
          <Switch disabled />
        </CardContent>
      </Card>

      <Button asChild variant="outline">
        <Link href="/developer">
          <Terminal /> Developer Tools
        </Link>
      </Button>
    </div>
  );
}
