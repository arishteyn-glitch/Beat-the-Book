// ── The quantitative scoring engine behind the AI Agent ──────────────
//
// Philosophy: EV matters, but it is not the only factor. Every bet is
// scored across seven dimensions, combined into a Final Bet Score (1-100),
// and mapped to a BET / LEAN / PASS verdict. Bankroll preservation and
// long-term ROI outrank any single opportunity.

import {
  americanToDecimal,
  edge,
  expectedValue,
  impliedProbability,
  recommendedStake,
} from "./odds";
import { AgentScores, PromoType, RiskTolerance } from "./types";

export interface SituationalFactors {
  restAdvantage: boolean;
  injuryEdge: boolean; // injury news the market hasn't fully priced
  weatherEdge: boolean;
  schedulingSpot: boolean; // letdown / lookahead / travel spot in your favor
  motivationEdge: boolean;
  negativeSituation: boolean; // the spot actually works against your side
}

export interface MarketSignals {
  reverseLineMovement: boolean; // line moved against public %
  steamWithYou: boolean; // sharp money moved toward your side
  steamAgainstYou: boolean;
  heavyPublicOnYou: boolean; // you're with the heavy public side
  bestPriceShopped: boolean; // confirmed best available price
  lineStale: boolean; // book slow to move vs market consensus
}

export interface RiskFactors {
  correlatedWithOpenBets: boolean;
  highVarianceMarket: boolean; // SGPs, longshot props
  lowLiquidityMarket: boolean; // obscure markets, wider true vig
  liveBet: boolean;
}

export interface AgentInput {
  odds: number;
  estTrueProb: number; // 0-1
  promoType: PromoType;
  promoBoostPct?: number;
  situational: SituationalFactors;
  signals: MarketSignals;
  riskFactors: RiskFactors;
  dataCompleteness?: number; // 0-1, how much homework backs the estimate
}

export interface AgentResult {
  scores: AgentScores;
  finalScore: number; // 1-100
  verdict: "BET" | "LEAN" | "PASS";
  rating: string;
  edgePct: number;
  evPct: number;
  impliedProb: number;
  clvProjection: number;
  stakeRec: number;
  unitsRec: number;
  factors: string[];
  risks: string[];
}

const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, n));
const score10 = (n: number) => clamp(Math.round(n * 10) / 10, 1, 10);

export function ratingFor(finalScore: number): string {
  if (finalScore >= 90) return "Elite Opportunity";
  if (finalScore >= 80) return "Strong Bet";
  if (finalScore >= 70) return "Good Bet";
  if (finalScore >= 60) return "Small Edge";
  if (finalScore >= 50) return "Neutral";
  return "Pass";
}

export function verdictFor(finalScore: number): "BET" | "LEAN" | "PASS" {
  if (finalScore >= 70) return "BET";
  if (finalScore >= 60) return "LEAN";
  return "PASS";
}

/** Weights used to blend subscores into the Final Bet Score. */
export const SCORE_WEIGHTS = {
  statisticalEdge: 0.22,
  marketValue: 0.2,
  situationalEdge: 0.12,
  marketIntelligence: 0.14,
  riskSafety: 0.12, // inverted risk
  promotionValue: 0.1,
  confidence: 0.1,
} as const;

