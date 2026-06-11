"use client";

// ── Analytics: ROI sliced every way that matters ─────────────────────
import { useMemo, useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import {
  clvDistribution,
  groupBy,
  isSettled,
  oddsRange,
  overallStats,
  profitByPeriod,
  profitOf,
  type GroupStat,
} from "@/lib/stats";
import { clvPct } from "@/lib/odds";
import { fmtMoney, fmtPct, fmtUnits } from "@/lib/utils";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  PageHeader,
  StatCard,
  Tabs,
} from "@/components/ui/primitives";
import {
  ClvScatterChart,
  CountBarChart,
  HBarChart,
  PnlBarChart,
} from "@/components/charts/charts";

const DIMENSIONS = [
  { value: "sport", label: "Sport" },
  { value: "league", label: "League" },
  { value: "sportsbook", label: "Sportsbook" },
  { value: "betType", label: "Bet Type" },
  { value: "market", label: "Market" },
  { value: "odds", label: "Odds Range" },
  { value: "promo", label: "Promo Type" },
] as const;

export default function AnalyticsPage() {
  const { db, ready } = useStore();
  const [dim, setDim] = useState("sport");
  const [period, setPeriod] = useState("month");
  const [metric, setMetric] = useState("roi");

  const settled = useMemo(() => db.bets.filter(isSettled), [db.bets]);
  const unitSize = db.settings.unitSize;
  const cur = db.settings.currency;

  const dimGroups = useMemo(() => {
    const keyFn = (b: (typeof db.bets)[number]): string => {
      switch (dim) {
        case "league": return b.league || b.sport;
        case "sportsbook": return b.sportsbook;
        case "betType": return b.betType;
        case "market": return b.market;
        case "odds": return oddsRange(b.odds);
        case "promo": return b.promotionUsed ? b.promotionType : "No promo";
        default: return b.sport;
      }
    };
    return groupBy(db.bets, keyFn, unitSize);
  }, [db.bets, dim, unitSize]);

  if (!ready) return null;

  if (settled.length === 0) {
    return (
      <div>
        <PageHeader title="Analytics" sub="ROI by every dimension, CLV diagnostics, and head-to-head comparisons." />
        <EmptyState
          title="No settled bets to analyze"
          body="Analytics unlock once you have graded bets in the tracker."
          action={
            <Link href="/bets">
              <Button variant="outline">Go to Bet Tracker</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const s = overallStats(db.bets, db.settings);
  const periodData = profitByPeriod(db.bets, period as "month" | "week" | "day", unitSize);
  const clvDist = clvDistribution(db.bets);

  // CLV vs result scatter: each settled bet with closing line
  const clvScatter = settled
    .filter((b) => b.closingLine != null)
    .map((b) => ({
      clv: Math.round(clvPct(b.odds, b.closingLine as number) * 10) / 10,
      profit: Math.round(profitOf(b) * 100) / 100,
      roi: b.stake ? Math.round((profitOf(b) / b.stake) * 1000) / 10 : 0,
    }));

  // Comparison rows
  const favDog = groupBy(
    settled.filter((b) => b.market !== "Parlay" && b.market !== "Same Game Parlay"),
    (b) => (b.odds < 0 ? "Favorites (minus odds)" : "Underdogs (plus odds)"),
    unitSize
  );
  const homeAway = groupBy(
    settled.filter((b) => / @ /.test(b.event) && /(^|\s)(ML|[-+]\d)/.test(b.selection)),
    (b) => {
      const [away, home] = b.event.split(" @ ");
      const sel = b.selection.toLowerCase();
      if (home && sel.includes(home.toLowerCase().split(" ")[0])) return "Home sides";
      if (away && sel.includes(away.toLowerCase().split(" ")[0])) return "Away sides";
      return "Unclear";
    },
    unitSize
  ).filter((g) => g.key !== "Unclear");
  const straightVsParlay = groupBy(
    settled,
    (b) =>
      b.betType === "Parlay" || b.betType === "Same Game Parlay"
        ? "Parlays / SGPs"
        : b.betType === "Prop"
          ? "Props"
          : "Straight bets",
    unitSize
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Analytics"
        sub="Where your edge actually comes from — and where it leaks."
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          label="Avg CLV"
          value={s.avgClv == null ? "—" : fmtPct(s.avgClv, { sign: true })}
          tone={(s.avgClv ?? 0) >= 0 ? "profit" : "loss"}
          sub="The #1 predictor of long-term profit"
        />
        <StatCard
          label="Closing line win rate"
          value={s.clvWinRate == null ? "—" : fmtPct(s.clvWinRate, { decimals: 0 })}
          tone={(s.clvWinRate ?? 0) >= 50 ? "profit" : "warn"}
          sub="% of bets that beat the close"
        />
        <StatCard
          label="ROI"
          value={fmtPct(s.roi, { sign: true })}
          tone={s.roi >= 0 ? "profit" : "loss"}
          sub={`${settled.length} settled bets`}
        />
        <StatCard
          label="Net units"
          value={fmtUnits(s.units)}
          tone={s.units >= 0 ? "profit" : "loss"}
          sub={`Unit = ${fmtMoney(unitSize, cur)}`}
        />
      </div>

      {/* ROI by dimension */}
      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle>
            {metric === "roi" ? "ROI" : "Profit"} by {DIMENSIONS.find((d) => d.value === dim)?.label}
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Tabs
              value={metric}
              onChange={setMetric}
              options={[
                { value: "roi", label: "ROI %" },
                { value: "profit", label: "Profit $" },
              ]}
            />
            <Tabs value={dim} onChange={setDim} options={DIMENSIONS as any} />
          </div>
        </CardHeader>
        <CardContent>
          <HBarChart
            data={dimGroups.map((g) => ({
              key: `${g.key} (${g.bets})`,
              roi: Math.round(g.roi * 10) / 10,
              profit: Math.round(g.profit * 100) / 100,
            }))}
            dataKey={metric}
            suffix={metric === "roi" ? "%" : ""}
            height={Math.max(200, dimGroups.length * 34)}
          />
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Profit by {period}</CardTitle>
            <Tabs
              value={period}
              onChange={setPeriod}
              options={[
                { value: "day", label: "Day" },
                { value: "week", label: "Week" },
                { value: "month", label: "Month" },
              ]}
            />
          </CardHeader>
          <CardContent>
            <PnlBarChart data={periodData} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Units by {period}</CardTitle>
          </CardHeader>
          <CardContent>
            <PnlBarChart data={periodData} dataKey="units" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>CLV distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {clvDist.length ? (
              <CountBarChart data={clvDist} />
            ) : (
              <p className="py-8 text-center text-xs text-muted">
                Log closing lines on your bets to unlock CLV analytics.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>CLV vs bet ROI</CardTitle>
          </CardHeader>
          <CardContent>
            {clvScatter.length ? (
              <ClvScatterChart data={clvScatter} />
            ) : (
              <p className="py-8 text-center text-xs text-muted">
                Needs bets with closing lines logged.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Comparisons */}
      <div className="grid gap-5 lg:grid-cols-3">
        <CompareCard title="Favorites vs Underdogs" groups={favDog} cur={cur} />
        <CompareCard title="Home vs Away" groups={homeAway} cur={cur} />
        <CompareCard title="Straights vs Parlays vs Props" groups={straightVsParlay} cur={cur} />
      </div>
    </div>
  );
}

function CompareCard({
  title,
  groups,
  cur,
}: {
  title: string;
  groups: GroupStat[];
  cur: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {groups.length === 0 && (
          <p className="text-xs text-muted">Not enough data yet.</p>
        )}
        {groups.map((g) => (
          <div
            key={g.key}
            className="flex items-center justify-between rounded-lg border border-border/60 bg-panel-2/50 px-3 py-2"
          >
            <div>
              <div className="text-[13px] font-medium text-zinc-200">{g.key}</div>
              <div className="text-[11px] text-muted">
                {g.wins}-{g.losses} · {g.bets} bets
              </div>
            </div>
            <div className="text-right">
              <div
                className={`font-mono text-xs font-bold tabular-nums ${
                  g.profit >= 0 ? "text-profit" : "text-loss"
                }`}
              >
                {fmtMoney(g.profit, cur, { sign: true })}
              </div>
              <div className="text-[11px] text-muted">{fmtPct(g.roi, { sign: true })} ROI</div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
