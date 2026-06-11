// ── Promotion EV calculators (FanDuel / DraftKings promo mechanics) ──
import { americanToDecimal, boostOdds, expectedValue } from "./odds";
import { PromoType } from "./types";

export interface PromoAnalysis {
  promoType: PromoType;
  estEvPct: number; // EV as % of max stake
  estEvDollars: number;
  optimalStake: number;
  bestUse: string;
  risk: string;
  alternatives: string[];
}

/** Expected conversion rate of a bonus bet placed at the given odds (fair odds assumed). */
export function bonusBetConversion(odds: number): number {
  const d = americanToDecimal(odds);
  return (d - 1) / d; // profit-only payout at fair probability 1/d
}

/**
 * Analyze a promotion. `odds` is where you plan to use it; `trueProb` is an
 * optional sharper estimate of win probability (defaults to fair implied).
 */
export function analyzePromotion(params: {
  promoType: PromoType;
  maxStake: number;
  odds: number;
  boostPct?: number | null;
  trueProb?: number | null;
}): PromoAnalysis {
  const { promoType, maxStake, odds } = params;
  const d = americanToDecimal(odds);
  const p = params.trueProb ?? 1 / d; // assume fair if no estimate
  const boost = params.boostPct ?? 0;

  let evFrac = 0;
  let bestUse = "";
  let risk = "";
  let alternatives: string[] = [];

  switch (promoType) {
    case "Bonus Bet": {
      // Profit-only payout; stake is not cash.
      evFrac = p * (d - 1);
      bestUse = `Use at longer odds (+200 to +400) to maximize conversion. At ${
        odds > 0 ? "+" : ""
      }${odds}, expected conversion is ${(bonusBetConversion(odds) * 100).toFixed(0)}% of face value.`;
      risk = "No cash at risk — worst case the bonus expires worthless. Variance is in how much you convert.";
      alternatives = [
        "Hedge on another book to lock in ~65-70% of face value risk-free",
        "Split into 2 smaller bonus bets to reduce variance",
        "Use on a moderately sharp prop line where you have an edge",
      ];
      break;
    }
    case "Profit Boost":
    case "Odds Boost":
    case "SGP Boost":
    case "Parlay Boost": {
      const boosted = boostOdds(odds, boost);
      evFrac = expectedValue(p, boosted);
      bestUse = `Apply to the highest odds eligible. A ${boost}% boost at ${
        odds > 0 ? "+" : ""
      }${odds} turns it into ~${boosted > 0 ? "+" : ""}${boosted}. Break-even win probability drops from ${(100 / d).toFixed(1)}% to ${(100 / americanToDecimal(boosted)).toFixed(1)}%.`;
      risk = "Full stake at risk like a normal bet — the boost only improves the payout side.";
      alternatives = [
        "Pair with a market where the un-boosted line is already near fair value",
        "If max stake is small, use on higher odds to extract more absolute EV",
        "Compare boosted EV across FanDuel and DraftKings before placing",
      ];
      break;
    }
    case "No Sweat Bet": {
      // If it loses you get a bonus bet refund worth ~70% of stake.
      const refundValue = 0.7;
      evFrac = p * (d - 1) - (1 - p) * (1 - refundValue);
      bestUse = `Bet at plus-money odds (+150 to +250). If it loses, the refund (worth ~${refundValue * 100}% as a bonus bet) limits real loss to ~${((1 - refundValue) * 100).toFixed(0)}% of stake.`;
      risk = "Real loss is capped but not zero — refund comes as a bonus bet, not cash.";
      alternatives = [
        "Use on higher-variance markets than you normally would (the insurance subsidizes variance)",
        "Hedge the no-sweat leg on another book for a near risk-free profit",
      ];
      break;
    }
    case "Deposit Match": {
      evFrac = (boost || 100) / 100 * 0.75; // discount for playthrough requirements
      bestUse = "Deposit the full match amount. Clear the playthrough on low-vig, near-even markets to preserve value.";
      risk = "Playthrough requirements mean the match is not instantly withdrawable cash.";
      alternatives = ["Clear playthrough with high-probability favorites to minimize variance"];
      break;
    }
    default: {
      evFrac = expectedValue(p, d > 1 ? odds : 100);
      bestUse = "Evaluate against the un-promoted line — only use if it improves your effective price.";
      risk = "Standard bet risk applies.";
      alternatives = ["Compare with using no promotion at a sharper line elsewhere"];
    }
  }

  return {
    promoType,
    estEvPct: Math.round(evFrac * 1000) / 10,
    estEvDollars: Math.round(evFrac * maxStake * 100) / 100,
    optimalStake: maxStake, // promos are +EV → max allowed, bounded by promo terms
    bestUse,
    risk,
    alternatives,
  };
}