export function analyzeBet(
  input: AgentInput,
  bankroll: number,
  unitSize: number,
  risk: RiskTolerance
): AgentResult {
  const { odds, estTrueProb, promoType } = input;
  const implied = impliedProbability(odds);
  const e = edge(estTrueProb, odds); // probability points
  const ev = expectedValue(estTrueProb, odds); // fraction of stake
  const factors: string[] = [];
  const risks: string[] = [];

  // 1) Statistical Edge: driven by edge in probability points.
  //    0 edge → 3, +2pts → ~5.5, +5pts → ~8, +8pts → 10. Negative edges sink fast.
  const statisticalEdge = score10(3 + e * 100 * 0.85);
  if (e > 0.04) factors.push(`Estimated edge of ${(e * 100).toFixed(1)} points over the implied probability`);
  else if (e <= 0) risks.push("No statistical edge versus the implied probability — the price must be justified elsewhere");

  // 2) Market Value: EV% plus price-shopping confirmation.
  let marketValue = 3 + ev * 100 * 0.55;
  if (input.signals.bestPriceShopped) {
    marketValue += 1;
    factors.push("Best available price confirmed via line shopping");
  }
  if (input.signals.lineStale) {
    marketValue += 0.75;
    factors.push("Book appears slow to move versus market consensus");
  }
  marketValue = score10(marketValue);
  if (ev > 0.03) factors.push(`Positive expected value of ${(ev * 100).toFixed(1)}% per dollar staked`);

  // 3) Situational Edge: starts neutral, each verified situational factor helps.
  const s = input.situational;
  let situational = 5;
  if (s.restAdvantage) { situational += 1.25; factors.push("Rest advantage"); }
  if (s.injuryEdge) { situational += 1.5; factors.push("Injury news not fully priced into the line"); }
  if (s.weatherEdge) { situational += 1; factors.push("Weather conditions favor this side"); }
  if (s.schedulingSpot) { situational += 1.25; factors.push("Favorable scheduling spot (letdown/lookahead/travel)"); }
  if (s.motivationEdge) { situational += 0.75; factors.push("Motivation/stakes asymmetry"); }
  if (s.negativeSituation) { situational -= 2; risks.push("Situational spot works against this side"); }
  situational = score10(situational);

  // 4) Market Intelligence: sharp/public money signals.
  const g = input.signals;
  let intel = 5;
  if (g.reverseLineMovement) { intel += 2; factors.push("Reverse line movement toward this side"); }
  if (g.steamWithYou) { intel += 1.5; factors.push("Steam move aligned with this bet"); }
  if (g.steamAgainstYou) { intel -= 2.5; risks.push("Sharp money has moved against this side"); }
  if (g.heavyPublicOnYou) { intel -= 1.25; risks.push("Riding with heavy public money — closing line likely to move against you"); }
  intel = score10(intel);

  // 5) Risk (1 = very safe, 10 = very risky).
  const r = input.riskFactors;
  let riskScore = 3;
  if (r.correlatedWithOpenBets) { riskScore += 2; risks.push("Correlated with existing open bets — portfolio concentration risk"); }
  if (r.highVarianceMarket) { riskScore += 2; risks.push("High-variance market (parlay/longshot) — wider outcome distribution"); }
  if (r.lowLiquidityMarket) { riskScore += 1.5; risks.push("Low-liquidity market — true vig is wider and limits are a signal"); }
  if (r.liveBet) { riskScore += 1; risks.push("Live bet — price includes elevated in-play vig"); }
  const dec = americanToDecimal(odds);
  if (dec >= 5) { riskScore += 1.5; risks.push("Longshot price — most of the EV is in rare outcomes"); }
  else if (dec >= 3) riskScore += 0.5;
  riskScore = score10(riskScore);

  // 6) Promotion Value.
  let promoScore = 5; // neutral when no promo
  if (promoType !== "None") {
    const boost = input.promoBoostPct ?? 0;
    if (promoType === "Bonus Bet") promoScore = 9;
    else if (promoType === "No Sweat Bet") promoScore = 8.5;
    else if (boost >= 50) promoScore = 9;
    else if (boost >= 30) promoScore = 8;
    else if (boost >= 20) promoScore = 7.5;
    else promoScore = 6.5;
    factors.push(`${promoType} materially improves the effective price`);
  }
  promoScore = score10(promoScore);

  // 7) Confidence: data completeness + agreement between model and market signals.
  const completeness = clamp(input.dataCompleteness ?? 0.5, 0, 1);
  const agreement =
    (statisticalEdge > 5 && intel > 5) || (statisticalEdge < 5 && intel < 5)
      ? 1
      : 0;
  const confidence = score10(3 + completeness * 4 + agreement * 2);
  if (agreement && statisticalEdge > 5)
    factors.push("Model edge and market intelligence point the same direction");
  if (!agreement && statisticalEdge > 6.5)
    risks.push("Model edge and market signals disagree — size down or pass");

  const scores: AgentScores = {
    statisticalEdge,
    marketValue,
    situationalEdge: situational,
    marketIntelligence: intel,
    risk: riskScore,
    promotionValue: promoScore,
    confidence,
  };

  // Final Bet Score: weighted blend (risk inverted), scaled to 1-100.
  const w = SCORE_WEIGHTS;
  const blended =
    scores.statisticalEdge * w.statisticalEdge +
    scores.marketValue * w.marketValue +
    scores.situationalEdge * w.situationalEdge +
    scores.marketIntelligence * w.marketIntelligence +
    (11 - scores.risk) * w.riskSafety +
    scores.promotionValue * w.promotionValue +
    scores.confidence * w.confidence;
  let finalScore = clamp(Math.round(blended * 10), 1, 100);

  // Bankroll preservation override: negative EV with no promo can never rate
  // above Neutral, no matter how good the story is.
  if (ev <= 0 && promoType === "None") finalScore = Math.min(finalScore, 55);

  const verdict = verdictFor(finalScore);

  // CLV projection: edge tends to get priced in by close; project capture of
  // a fraction of your edge, boosted slightly by sharp-side signals.
  let clvProjection = e * 100 * 0.45;
  if (g.reverseLineMovement || g.steamWithYou) clvProjection += 0.8;
  if (g.heavyPublicOnYou) clvProjection -= 0.8;
  clvProjection = Math.round(clvProjection * 10) / 10;

  // Stake recommendation: fractional Kelly, dampened by Final Bet Score.
  let stakeRec = recommendedStake(estTrueProb, odds, bankroll, risk);
  const damp = finalScore >= 80 ? 1 : finalScore >= 70 ? 0.8 : finalScore >= 60 ? 0.5 : 0;
  stakeRec = Math.round(stakeRec * damp * 100) / 100;
  const unitsRec = unitSize ? Math.round((stakeRec / unitSize) * 4) / 4 : 0;

  if (verdict === "PASS" && risks.length === 0)
    risks.push("Combined score below our betting threshold — discipline says pass");

  return {
    scores,
    finalScore,
    verdict,
    rating: ratingFor(finalScore),
    edgePct: Math.round(e * 1000) / 10,
    evPct: Math.round(ev * 1000) / 10,
    impliedProb: Math.round(implied * 1000) / 10,
    clvProjection,
    stakeRec,
    unitsRec,
    factors,
    risks,
  };
}

