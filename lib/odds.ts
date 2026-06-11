// ── Betting math: odds conversion, EV, edge, Kelly, CLV ──────────────
// All probabilities are 0–1. American odds are integers like -110, +250.

/** American odds → decimal odds (total return per $1 staked). */
export function americanToDecimal(odds: number): number {
  if (odds === 0) return 1;
  return odds > 0 ? 1 + odds / 100 : 1 + 100 / Math.abs(odds);
}

/** Decimal odds → American odds (rounded). */
export function decimalToAmerican(decimal: number): number {
  if (decimal <= 1) return 0;
  return decimal >= 2
    ? Math.round((decimal - 1) * 100)
    : Math.round(-100 / (decimal - 1));
}

/** Implied probability from American odds (includes the book's vig). */
export function impliedProbability(odds: number): number {
  return 1 / americanToDecimal(odds);
}

/** Profit (excluding stake) on a winning bet. */
export function winProfit(odds: number, stake: number): number {
  return stake * (americanToDecimal(odds) - 1);
}

/** Total payout (including stake) on a winning bet. */
export function totalPayout(odds: number, stake: number): number {
  return stake * americanToDecimal(odds);
}

/** Edge = your estimated true probability minus the implied probability. */
export function edge(trueProb: number, odds: number): number {
  return trueProb - impliedProbability(odds);
}

/**
 * Expected value as a fraction of stake.
 * EV = p * (decimal - 1) - (1 - p)
 */
export function expectedValue(trueProb: number, odds: number): number {
  const b = americanToDecimal(odds) - 1;
  return trueProb * b - (1 - trueProb);
}

/**
 * Full Kelly fraction of bankroll. Negative means no bet.
 * f* = (b*p - q) / b, where b = decimal - 1.
 */
export function kellyFraction(trueProb: number, odds: number): number {
  const b = americanToDecimal(odds) - 1;
  if (b <= 0) return 0;
  return (b * trueProb - (1 - trueProb)) / b;
}

export interface KellyConfig {
  multiplier: number; // fraction of full Kelly
  capPct: number; // max % of bankroll on one bet
}

export const KELLY_BY_RISK: Record<string, KellyConfig> = {
  conservative: { multiplier: 0.25, capPct: 0.02 },
  balanced: { multiplier: 0.5, capPct: 0.03 },
  aggressive: { multiplier: 1.0, capPct: 0.05 },
};

/** Recommended stake in dollars using fractional Kelly with a hard cap. */
export function recommendedStake(
  trueProb: number,
  odds: number,
  bankroll: number,
  risk: "conservative" | "balanced" | "aggressive"
): number {
  const cfg = KELLY_BY_RISK[risk];
  const f = kellyFraction(trueProb, odds) * cfg.multiplier;
  if (f <= 0) return 0;
  const capped = Math.min(f, cfg.capPct);
  return Math.round(bankroll * capped * 100) / 100;
}

/**
 * Closing Line Value: how much better your odds were than the closing odds.
 * Positive CLV means you beat the close (the strongest predictor of
 * long-term profitability). Expressed as a percentage.
 * CLV% = (decimal_bet / decimal_close - 1) * 100
 */
export function clvPct(betOdds: number, closingOdds: number): number {
  const dBet = americanToDecimal(betOdds);
  const dClose = americanToDecimal(closingOdds);
  if (dClose <= 1) return 0;
  return (dBet / dClose - 1) * 100;
}

/** Apply a profit boost: returns the new effective American odds. */
export function boostOdds(odds: number, boostPct: number): number {
  const profitMult = (americanToDecimal(odds) - 1) * (1 + boostPct / 100);
  return decimalToAmerican(1 + profitMult);
}

/** Profit/loss for a settled bet. Bonus bets risk no cash. */
export function settleProfit(bet: {
  odds: number;
  stake: number;
  status: string;
  promotionType?: string;
  cashoutAmount?: number | null;
}): number {
  const isBonus = bet.promotionType === "Bonus Bet";
  switch (bet.status) {
    case "win":
      // Bonus bets pay profit only (stake is not returned and was never cash)
      return winProfit(bet.odds, bet.stake);
    case "loss":
      return isBonus ? 0 : -bet.stake;
    case "push":
    case "void":
      return 0;
    case "cashout":
      return (bet.cashoutAmount ?? 0) - (isBonus ? 0 : bet.stake);
    default:
      return 0; // pending
  }
}

/** Format American odds with sign: +250, -110. */
export function fmtOdds(odds: number | null | undefined): string {
  if (odds == null || isNaN(odds)) return "—";
  return odds > 0 ? `+${odds}` : `${odds}`;
}
