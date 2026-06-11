"use client";

// ── Picks Board: only opportunities that clear the quality bar ───────
import { useMemo, useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { Recommendation } from "@/lib/types";
import { fmtOdds } from "@/lib/odds";
import { analyzePromotion } from "@/lib/promo";
import { fmtMoney, fmtPct, todayISO, uid } from "@/lib/utils";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  PageHeader,
  Select,
  Table,
  Td,
  Th,
  THead,
  Tr,
  VerdictBadge,
} from "@/components/ui/primitives";
import { emptyBet } from "@/components/bets/bet-form";
import { Check, Target, X } from "lucide-react";

const MIN_SCORE = 60; // board threshold: below this, we do not show picks

export default function PicksBoardPage() {
  const { db, ready, upsertRecommendation, upsertBet } = useStore();
  const [filter, setFilter] = useState("all");

  const picks = useMemo(() => {
    let list = db.recommendations.filter(
      (r) => r.status === "active" && r.finalScore >= MIN_SCORE
    );
    if (filter === "straight")
      list = list.filter(
        (r) => r.betType === "Straight" || r.betType === "Live"
      );
    if (filter === "props") list = list.filter((r) => r.betType === "Prop");
    if (filter === "parlays")
      list = list.filter(
        (r) => r.betType === "Parlay" || r.betType === "Same Game Parlay"
      );
    return list.sort((a, b) => b.finalScore - a.finalScore);
  }, [db.recommendations, filter]);

  if (!ready) return null;
  const cur = db.settings.currency;

  const activePromos = db.promotions
    .filter((p) => p.status === "active")
    .map((p) => ({
      promo: p,
      ev: analyzePromotion({
        promoType: p.promoType,
        maxStake: p.maxStake ?? 25,
        odds: p.minOdds ?? 150,
        boostPct: p.boostPct,
      }),
    }))
    .sort((a, b) => b.ev.estEvDollars - a.ev.estEvDollars);

  const placeBet = (r: Recommendation) => {
    upsertBet(
      emptyBet({
        date: todayISO(),
        sport: r.sport,
        event: r.event,
        sportsbook: r.sportsbook,
        betType: r.betType,
        market: r.market,
        selection: r.selection,
        odds: r.odds,
        stake: r.stakeRec || db.settings.unitSize,
        estTrueProb: r.estTrueProb,
        confidenceScore: r.scores.confidence,
        finalBetScore: r.finalScore,
        notes: `From Picks Board (score ${r.finalScore}). ${r.summary}`.trim(),
        id: uid(),
      })
    );
    upsertRecommendation({ ...r, status: "placed" });
  };

  const dismiss = (r: Recommendation) =>
    upsertRecommendation({ ...r, status: "dismissed" });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Picks Board"
        sub={`Opportunities scoring ${MIN_SCORE}+ from your AI Agent analyses. No forced picks, ever.`}
        actions={
          <Select value={filter} onChange={(e) => setFilter(e.target.value)} className="w-40">
            <option value="all">All opportunities</option>
            <option value="straight">Best straight bets</option>
            <option value="props">Best props</option>
            <option value="parlays">Best parlays</option>
          </Select>
        }
      />

      {picks.length === 0 ? (
        <EmptyState
          title="No current betting opportunities meet our standards."
          body={`That is not a malfunction — it is discipline. Run candidate bets through the AI Agent; anything scoring ${MIN_SCORE}+ appears here automatically.`}
          action={
            <Link href="/agent">
              <Button>
                <Target size={15} /> Analyze a bet
              </Button>
            </Link>
          }
        />
      ) : (
        <Card>
          <Table>
            <THead>
              <Th>Sport</Th>
              <Th>Event / Bet</Th>
              <Th className="text-right">Odds</Th>
              <Th>Book</Th>
              <Th className="text-right">Conf.</Th>
              <Th className="text-right">Score</Th>
              <Th className="text-right">Edge</Th>
              <Th className="text-right">EV</Th>
              <Th className="text-right">Units</Th>
              <Th>Verdict</Th>
              <Th className="text-right">Actions</Th>
            </THead>
            <tbody>
              {picks.map((r) => (
                <Tr key={r.id}>
                  <Td>
                    <Badge variant="muted">{r.sport}</Badge>
                  </Td>
                  <Td className="max-w-[240px]">
                    <div className="truncate text-[13px] font-medium text-zinc-200">
                      {r.selection}
                    </div>
                    <div className="truncate text-[11px] text-muted">{r.event}</div>
                  </Td>
                  <Td className="text-right font-mono text-xs tabular-nums text-zinc-300">
                    {fmtOdds(r.odds)}
                  </Td>
                  <Td className="text-xs text-muted">{r.sportsbook}</Td>
                  <Td className="text-right font-mono text-xs tabular-nums text-zinc-300">
                    {r.scores.confidence.toFixed(1)}
                  </Td>
                  <Td className="text-right">
                    <span
                      className={`font-mono text-sm font-black tabular-nums ${
                        r.finalScore >= 80
                          ? "text-profit"
                          : r.finalScore >= 70
                            ? "text-blue-400"
                            : "text-warn"
                      }`}
                    >
                      {r.finalScore}
                    </span>
                  </Td>
                  <Td className="text-right font-mono text-xs tabular-nums text-zinc-300">
                    {fmtPct(r.edgePct, { sign: true })}
                  </Td>
                  <Td className="text-right font-mono text-xs tabular-nums text-zinc-300">
                    {fmtPct(r.evPct, { sign: true })}
                  </Td>
                  <Td className="text-right font-mono text-xs tabular-nums text-zinc-300">
                    {r.unitsRec || "—"}
                  </Td>
                  <Td>
                    <VerdictBadge verdict={r.verdict} />
                  </Td>
                  <Td>
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="success" onClick={() => placeBet(r)} title="Log as placed bet">
                        <Check size={13} /> Place
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => dismiss(r)} title="Dismiss">
                        <X size={13} />
                      </Button>
                    </div>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      {/* Best promotions */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Best active promotions</CardTitle>
          <Link href="/promotions" className="text-xs text-blue-400 hover:underline">
            Optimizer →
          </Link>
        </CardHeader>
        <CardContent>
          {activePromos.length === 0 ? (
            <p className="text-xs text-muted">
              No active promotions logged. Add FanDuel / DraftKings offers in the
              Promotion Optimizer and they will rank here by expected value.
            </p>
          ) : (
            <div className="grid gap-2 md:grid-cols-3">
              {activePromos.map(({ promo, ev }) => (
                <div
                  key={promo.id}
                  className="rounded-lg border border-border/60 bg-panel-2/50 p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="violet">{promo.promoType}</Badge>
                    <span className="font-mono text-xs font-bold text-profit">
                      ~{fmtMoney(ev.estEvDollars, cur)} EV
                    </span>
                  </div>
                  <div className="mt-1.5 text-[13px] font-medium text-zinc-200">
                    {promo.description || promo.promoType}
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted">
                    {promo.sportsbook}
                    {promo.maxStake ? ` · max ${fmtMoney(promo.maxStake, cur, { decimals: 0 })}` : ""}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
