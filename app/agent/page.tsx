"use client";

// ── AI Agent: quantitative bet analysis workbench ────────────────────
// A deterministic scoring engine runs locally on every input. When an
// ANTHROPIC_API_KEY is configured, Claude adds qualitative analysis on top.

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import {
  AgentInput,
  AgentResult,
  analyzeBet,
  SCORE_WEIGHTS,
  SPORT_FRAMEWORKS,
} from "@/lib/agent";
import { overallStats } from "@/lib/stats";
import { fmtOdds, impliedProbability } from "@/lib/odds";
import {
  BET_TYPES,
  MARKETS,
  PROMO_TYPES,
  Recommendation,
  SPORTS,
  SPORTSBOOKS,
} from "@/lib/types";
import { fmtMoney, fmtPct, uid } from "@/lib/utils";
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
  ScoreBar,
  Select,
  Textarea,
  VerdictBadge,
} from "@/components/ui/primitives";
import { Bot, Save, Sparkles } from "lucide-react";

const SITUATIONAL = [
  ["restAdvantage", "Rest advantage"],
  ["injuryEdge", "Injury edge not priced in"],
  ["weatherEdge", "Weather favors this side"],
  ["schedulingSpot", "Favorable schedule spot"],
  ["motivationEdge", "Motivation edge"],
  ["negativeSituation", "Spot works AGAINST this side"],
] as const;

const SIGNALS = [
  ["reverseLineMovement", "Reverse line movement"],
  ["steamWithYou", "Steam move with you"],
  ["steamAgainstYou", "Steam move against you"],
  ["heavyPublicOnYou", "Heavy public on your side"],
  ["bestPriceShopped", "Best price (line shopped)"],
  ["lineStale", "Stale line vs consensus"],
] as const;

const RISKS = [
  ["correlatedWithOpenBets", "Correlated with open bets"],
  ["highVarianceMarket", "High-variance market"],
  ["lowLiquidityMarket", "Low-liquidity market"],
  ["liveBet", "Live bet"],
] as const;

