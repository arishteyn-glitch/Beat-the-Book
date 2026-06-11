// ── Aggregate statistics over the bet history ────────────────────────
import { Bet, BetReview, Settings } from "./types";
import { clvPct, impliedProbability, settleProfit } from "./odds";

export const SETTLED: ReadonlySet<string> = new Set([
  "win",
  "loss",
  "push",
  "cashout",
  "void",
]);

export function isSettled(b: Bet): boolean {
  return SETTLED.has(b.status);
}

export function profitOf(b: Bet): number {
  return settleProfit(b);
}

/** Cash actually at risk (bonus bets risk $0). */
export function cashRisked(b: Bet): number {
  return b.promotionType === "Bonus Bet" ? 0 : b.stake;
}

export interface OverallStats {
  totalBets: number;
  settled: number;
  pending: number;
  wins: number;
  losses: number;
  pushes: number;
  winRate: number; // wins / (wins + losses)
  profit: number;
  totalStaked: number;
  roi: number; // profit / totalStaked
  units: number;
  avgOdds: number;
  avgStake: number;
  openExposure: number;
  avgClv: number | null;
  clvWinRate: number | null; // % of bets with positive CLV
  currentBankroll: number;
  maxDrawdown: number;
  maxLosingStreak: number;
}

export function overallStats(bets: Bet[], settings: Settings): OverallStats {
  const settledBets = bets.filter(isSettled);
  const pendingBets = bets.filter((b) => b.status === "pending");
  const wins = settledBets.filter((b) => b.status === "win").length;
  const losses = settledBets.filter((b) => b.status === "loss").length;
  const pushes = settledBets.filter(
    (b) => b.status === "push" || b.status === "void"
  ).length;

  const profit = settledBets.reduce((s, b) => s + profitOf(b), 0);
  const totalStaked = settledBets.reduce((s, b) => s + cashRisked(b), 0);
  const decided = wins + losses;

  const withClv = settledBets.filter((b) => b.closingLine != null);
  const clvs = withClv.map((b) => clvPct(b.odds, b.closingLine as number));
  const avgClv = clvs.length
    ? clvs.reduce((a, c) => a + c, 0) / clvs.length
    : null;
  const clvWinRate = clvs.length
    ? (clvs.filter((c) => c > 0).length / clvs.length) * 100
    : null;

  // Equity curve for drawdown (chronological)
  const chrono = [...settledBets].sort((a, b) => a.date.localeCompare(b.date));
  let equity = settings.startingBankroll;
  let peak = equity;
  let maxDrawdown = 0;
  let streak = 0;
  let maxLosingStreak = 0;
  for (const b of chrono) {
    equity += profitOf(b);
    peak = Math.max(peak, equity);
    maxDrawdown = Math.max(maxDrawdown, peak - equity);
    if (b.status === "loss") {
      streak += 1;
      maxLosingStreak = Math.max(maxLosingStreak, streak);
    } else if (b.status === "win") {
      streak = 0;
    }
  }

  return {
    totalBets: bets.length,
    settled: settledBets.length,
    pending: pendingBets.length,
    wins,
    losses,
    pushes,
    winRate: decided ? (wins / decided) * 100 : 0,
    profit,
    totalStaked,
    roi: totalStaked ? (profit / totalStaked) * 100 : 0,
    units: settings.unitSize ? profit / settings.unitSize : 0,
    avgOdds: settledBets.length
      ? settledBets.reduce((s, b) => s + b.odds, 0) / settledBets.length
      : 0,
    avgStake: settledBets.length ? totalStaked / Math.max(1, settledBets.length) : 0,
    openExposure: pendingBets.reduce((s, b) => s + cashRisked(b), 0),
    avgClv,
    clvWinRate,
    currentBankroll: settings.startingBankroll + profit,
    maxDrawdown,
    maxLosingStreak,
  };
}

export interface GroupStat {
  key: string;
  bets: number;
  wins: number;
  losses: number;
  profit: number;
  staked: number;
  roi: number;
  units: number;
}

export function groupBy(
  bets: Bet[],
  keyFn: (b: Bet) => string,
  unitSize: number
): GroupStat[] {
  const map = new Map<string, GroupStat>();
  for (const b of bets.filter(isSettled)) {
    const key = keyFn(b) || "Unknown";
    const g =
      map.get(key) ??
      ({ key, bets: 0, wins: 0, losses: 0, profit: 0, staked: 0, roi: 0, units: 0 } as GroupStat);
    g.bets += 1;
    if (b.status === "win") g.wins += 1;
    if (b.status === "loss") g.losses += 1;
    g.profit += profitOf(b);
    g.staked += cashRisked(b);
    map.set(key, g);
  }
  const out = [...map.values()];
  for (const g of out) {
    g.roi = g.staked ? (g.profit / g.staked) * 100 : 0;
    g.units = unitSize ? g.profit / unitSize : 0;
  }
  return out.sort((a, b) => b.profit - a.profit);
}

export interface SeriesPoint {
  date: string;
  label: string;
  profit: number; // cumulative
  units: number;
  roi: number; // cumulative ROI %
  bankroll: number;
  daily: number; // profit that day
}

