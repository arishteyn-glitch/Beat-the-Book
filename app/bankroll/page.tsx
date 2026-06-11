"use client";

// ── Bankroll Management: survive first, profit second ────────────────
import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { overallStats, profitSeries } from "@/lib/stats";
import {
  americanToDecimal,
  KELLY_BY_RISK,
  kellyFraction,
  recommendedStake,
} from "@/lib/odds";
import { RiskTolerance } from "@/lib/types";
import { fmtMoney, fmtPct } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Field,
  Input,
  PageHeader,
  StatCard,
  Tabs,
} from "@/components/ui/primitives";
import { ProfitAreaChart } from "@/components/charts/charts";

const MODE_COPY: Record<RiskTolerance, { label: string; desc: string }> = {
  conservative: {
    label: "Conservative",
    desc: "Quarter-Kelly, 2% max bet. Slowest growth, near-zero risk of ruin. Right for new bettors and unproven edges.",
  },
  balanced: {
    label: "Balanced",
    desc: "Half-Kelly, 3% max bet. The professional default — captures most of full-Kelly growth at half the variance.",
  },
  aggressive: {
    label: "Aggressive",
    desc: "Full Kelly, 5% max bet. Maximum growth if your probability estimates are right — brutal drawdowns if they're not.",
  },
};

