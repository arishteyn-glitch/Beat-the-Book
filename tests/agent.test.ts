import { describe, expect, it } from "vitest";
import { AgentInput, analyzeBet, ratingFor, verdictFor } from "@/lib/agent";

const baseInput = (overrides: Partial<AgentInput> = {}): AgentInput => ({
  odds: -110,
  estTrueProb: 0.55,
  promoType: "None",
  situational: {
    restAdvantage: false, injuryEdge: false, weatherEdge: false,
    schedulingSpot: false, motivationEdge: false, negativeSituation: false,
  },
  signals: {
    reverseLineMovement: false, steamWithYou: false, steamAgainstYou: false,
    heavyPublicOnYou: false, bestPriceShopped: false, lineStale: false,
  },
  riskFactors: {
    correlatedWithOpenBets: false, highVarianceMarket: false,
    lowLiquidityMarket: false, liveBet: false,
  },
  dataCompleteness: 0.7,
  ...overrides,
});

describe("ratings and verdicts", () => {
  it("maps scores to spec rating bands", () => {
    expect(ratingFor(95)).toBe("Elite Opportunity");
    expect(ratingFor(85)).toBe("Strong Bet");
    expect(ratingFor(75)).toBe("Good Bet");
    expect(ratingFor(65)).toBe("Small Edge");
    expect(ratingFor(55)).toBe("Neutral");
    expect(ratingFor(40)).toBe("Pass");
  });

  it("maps scores to verdicts", () => {
    expect(verdictFor(75)).toBe("BET");
    expect(verdictFor(65)).toBe("LEAN");
    expect(verdictFor(50)).toBe("PASS");
  });
});

describe("analyzeBet", () => {
  it("produces all seven subscores in 1-10", () => {
    const r = analyzeBet(baseInput(), 1000, 10, "balanced");
    for (const v of Object.values(r.scores)) {
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(10);
    }
    expect(r.finalScore).toBeGreaterThanOrEqual(1);
    expect(r.finalScore).toBeLessThanOrEqual(100);
  });

  it("never rates a negative-EV unpromoted bet above Neutral", () => {
    const r = analyzeBet(
      baseInput({
        estTrueProb: 0.45, // below implied — negative EV
        situational: { ...baseInput().situational, restAdvantage: true, injuryEdge: true, schedulingSpot: true },
        signals: { ...baseInput().signals, reverseLineMovement: true, steamWithYou: true },
      }),
      1000, 10, "balanced"
    );
    expect(r.finalScore).toBeLessThanOrEqual(55);
    expect(r.verdict).toBe("PASS");
  });

  it("a real edge with confirmations rates BET", () => {
    const r = analyzeBet(
      baseInput({
        estTrueProb: 0.57,
        signals: { ...baseInput().signals, reverseLineMovement: true, bestPriceShopped: true },
        situational: { ...baseInput().situational, restAdvantage: true },
        dataCompleteness: 0.9,
      }),
      1000, 10, "balanced"
    );
    expect(r.finalScore).toBeGreaterThanOrEqual(70);
    expect(r.verdict).toBe("BET");
    expect(r.stakeRec).toBeGreaterThan(0);
  });

  it("sharp money against you drags the score down", () => {
    const clean = analyzeBet(baseInput(), 1000, 10, "balanced");
    const faded = analyzeBet(
      baseInput({
        signals: { ...baseInput().signals, steamAgainstYou: true, heavyPublicOnYou: true },
      }),
      1000, 10, "balanced"
    );
    expect(faded.finalScore).toBeLessThan(clean.finalScore);
  });

  it("PASS verdicts recommend zero stake", () => {
    const r = analyzeBet(baseInput({ estTrueProb: 0.4 }), 1000, 10, "balanced");
    expect(r.verdict).toBe("PASS");
    expect(r.stakeRec).toBe(0);
  });

  it("promotions raise the score", () => {
    const noPromo = analyzeBet(baseInput(), 1000, 10, "balanced");
    const withPromo = analyzeBet(
      baseInput({ promoType: "Profit Boost", promoBoostPct: 30 }),
      1000, 10, "balanced"
    );
    expect(withPromo.finalScore).toBeGreaterThan(noPromo.finalScore);
  });
});