/** Cumulative profit/units/ROI/bankroll series by day. */
export function profitSeries(bets: Bet[], settings: Settings): SeriesPoint[] {
  const settled = bets
    .filter(isSettled)
    .sort((a, b) => a.date.localeCompare(b.date));
  const byDay = new Map<string, { profit: number; staked: number }>();
  for (const b of settled) {
    const day = b.date.slice(0, 10);
    const d = byDay.get(day) ?? { profit: 0, staked: 0 };
    d.profit += profitOf(b);
    d.staked += cashRisked(b);
    byDay.set(day, d);
  }
  const days = [...byDay.keys()].sort();
  let cumProfit = 0;
  let cumStaked = 0;
  return days.map((day) => {
    const d = byDay.get(day)!;
    cumProfit += d.profit;
    cumStaked += d.staked;
    return {
      date: day,
      label: day.slice(5),
      profit: round2(cumProfit),
      units: settings.unitSize ? round2(cumProfit / settings.unitSize) : 0,
      roi: cumStaked ? round2((cumProfit / cumStaked) * 100) : 0,
      bankroll: round2(settings.startingBankroll + cumProfit),
      daily: round2(d.profit),
    };
  });
}

/** Profit grouped by period: "month" → YYYY-MM, "week" → ISO week start, "day". */
export function profitByPeriod(
  bets: Bet[],
  period: "month" | "week" | "day",
  unitSize: number
): { label: string; profit: number; units: number }[] {
  const keyFn = (dateStr: string) => {
    if (period === "month") return dateStr.slice(0, 7);
    if (period === "day") return dateStr.slice(0, 10);
    const d = new Date(dateStr.slice(0, 10) + "T00:00:00");
    const day = d.getDay();
    const diff = (day + 6) % 7; // Monday start
    d.setDate(d.getDate() - diff);
    return d.toISOString().slice(0, 10);
  };
  const map = new Map<string, number>();
  for (const b of bets.filter(isSettled)) {
    const k = keyFn(b.date);
    map.set(k, (map.get(k) ?? 0) + profitOf(b));
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([label, profit]) => ({
      label,
      profit: round2(profit),
      units: unitSize ? round2(profit / unitSize) : 0,
    }));
}

/** Buckets of CLV values for a histogram. */
export function clvDistribution(bets: Bet[]): { bucket: string; count: number }[] {
  const edges = [-10, -6, -4, -2, 0, 2, 4, 6, 10];
  const labels = [
    "< -10%",
    "-10 to -6%",
    "-6 to -4%",
    "-4 to -2%",
    "-2 to 0%",
    "0 to 2%",
    "2 to 4%",
    "4 to 6%",
    "6 to 10%",
    "> 10%",
  ];
  const counts = new Array(labels.length).fill(0);
  for (const b of bets) {
    if (b.closingLine == null || !isSettled(b)) continue;
    const c = clvPct(b.odds, b.closingLine);
    let i = edges.findIndex((e) => c < e);
    if (i === -1) i = labels.length - 1;
    counts[i] += 1;
  }
  return labels
    .map((bucket, i) => ({ bucket, count: counts[i] }))
    .filter((x) => x.count > 0);
}

/** Odds-range buckets for ROI analysis. */
export function oddsRange(odds: number): string {
  if (odds <= -200) return "Heavy fav (≤ -200)";
  if (odds < -110) return "Favorite (-199 to -111)";
  if (odds <= 110) return "Near even (-110 to +110)";
  if (odds <= 200) return "Underdog (+111 to +200)";
  if (odds <= 400) return "Longshot (+201 to +400)";
  return "Lottery (> +400)";
}

export interface ReviewStats {
  reviewed: number;
  goodWins: number;
  badWins: number;
  goodLosses: number;
  badLosses: number;
  processScore: number; // % "yes" of reviewed
  decisionQuality: number; // 0-100 weighted
}

/**
 * Decision-quality matrix. "Good" = you'd make the same bet again (process
 * was sound); the result is irrelevant to process quality.
 */
export function reviewStats(bets: Bet[], reviews: BetReview[]): ReviewStats {
  const byId = new Map(bets.map((b) => [b.id, b]));
  let goodWins = 0,
    badWins = 0,
    goodLosses = 0,
    badLosses = 0,
    yes = 0,
    counted = 0;
  for (const r of reviews) {
    const b = byId.get(r.betId);
    if (!b || (b.status !== "win" && b.status !== "loss")) continue;
    counted += 1;
    if (r.answer === "yes") yes += 1;
    const good = r.answer === "yes";
    const unsure = r.answer === "unsure";
    if (unsure) continue;
    if (b.status === "win") good ? goodWins++ : badWins++;
    else good ? goodLosses++ : badLosses++;
  }
  const decided = goodWins + badWins + goodLosses + badLosses;
  // Process score: good-process bets as % of decided reviews
  const processScore = decided ? ((goodWins + goodLosses) / decided) * 100 : 0;
  // Decision quality: penalize bad wins slightly less than bad losses
  const decisionQuality = decided
    ? ((goodWins + goodLosses + 0.25 * badWins) / decided) * 100
    : 0;
  return {
    reviewed: counted,
    goodWins,
    badWins,
    goodLosses,
    badLosses,
    processScore,
    decisionQuality,
  };
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Average implied probability of the bettor's settled bets. */
export function avgImplied(bets: Bet[]): number {
  const s = bets.filter(isSettled);
  if (!s.length) return 0;
  return s.reduce((a, b) => a + impliedProbability(b.odds), 0) / s.length;
}