export default function BankrollPage() {
  const { db, ready, saveSettings } = useStore();
  const [calcOdds, setCalcOdds] = useState(-110);
  const [calcProb, setCalcProb] = useState(55);

  const s = useMemo(
    () => overallStats(db.bets, db.settings),
    [db.bets, db.settings]
  );
  const series = useMemo(
    () => profitSeries(db.bets, db.settings),
    [db.bets, db.settings]
  );

  if (!ready) return null;
  const cur = db.settings.currency;
  const mode = db.settings.riskTolerance;
  const cfg = KELLY_BY_RISK[mode];

  const fullKelly = kellyFraction(calcProb / 100, calcOdds);
  const stake = recommendedStake(calcProb / 100, calcOdds, s.currentBankroll, mode);
  const flatStake = db.settings.unitSize;
  const exposurePct = s.currentBankroll
    ? (s.openExposure / s.currentBankroll) * 100
    : 0;
  const drawdownPct = db.settings.startingBankroll
    ? (s.maxDrawdown / db.settings.startingBankroll) * 100
    : 0;
  const pendingBySport = db.bets
    .filter((b) => b.status === "pending")
    .reduce((m, b) => {
      m.set(b.sport, (m.get(b.sport) ?? 0) + (b.promotionType === "Bonus Bet" ? 0 : b.stake));
      return m;
    }, new Map<string, number>());

  return (
    <div className="space-y-5">
      <PageHeader
        title="Bankroll Management"
        sub="The bets you don't make and the sizes you don't exceed are where long-term profit lives."
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          label="Current bankroll"
          value={fmtMoney(s.currentBankroll, cur)}
          tone={s.currentBankroll >= db.settings.startingBankroll ? "profit" : "loss"}
          sub={`Started ${fmtMoney(db.settings.startingBankroll, cur)}`}
        />
        <StatCard
          label="Unit size"
          value={fmtMoney(db.settings.unitSize, cur)}
          sub={`${((db.settings.unitSize / Math.max(1, s.currentBankroll)) * 100).toFixed(1)}% of bankroll`}
        />
        <StatCard
          label="Open exposure"
          value={fmtMoney(s.openExposure, cur)}
          tone={exposurePct > 15 ? "warn" : "accent"}
          sub={`${exposurePct.toFixed(1)}% of bankroll across ${s.pending} bets`}
        />
        <StatCard
          label="Max drawdown"
          value={fmtMoney(s.maxDrawdown, cur)}
          tone={drawdownPct > 25 ? "loss" : "neutral"}
          sub={`${drawdownPct.toFixed(1)}% peak-to-trough · worst streak ${s.maxLosingStreak} losses`}
        />
      </div>

      {/* Risk mode */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Risk mode</CardTitle>
          <Tabs
            value={mode}
            onChange={(v) =>
              saveSettings({ ...db.settings, riskTolerance: v as RiskTolerance })
            }
            options={(Object.keys(MODE_COPY) as RiskTolerance[]).map((k) => ({
              value: k,
              label: MODE_COPY[k].label,
            }))}
          />
        </CardHeader>
        <CardContent>
          <p className="max-w-2xl text-[13px] leading-relaxed text-zinc-300">
            {MODE_COPY[mode].desc}
          </p>
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted">
            <span>
              Kelly multiplier:{" "}
              <span className="font-mono font-bold text-zinc-200">
                {cfg.multiplier}×
              </span>
            </span>
            <span>
              Max single bet:{" "}
              <span className="font-mono font-bold text-zinc-200">
                {(cfg.capPct * 100).toFixed(0)}% ({fmtMoney(s.currentBankroll * cfg.capPct, cur)})
              </span>
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Kelly calculator */}
        <Card>
          <CardHeader>
            <CardTitle>Stake calculator</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Odds (American)">
                <Input
                  type="number"
                  value={calcOdds || ""}
                  onChange={(e) => setCalcOdds(+e.target.value || 0)}
                />
              </Field>
              <Field label="Your est. win %">
                <Input
                  type="number"
                  step="0.5"
                  value={calcProb}
                  onChange={(e) => setCalcProb(+e.target.value || 0)}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-accent/30 bg-accent/8 p-3">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                  Kelly recommendation ({MODE_COPY[mode].label.toLowerCase()})
                </div>
                <div className="mt-1 font-mono text-2xl font-bold text-blue-400">
                  {stake > 0 ? fmtMoney(stake, cur) : "No bet"}
                </div>
                <div className="text-[11px] text-muted">
                  Full Kelly: {fullKelly > 0 ? fmtPct(fullKelly * 100) : "negative — no edge"}
                  {stake > 0 &&
                    ` · ${(stake / Math.max(0.01, db.settings.unitSize)).toFixed(1)} units`}
                </div>
              </div>
              <div className="rounded-lg border border-border bg-panel-2/60 p-3">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                  Flat betting recommendation
                </div>
                <div className="mt-1 font-mono text-2xl font-bold text-zinc-100">
                  {fmtMoney(flatStake, cur)}
                </div>
                <div className="text-[11px] text-muted">
                  1 unit per bet, every bet — boring and effective
                </div>
              </div>
            </div>
            <p className="text-xs leading-relaxed text-muted">
              Kelly sizing assumes your win probability is accurate. Most
              estimates are overconfident — which is exactly why the{" "}
              {MODE_COPY[mode].label.toLowerCase()} mode bets a fraction of full
              Kelly and caps at {(cfg.capPct * 100).toFixed(0)}%. Decimal odds
              here: {americanToDecimal(calcOdds || -110).toFixed(2)}.
            </p>
          </CardContent>
        </Card>

        {/* Bankroll curve */}
        <Card>
          <CardHeader>
            <CardTitle>Bankroll growth curve</CardTitle>
          </CardHeader>
          <CardContent>
            {series.length ? (
              <ProfitAreaChart data={series} dataKey="bankroll" height={252} />
            ) : (
              <p className="py-10 text-center text-xs text-muted">
                Settle some bets to see your bankroll curve.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Open exposure breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Open exposure by sport</CardTitle>
        </CardHeader>
        <CardContent>
          {pendingBySport.size === 0 ? (
            <p className="text-xs text-muted">No open bets right now.</p>
          ) : (
            <div className="space-y-2">
              {[...pendingBySport.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(([sport, amt]) => {
                  const pct = s.openExposure ? (amt / s.openExposure) * 100 : 0;
                  return (
                    <div key={sport} className="flex items-center gap-3">
                      <span className="w-16 text-xs font-medium text-zinc-300">
                        {sport}
                      </span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/5">
                        <div
                          className="h-full rounded-full bg-accent"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-20 text-right font-mono text-xs tabular-nums text-zinc-300">
                        {fmtMoney(amt, cur)}
                      </span>
                    </div>
                  );
                })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