/** Per-sport checklists shown in the AI Agent UI. */
export const SPORT_FRAMEWORKS: Record<string, string[]> = {
  NFL: [
    "EPA/play and success rate (offense vs defense)",
    "Pressure rate and sack rate vs O-line/D-line matchups",
    "Injuries (especially QB, OL, secondary)",
    "Weather (wind > 15mph hits totals and passing props)",
    "Coaching tendencies, red zone efficiency, explosive play rates",
    "Rest, travel, divisional familiarity",
    "Public % vs line movement (sharp indicators)",
  ],
  NBA: [
    "Pace, offensive/defensive/net rating, eFG% and TS%",
    "Usage shifts from injuries and rotation changes",
    "Rebounding rates and matchup assignments",
    "Back-to-backs, 3-in-4s, travel legs",
    "Three-point profile (variance driver) and transition efficiency",
    "Public % vs line movement (sharp indicators)",
  ],
  MLB: [
    "Starting pitchers: pitch mix, recent velocity, times-through-order",
    "Batter splits vs handedness, platoon advantages",
    "Bullpen fatigue and availability (last 3 days usage)",
    "Park factors, weather (wind direction, temperature), umpire",
    "Lineup strength vs projected lineup",
    "Public % vs line movement (sharp indicators)",
  ],
  NHL: [
    "Confirmed goalie + save% vs expected goals quality",
    "5v5 xG share, high-danger chances, shot quality",
    "Special teams: power play vs penalty kill matchup",
    "Rest, travel, back-to-backs",
    "Public % vs line movement (sharp indicators)",
  ],
  Soccer: [
    "xG and xGA trends, shot quality both ways",
    "Rotation risk (cup congestion, European fixtures)",
    "Home/away splits and tactical matchup",
    "Possession quality vs counter-attack exposure",
    "Public % vs line movement (sharp indicators)",
  ],
  UFC: [
    "Reach, age curve, striking differential",
    "Grappling: takedown offense/defense, submission threat",
    "Cardio and durability (recent KO losses compound)",
    "Style matchup beats raw skill comparison",
    "Public % vs line movement (sharp indicators)",
  ],
  Tennis: [
    "Surface-specific performance, hold/break rates",
    "Serve and return statistics matchup",
    "Fatigue: recent match time, travel, scheduling",
    "Style matchup (server vs returner dynamics)",
    "Public % vs line movement (sharp indicators)",
  ],
  Golf: [
    "Course fit: strokes gained by category vs course demands",
    "Driving accuracy vs distance trade-off for this layout",
    "Approach play form (most predictive SG category)",
    "Weather waves (AM/PM draw) and course history",
    "Outright vs placement market value comparison",
  ],
  Other: [
    "Build a probability estimate before looking at the line",
    "Compare your estimate to the implied probability",
    "Shop the best price across books",
    "Check for sharp/public divergence",
  ],
};
