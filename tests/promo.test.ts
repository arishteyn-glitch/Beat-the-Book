import { describe, expect, it } from "vitest";
import { analyzePromotion, bonusBetConversion } from "@/lib/promo";

describe("bonus bet conversion", () => {
  it("converts better at longer odds", () => {
    // classic numbers: +100 → 50%, +250 → ~71%, +400 → 80%
    expect(bonusBetConversion(100)).toBeCloseTo(0.5);
    expect(bonusBetConversion(250)).toBeCloseTo(0.714, 2);
    expect(bonusBetConversion(400)).toBeCloseTo(0.8);
  });
});

describe("analyzePromotion", () => {
  it("bonus bet EV at fair odds equals conversion rate", () => {
    const a = analyzePromotion({ promoType: "Bonus Bet", maxStake: 50, odds: 250 });
    expect(a.estEvDollars).toBeCloseTo(50 * 0.714, 0);
    expect(a.estEvPct).toBeGreaterThan(60);
    expect(a.optimalStake).toBe(50);
  });

  it("profit boost has positive EV at fair odds", () => {
    const a = analyzePromotion({
      promoType: "Profit Boost",
      maxStake: 25,
      odds: 200,
      boostPct: 30,
    });
    // fair prob 1/3; boosted profit 2.0*1.3=2.6 → EV = (1/3)*2.6 - (2/3) ≈ +20%
    expect(a.estEvPct).toBeCloseTo(20, 0);
    expect(a.estEvDollars).toBeGreaterThan(0);
  });

  it("no sweat bet caps downside via refund value", () => {
    const a = analyzePromotion({ promoType: "No Sweat Bet", maxStake: 25, odds: 200 });
    // p=1/3: EV = (1/3)*2 - (2/3)*(0.3) ≈ +46.7% of stake
    expect(a.estEvPct).toBeCloseTo(46.7, 0);
  });

  it("always recommends max stake on positive-EV promos", () => {
    for (const promoType of ["Bonus Bet", "Profit Boost", "No Sweat Bet"] as const) {
      const a = analyzePromotion({ promoType, maxStake: 100, odds: 250, boostPct: 25 });
      expect(a.optimalStake).toBe(100);
      expect(a.alternatives.length).toBeGreaterThan(0);
      expect(a.bestUse.length).toBeGreaterThan(10);
    }
  });
});