export default function AgentPage() {
  const { db, ready, upsertRecommendation } = useStore();
  const [meta, setMeta] = useState({
    sport: "NBA",
    event: "",
    sportsbook: db.settings.preferredSportsbook ?? "FanDuel",
    market: "Spread",
    betType: "Straight",
    selection: "",
    notes: "",
  });
  const [odds, setOdds] = useState(-110);
  const [trueProbPct, setTrueProbPct] = useState(55);
  const [promoType, setPromoType] = useState("None");
  const [boostPct, setBoostPct] = useState(30);
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [homework, setHomework] = useState(0.5);
  const [result, setResult] = useState<AgentResult | null>(null);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  const stats = useMemo(
    () => overallStats(db.bets, db.settings),
    [db.bets, db.settings]
  );

  if (!ready) return null;
  const cur = db.settings.currency;
  const implied = impliedProbability(odds) * 100;

  const buildInput = (): AgentInput => ({
    odds,
    estTrueProb: trueProbPct / 100,
    promoType: promoType as AgentInput["promoType"],
    promoBoostPct: boostPct,
    situational: {
      restAdvantage: !!flags.restAdvantage,
      injuryEdge: !!flags.injuryEdge,
      weatherEdge: !!flags.weatherEdge,
      schedulingSpot: !!flags.schedulingSpot,
      motivationEdge: !!flags.motivationEdge,
      negativeSituation: !!flags.negativeSituation,
    },
    signals: {
      reverseLineMovement: !!flags.reverseLineMovement,
      steamWithYou: !!flags.steamWithYou,
      steamAgainstYou: !!flags.steamAgainstYou,
      heavyPublicOnYou: !!flags.heavyPublicOnYou,
      bestPriceShopped: !!flags.bestPriceShopped,
      lineStale: !!flags.lineStale,
    },
    riskFactors: {
      correlatedWithOpenBets: !!flags.correlatedWithOpenBets,
      highVarianceMarket: !!flags.highVarianceMarket,
      lowLiquidityMarket: !!flags.lowLiquidityMarket,
      liveBet: !!flags.liveBet,
    },
    dataCompleteness: homework,
  });

  const run = () => {
    const r = analyzeBet(
      buildInput(),
      stats.currentBankroll,
      db.settings.unitSize,
      db.settings.riskTolerance
    );
    setResult(r);
    setSaved(false);
    setAiNote(null);
  };

  const runWithClaude = async () => {
    run();
    setAiLoading(true);
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...meta,
          odds,
          estTrueProbPct: trueProbPct,
          promoType,
          flags,
        }),
      });
      const data = await res.json();
      setAiNote(
        res.ok && data.analysis
          ? data.analysis
          : data.error ?? "AI analysis unavailable."
      );
    } catch {
      setAiNote("AI analysis unavailable (network error).");
    } finally {
      setAiLoading(false);
    }
  };

  const saveToBoard = () => {
    if (!result) return;
    const rec: Recommendation = {
      id: uid(),
      createdAt: new Date().toISOString(),
      sport: meta.sport as Recommendation["sport"],
      event: meta.event || "(event not specified)",
      sportsbook: meta.sportsbook as Recommendation["sportsbook"],
      market: meta.market as Recommendation["market"],
      betType: meta.betType as Recommendation["betType"],
      selection: meta.selection || meta.market,
      odds,
      scores: result.scores,
      finalScore: result.finalScore,
      verdict: result.verdict,
      stakeRec: result.stakeRec,
      unitsRec: result.unitsRec,
      estTrueProb: trueProbPct / 100,
      impliedProb: result.impliedProb,
      edgePct: result.edgePct,
      evPct: result.evPct,
      clvProjection: result.clvProjection,
      factors: result.factors,
      risks: result.risks,
      summary: aiNote?.slice(0, 400) ?? meta.notes,
      status: "active",
    };
    upsertRecommendation(rec);
    setSaved(true);
  };

  const toggle = (k: string) => setFlags((f) => ({ ...f, [k]: !f[k] }));

  return (
    <div>
      <PageHeader
        title="AI Agent"
        sub="Professional bettor + quant analyst + risk manager. No hot takes — just process."
      />

      <div className="grid gap-5 xl:grid-cols-5">
        {/* Input column */}
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Bet under evaluation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Sport">
                <Select
                  value={meta.sport}
                  onChange={(e) => setMeta({ ...meta, sport: e.target.value })}
                >
                  {SPORTS.map((s) => <option key={s}>{s}</option>)}
                </Select>
              </Field>
              <Field label="Sportsbook">
                <Select
                  value={meta.sportsbook}
                  onChange={(e) => setMeta({ ...meta, sportsbook: e.target.value as any })}
                >
                  {SPORTSBOOKS.map((s) => <option key={s}>{s}</option>)}
                </Select>
              </Field>
            </div>
            <Field label="Event">
              <Input
                placeholder="Thunder @ Pacers"
                value={meta.event}
                onChange={(e) => setMeta({ ...meta, event: e.target.value })}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Market">
                <Select
                  value={meta.market}
                  onChange={(e) => setMeta({ ...meta, market: e.target.value })}
                >
                  {MARKETS.map((s) => <option key={s}>{s}</option>)}
                </Select>
              </Field>
              <Field label="Bet type">
                <Select
                  value={meta.betType}
                  onChange={(e) => setMeta({ ...meta, betType: e.target.value })}
                >
                  {BET_TYPES.map((s) => <option key={s}>{s}</option>)}
                </Select>
              </Field>
            </div>
            <Field label="Selection">
              <Input
                placeholder="Pacers +6.5"
                value={meta.selection}
                onChange={(e) => setMeta({ ...meta, selection: e.target.value })}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Odds (American)">
                <Input
                  type="number"
                  value={odds || ""}
                  onChange={(e) => setOdds(+e.target.value || 0)}
                />
              </Field>
              <Field label={`Your est. win % (implied ${implied.toFixed(1)}%)`}>
                <Input
                  type="number"
                  step="0.5"
                  value={trueProbPct}
                  onChange={(e) => setTrueProbPct(+e.target.value || 0)}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Promotion applied">
                <Select value={promoType} onChange={(e) => setPromoType(e.target.value)}>
                  {PROMO_TYPES.map((s) => <option key={s}>{s}</option>)}
                </Select>
              </Field>
              {(promoType.includes("Boost")) && (
                <Field label="Boost %">
                  <Input
                    type="number"
                    value={boostPct}
                    onChange={(e) => setBoostPct(+e.target.value || 0)}
                  />
                </Field>
              )}
            </div>

            <FlagGroup title="Situational factors" items={SITUATIONAL} flags={flags} toggle={toggle} />
            <FlagGroup title="Market intelligence" items={SIGNALS} flags={flags} toggle={toggle} />
            <FlagGroup title="Risk factors" items={RISKS} flags={flags} toggle={toggle} />

            <Field label={`Homework done: ${Math.round(homework * 100)}% of the ${meta.sport} checklist`}>
              <input
                type="range"
                min={0}
                max={1}
                step={0.1}
                value={homework}
                onChange={(e) => setHomework(+e.target.value)}
                className="w-full accent-blue-500"
              />
            </Field>

            <div className="flex gap-2 pt-1">
              <Button onClick={run} className="flex-1">
                <Bot size={15} /> Score this bet
              </Button>
              <Button variant="outline" onClick={runWithClaude} disabled={aiLoading}>
                <Sparkles size={15} />
                {aiLoading ? "Thinking…" : "+ Claude analysis"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Result column */}
        <div className="space-y-5 xl:col-span-3">
          {!result ? (
            <Card className="flex min-h-[300px] items-center justify-center p-8 text-center">
              <div>
                <Bot className="mx-auto mb-3 text-muted" size=
{28} />
                <p className="text-sm font-medium text-zinc-300">
                  Enter a bet and run the scoring engine.
                </p>
                <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-muted">
                  Seven dimensions are scored 1–10 and blended into a Final Bet
                  Score (1–100). EV matters here — but so do CLV projection,
                  situational spots, sharp-money signals, promotion value, and
                  portfolio risk. Below 60 we pass. No forced picks.
                </p>
              </div>
            </Card>
          ) : (
            <>
              <Card>
                <CardContent className="p-5">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <div className="text-xs uppercase tracking-wider text-muted">
                        {meta.selection || "Unnamed selection"} · {fmtOdds(odds)} ·{" "}
                        {meta.sportsbook}
                      </div>
                      <div className="mt-1 flex items-center gap-3">
                        <span className="font-mono text-4xl font-black tabular-nums text-zinc-50">
                          {result.finalScore}
                        </span>
                        <div>
                          <VerdictBadge verdict={result.verdict} />
                          <div className="mt-1 text-xs font-medium text-muted">
                            {result.rating}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs md:grid-cols-3">
                      <Kv k="Est. true prob" v={`${trueProbPct.toFixed(1)}%`} />
                      <Kv k="Implied prob" v={`${result.impliedProb}%`} />
                      <Kv k="Edge" v={fmtPct(result.edgePct, { sign: true })} good={result.edgePct > 0} />
                      <Kv k="EV" v={fmtPct(result.evPct, { sign: true })} good={result.evPct > 0} />
                      <Kv k="CLV projection" v={fmtPct(result.clvProjection, { sign: true })} good={result.clvProjection > 0} />
                      <Kv
                        k="Stake rec"
                        v={
                          result.stakeRec > 0
                            ? `${fmtMoney(result.stakeRec, cur)} (${result.unitsRec}u)`
                            : "No bet"
                        }
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-5 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Score breakdown</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <ScoreBar label={`Statistical edge (${pct(SCORE_WEIGHTS.statisticalEdge)})`} value={result.scores.statisticalEdge} />
                    <ScoreBar label={`Market value (${pct(SCORE_WEIGHTS.marketValue)})`} value={result.scores.marketValue} />
                    <ScoreBar label={`Situational edge (${pct(SCORE_WEIGHTS.situationalEdge)})`} value={result.scores.situationalEdge} />
                    <ScoreBar label={`Market intelligence (${pct(SCORE_WEIGHTS.marketIntelligence)})`} value={result.scores.marketIntelligence} />
                    <ScoreBar label={`Risk — lower is better (${pct(SCORE_WEIGHTS.riskSafety)})`} value={result.scores.risk} invert />
                    <ScoreBar label={`Promotion value (${pct(SCORE_WEIGHTS.promotionValue)})`} value={result.scores.promotionValue} />
                    <ScoreBar label={`Confidence (${pct(SCORE_WEIGHTS.confidence)})`} value={result.scores.confidence} />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Factors & risks</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-[13px]">
                    <div>
                      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-profit">
                        Supporting factors
                      </div>
                      {result.factors.length === 0 && (
                        <p className="text-xs text-muted">None identified.</p>
                      )}
                      <ul className="space-y-1">
                        {result.factors.map((f, i) => (
                          <li key={i} className="flex gap-2 text-zinc-300">
                            <span className="text-profit">+</span> {f}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-loss">
                        Key risks
                      </div>
                      {result.risks.length === 0 && (
                        <p className="text-xs text-muted">None identified.</p>
                      )}
                      <ul className="space-y-1">
                        {result.risks.map((r, i) => (
                          <li key={i} className="flex gap-2 text-zinc-300">
                            <span className="text-loss">–</span> {r}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {aiNote && (
                <Card className="border-violet/30">
                  <CardHeader>
                    <CardTitle className="text-violet">Claude analysis</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-zinc-300">
                      {aiNote}
                    </p>
                  </CardContent>
                </Card>
              )}

              <div className="flex items-center gap-2">
                <Button onClick={saveToBoard} disabled={saved} variant="success">
                  <Save size={15} />
                  {saved ? "Saved to Picks Board" : "Save to Picks Board"}
                </Button>
                {result.verdict === "PASS" && (
                  <span className="text-xs text-muted">
                    Passing is a result too — protecting bankroll IS the edge.
                  </span>
                )}
              </div>
            </>
          )}

          {/* Sport framework checklist */}
          <Card>
            <CardHeader>
              <CardTitle>{meta.sport} analysis framework</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="grid gap-1.5 text-[13px] text-zinc-300 md:grid-cols-2">
                {(SPORT_FRAMEWORKS[meta.sport] ?? SPORT_FRAMEWORKS.Other).map(
                  (item, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-blue-400">▸</span> {item}
                    </li>
                  )
                )}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}

function Kv({ k, v, good }: { k: string; v: string; good?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2 md:block">
      <span className="text-muted">{k}</span>
      <div
        className={`font-mono font-bold tabular-nums ${
          good == null ? "text-zinc-200" : good ? "text-profit" : "text-loss"
        }`}
      >
        {v}
      </div>
    </div>
  );
}

function FlagGroup({
  title,
  items,
  flags,
  toggle,
}: {
  title: string;
  items: readonly (readonly [string, string])[];
  flags: Record<string, boolean>;
  toggle: (k: string) => void;
}) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-medium text-muted">{title}</div>
      <div className="flex flex-wrap gap-1.5">
        {items.map(([key, label]) => (
          <button
            key={key}
            onClick={() => toggle(key)}
            className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
              flags[key]
                ? "border-accent/50 bg-accent/15 text-blue-400"
                : "border-border bg-panel-2 text-muted hover:text-zinc-300"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
