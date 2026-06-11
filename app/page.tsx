"use client";

// ── Dashboard ─────────────────────────────────────────────────────────
import Link from "next/link";
import { useStore } from "@/lib/store";
import {
  groupBy,
  GroupStat,
  overallStats,
  profitByPeriod,
  profitOf,
  profitSeries,
} from "@/lib/stats";
import { fmtOdds } from "@/lib/odds";
import { fmtDate, fmtMoney, fmtPct, fmtUnits, profitColor } from "@/lib/utils";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  PageHeader,
  StatCard,
  statusBadgeVariant,
  Tabs,
  VerdictBadge,
} from "@/components/ui/primitives";
import { PnlBarChart, ProfitAreaChart } from "@/components/charts/charts";
import { useState } from "react";

export default function DashboardPage() {
  const { db, ready, loadDemoData } = useStore();
  const [curve, setCurve] = useState("profit");
  const [period, setPeriod] = useState("month");

  if (!ready) return null;

  const s = overallStats(db.bets, db.settings);
  const cur = db.settings.currency;

  if (db.bets.length === 0) {
    return (
      <div>
        <PageHeader
          title="Dashboard"
          sub="Your betting command center — profit, ROI, CLV, and process quality at a glance."
        />
        <EmptyState
          title="No bets tracked yet"
          body="Add your first bet in the Bet Tracker, import a bet slip screenshot, or load the demo dataset to explore every feature with realistic data."
          action={
            <div className="flex gap-2">
              <Button onClick={loadDemoData}>Load demo data</Button>
              <Link href="/bets">
                <Button variant="outline">Go to Bet Tracker</Button>
              </Link>
            </div>
          }
        />
      </div>
    );
  }

  const series = profitSeries(db.bets, db.settings);
  const bySport = groupBy(db.bets, (b) => b.sport, db.settings.unitSize);
  const byMarket = groupBy(db.bets, (b) => b.market, db.settings.unitSize);
  const periodData = profitByPeriod(
    db.bets,
    period as "month" | "week",
    db.settings.unitSize
  );
  const recent = [...db.bets]
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
    .slice(0, 8);
  const activeRecs = db.recommendations
    .filter((r) => r.status === "active" && r.finalScore >= 60)
    .sort((a, b) => b.finalScore - a.finalScore)
    .slice(0, 3);
  const activePromos = db.promotions.filter((p) => p.status === "active").slice(0, 3);
  const bestSport = bySport[0];
  const worstSport = bySport.length > 1 ? bySport[bySport.length - 1] : null;

  const curveKey = curve as "profit" | "units" | "roi" | "bankroll";
  const curvePrefix = curve === "profit" || curve === "bankroll" ? "$" : "";

  return (
    <div className="space-y-5">
      <PageHeader
        title="Dashboard"
        sub="Long-term ROI, bankroll health, and closing line value — the metrics that actually matter."
      />

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        <StatCard label="Current bankroll" value={fmtMoney(s.currentBankroll, cur)} sub={`Started ${fmtMoney(db.settings.startingBankroll, cur)}`} />
        <StatCard
          label="Total P/L"
          value={fmtMoney(s.profit, cur, { sign: true })}
          tone={s.profit >= 0 ? "profit" : "loss"}
          sub={fmtUnits(s.units) + " net units"}
        />
        <StatCard
          label="ROI"
          value={fmtPct(s.roi, { sign: true })}
          tone={s.roi >= 0 ? "profit" : "loss"}
          sub={`${fmtMoney(s.totalStaked, cur)} total staked`}
        />
        <StatCard
          label="Record"
          value={`${s.wins}-${s.losses}${s.pushes ? `-${s.pushes}` : ""}`}
          sub={`${s.winRate.toFixed(1)}% win rate`}
        />
        <StatCard
          label="Avg CLV"
          value={s.avgClv == null ? "—" : fmtPct(s.avgClv, { sign: true })}
          tone={(s.avgClv ?? 0) >= 0 ? "profit" : "loss"}
          sub={
            s.clvWinRate == null
              ? "No closing lines logged"
              : `Beat close on ${s.clvWinRate.toFixed(0)}%`
          }
        />
        <StatCard
          label="Open exposure"
          value={fmtMoney(s.openExposure, cur)}
          tone="accent"
          sub={`${s.pending} active bet${s.pending === 1 ? "" : "s"}`}
        />
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Avg odds" value={fmtOdds(Math.round(s.avgOdds))} mono />
        <StatCard label="Avg stake" value={fmtMoney(s.avgStake, cur)} />
        <StatCard
          label="Best sport"
          value={bestSport ? bestSport.key : "—"}
          tone="profit"
          sub={bestSport ? fmtMoney(bestSport.profit, cur, { sign: true }) : undefined}
          mono={false}
        />
        <StatCard
          label="Worst sport"
          value={worstSport ? worstSport.key : "—"}
          tone="loss"
          sub={worstSport ? fmtMoney(worstSport.profit, cur, { sign: true }) : undefined}
          mono={false}
        />
      </div>

      {/* Equity curve */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Performance curve</CardTitle>
          <Tabs
            value={curve}
            onChange={setCurve}
            options={[
              { value: "profit", label: "Profit" },
              { value: "units", label: "Units" },
              { value: "roi", label: "ROI %" },
              { value: "bankroll", label: "Bankroll" },
            ]}
          />
        </CardHeader>
        <CardContent>
          <ProfitAreaChart data={series} dataKey={curveKey} prefix={curvePrefix} height={260} />
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Periodic P/L */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Profit by {period}</CardTitle>
            <Tabs
              value={period}
              onChange={setPeriod}
              options={[
                { value: "week", label: "Weekly" },
                { value: "month", label: "Monthly" },
              ]}
            />
          </CardHeader>
          <CardContent>
            <PnlBarChart data={periodData} />
          </CardContent>
        </Card>

        {/* Sport breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Profit by sport</CardTitle>
          </CardHeader>
          <CardContent>
            <PnlBarChart
              data={bySport.map((g) => ({ label: g.key, profit: Math.round(g.profit * 100) / 100 }))}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Recent bets */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Recent bets</CardTitle>
            <Link href="/bets" className="text-xs text-blue-400 hover:underline">
              View all →
            </Link>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {recent.map((b) => (
              <div
                key={b.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-panel-2/50 px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-medium text-zinc-200">
                    {b.selection || b.event}
                  </div>
                  <div className="truncate text-[11px] text-muted">
                    {fmtDate(b.date)} · {b.sport} · {b.sportsbook} · {fmtOdds(b.odds)}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={`font-mono text-xs font-bold tabular-nums ${profitColor(
                      b.status === "pending" ? 0 : profitOf(b)
                    )}`}
                  >
                    {b.status === "pending"
                      ? fmtMoney(b.stake, cur)
                      : fmtMoney(profitOf(b), cur, { sign: true })}
                  </span>
                  <Badge variant={statusBadgeVariant(b.status)}>{b.status}</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Right rail: top/bottom markets, AI plays, promos */}
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Market performance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {byMarket.slice(0, 3).map((g) => (
                <MarketRow key={g.key} g={g} cur={cur} />
              ))}
              {byMarket.length > 3 &&
                byMarket.slice(-2).map((g) => <MarketRow key={g.key} g={g} cur={cur} />)}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>AI recommended plays</CardTitle>
              <Link href="/picks" className="text-xs text-blue-400 hover:underline">
                Board →
              </Link>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {activeRecs.length === 0 && (
                <p className="text-xs text-muted">
                  No active recommendations meet the quality threshold. Run an
                  analysis in the AI Agent.
                </p>
              )}
              {activeRecs.map((r) => (
                <div
                  key={r.id}
                  className="rounded-lg border border-border/60 bg-panel-2/50 px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[13px] font-medium text-zinc-200">
                      {r.selection}
                    </span>
                    <VerdictBadge verdict={r.verdict} />
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted">
                    {r.sport} · {fmtOdds(r.odds)} · Score{" "}
                    <span className="font-mono font-bold text-blue-400">{r.finalScore}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Promotion opportunities</CardTitle>
              <Link href="/promotions" className="text-xs text-blue-400 hover:underline">
                Optimizer →
              </Link>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {activePromos.length === 0 && (
                <p className="text-xs text-muted">No active promotions logged.</p>
              )}
              {activePromos.map((p) => (
                <div
                  key={p.id}
                  className="rounded-lg border border-border/60 bg-panel-2/50 px-3 py-2"
                >
                  <div className="text-[13px] font-medium text-zinc-200">
                    {p.description || p.promoType}
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted">
                    {p.sportsbook}
                    {p.expiration ? ` · expires ${fmtDate(p.expiration)}` : ""}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function MarketRow({ g, cur }: { g: GroupStat; cur: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border/60 bg-panel-2/50 px-3 py-2">
      <div>
        <div className="text-[13px] font-medium text-zinc-200">{g.key}</div>
        <div className="text-[11px] text-muted">
          {g.bets} bets · {fmtPct(g.roi, { sign: true })} ROI
        </div>
      </div>
      <span className={`font-mono text-xs font-bold tabular-nums ${profitColor(g.profit)}`}>
        {fmtMoney(g.profit, cur, { sign: true })}
      </span>
    </div>
  );
}
