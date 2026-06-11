"use client";

// ── Settings ──────────────────────────────────────────────────────────
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import {
  RiskTolerance,
  Settings,
  Sport,
  SPORTS,
  SPORTSBOOKS,
  StakeMethod,
} from "@/lib/types";
import { fmtMoney } from "@/lib/utils";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Field,
  Input,
  PageHeader,
  Select,
} from "@/components/ui/primitives";
import { Check, Cloud, Database, HardDrive, Sparkles } from "lucide-react";

export default function SettingsPage() {
  const { db, ready, saveSettings, loadDemoData, clearAllData, cloudMode } =
    useStore();
  const [form, setForm] = useState<Settings>(db.settings);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    if (ready) setForm(db.settings);
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!ready) return null;

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const save = () => {
    saveSettings(form);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
  };

  const toggleSport = (s: Sport) =>
    set(
      "preferredSports",
      form.preferredSports.includes(s)
        ? form.preferredSports.filter((x) => x !== s)
        : [...form.preferredSports, s]
    );

  return (
    <div className="max-w-3xl space-y-5">
      <PageHeader title="Settings" sub="Bankroll, risk, and app configuration." />

      <Card>
        <CardHeader>
          <CardTitle>Bankroll & staking</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <Field label="Starting bankroll ($)">
            <Input
              type="number"
              value={form.startingBankroll || ""}
              onChange={(e) => set("startingBankroll", +e.target.value || 0)}
            />
          </Field>
          <Field label="Unit size ($)">
            <Input
              type="number"
              step="0.5"
              value={form.unitSize || ""}
              onChange={(e) => set("unitSize", +e.target.value || 0)}
            />
          </Field>
          <Field label="Default stake method">
            <Select
              value={form.stakeMethod}
              onChange={(e) => set("stakeMethod", e.target.value as StakeMethod)}
            >
              <option value="flat">Flat (1 unit)</option>
              <option value="kelly">Fractional Kelly</option>
              <option value="percent">% of bankroll</option>
            </Select>
          </Field>
          <Field label="Risk tolerance">
            <Select
              value={form.riskTolerance}
              onChange={(e) => set("riskTolerance", e.target.value as RiskTolerance)}
            >
              <option value="conservative">Conservative</option>
              <option value="balanced">Balanced</option>
              <option value="aggressive">Aggressive</option>
            </Select>
          </Field>
          <Field label="Preferred sportsbook">
            <Select
              value={form.preferredSportsbook}
              onChange={(e) =>
                set("preferredSportsbook", e.target.value as Settings["preferredSportsbook"])
              }
            >
              {SPORTSBOOKS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
          </Field>
          <Field label="Currency">
            <Select value={form.currency} onChange={(e) => set("currency", e.target.value)}>
              <option>USD</option>
              <option>EUR</option>
              <option>GBP</option>
              <option>CAD</option>
            </Select>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preferred sports</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-1.5">
          {SPORTS.map((s) => (
            <button
              key={s}
              onClick={() => toggleSport(s)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                form.preferredSports.includes(s)
                  ? "border-accent/50 bg-accent/15 text-blue-400"
                  : "border-border bg-panel-2 text-muted hover:text-zinc-300"
              }`}
            >
              {s}
            </button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          <Field label="Theme">
            <Select
              value={form.theme}
              onChange={(e) => set("theme", e.target.value as Settings["theme"])}
            >
              <option value="dark">Dark (recommended)</option>
              <option value="light">Light</option>
            </Select>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Data & integrations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-[13px] text-zinc-300">
          <div className="flex items-center gap-2">
            {cloudMode ? <Cloud size={15} className="text-blue-400" /> : <HardDrive size={15} className="text-muted" />}
            <span className="font-medium">
              {cloudMode ? "Cloud sync: Supabase connected" : "Local mode: data lives in this browser"}
            </span>
            <Badge variant={cloudMode ? "accent" : "muted"}>
              {cloudMode ? "PostgreSQL" : "localStorage"}
            </Badge>
          </div>
          {!cloudMode && (
            <p className="text-xs leading-relaxed text-muted">
              To sync to a real database: create a free project at supabase.com,
              run <code className="rounded bg-panel-2 px-1 py-0.5">supabase/schema.sql</code> in
              its SQL editor, then add{" "}
              <code className="rounded bg-panel-2 px-1 py-0.5">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
              <code className="rounded bg-panel-2 px-1 py-0.5">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>{" "}
              to <code className="rounded bg-panel-2 px-1 py-0.5">.env.local</code> and restart.
            </p>
          )}
          <div className="flex items-center gap-2 pt-1">
            <Sparkles size={15} className="text-violet" />
            <span className="font-medium">AI features (Claude analysis + slip OCR)</span>
          </div>
          <p className="text-xs leading-relaxed text-muted">
            Add <code className="rounded bg-panel-2 px-1 py-0.5">ANTHROPIC_API_KEY</code> to{" "}
            <code className="rounded bg-panel-2 px-1 py-0.5">.env.local</code> to enable Claude-powered
            bet analysis and bet-slip screenshot extraction. The built-in scoring
            engine works without it.
          </p>
          <div className="flex flex-wrap gap-2 border-t border-border pt-3">
            <Button variant="outline" onClick={loadDemoData}>
              <Database size={14} /> Load demo data
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (
                  confirm(
                    "Delete ALL bets, reviews, promotions, and recommendations? This cannot be undone."
                  )
                )
                  clearAllData();
              }}
            >
              Clear all data
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={save} size="lg">
          {savedFlash ? <Check size={15} /> : null}
          {savedFlash ? "Saved" : "Save settings"}
        </Button>
        <span className="text-xs text-muted">
          Unit size {fmtMoney(form.unitSize, form.currency)} ·{" "}
          {((form.unitSize / Math.max(1, form.startingBankroll)) * 100).toFixed(1)}% of
          starting bankroll
        </span>
      </div>
    </div>
  );
}
