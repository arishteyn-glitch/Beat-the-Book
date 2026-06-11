import { describe, expect, it } from "vitest";
import {
  americanToDecimal,
  boostOdds,
  clvPct,
  decimalToAmerican,
  edge,
  expectedValue,
  impliedProbability,
  kellyFraction,
  recommendedStake,
  settleProfit,
  totalPayout,
  winProfit,
} from "@/lib/odds";

describe("odds conversion", () => {
  it("converts American to decimal", () => {
    expect(americanToDecimal(100)).toBeCloseTo(2.0);
    expect(americanToDecimal(-110)).toBeCloseTo(1.9091, 3);
    expect(americanToDecimal(250)).toBeCloseTo(3.5);
    expect(americanToDecimal(-200)).toBeCloseTo(1.5);
  });

  it("converts decimal back to American", () => {
    expect(decimalToAmerican(2.0)).toBe(100);
    expect(decimalToAmerican(3.5)).toBe(250);
    expect(decimalToAmerican(1.5)).toBe(-200);
  });

  it("computes implied probability with vig", () => {
    expect(impliedProbability(-110)).toBeCloseTo(0.5238, 3);
    expect(impliedProbability(100)).toBeCloseTo(0.5);
    expect(impliedProbability(300)).toBeCloseTo(0.25);
  });
});

describe("payouts", () => {
  it("computes win profit and total payout", () => {
    expect(winProfit(-110, 110)).toBeCloseTo(100);
    expect(winProfit(250, 10)).toBeCloseTo(25);
    expect(totalPayout(250, 10)).toBeCloseTo(35);
  });
});

describe("edge and EV", () => {
  it("positive edge when true prob beats implied", () => {
    expect(edge(0.55, -110)).toBeCloseTo(0.0262, 3);
    expect(edge(0.5, -110)).toBeLessThan(0);
  });

  it("EV is zero at fair odds", () => {
    expect(expectedValue(0.5, 100)).toBeCloseTo(0);
    // 55% at -110: EV = .55*(0.9091) - .45 ≈ +5%
    expect(expectedValue(0.55, -110)).toBeCloseTo(0.05, 2);
  });
});

describe("Kelly", () => {
  it("computes full Kelly fraction", () => {
    // p=0.55, b=0.9091 → f = (0.9091*0.55 - 0.45)/0.9091 ≈ 0.055
    expect(kellyFraction(0.55, -110)).toBeCloseTo(0.055, 2);
    expect(kellyFraction(0.5, -110)).toBeLessThan(0);
  });

  it("recommended stake respects caps and risk modes", () => {
    const bankroll = 1000;
    // big edge → would be huge Kelly, must hit the cap
    const aggressive = recommendedStake(0.7, -110, bankroll, "aggressive");
    expect(aggressive).toBeLessThanOrEqual(bankroll * 0.05);
    const conservative = recommendedStake(0.7, -110, bankroll, "conservative");
    expect(conservative).toBeLessThanOrEqual(bankroll * 0.02);
    // no edge → no bet
    expect(recommendedStake(0.5, -110, bankroll, "balanced")).toBe(0);
  });
});

describe("CLV", () => {
  it("positive when you beat the closing line", () => {
    // bet +110, closed at +100 → you got the better price
    expect(clvPct(110, 100)).toBeCloseTo(5.0, 1);
    // bet -110, closed -110 → zero
    expect(clvPct(-110, -110)).toBeCloseTo(0);
    // bet -120, closed -110 → negative CLV
    expect(clvPct(-120, -110)).toBeLessThan(0);
  });
});

describe("boosts", () => {
  it("applies profit boost to the profit portion only", () => {
    // +200 with 50% boost → profit 2.0 → 3.0 → +300
    expect(boostOdds(200, 50)).toBe(300);
    // -110 with 30% boost → profit .9091 → 1.1818 → +118
    expect(boostOdds(-110, 30)).toBe(118);
  });
});

describe("settlement", () => {
  const base = { odds: -110, stake: 110, promotionType: "None", cashoutAmount: null };
  it("settles wins, losses, pushes", () => {
    expect(settleProfit({ ...base, status: "win" })).toBeCloseTo(100);
    expect(settleProfit({ ...base, status: "loss" })).toBe(-110);
    expect(settleProfit({ ...base, status: "push" })).toBe(0);
    expect(settleProfit({ ...base, status: "void" })).toBe(0);
    expect(settleProfit({ ...base, status: "pending" })).toBe(0);
  });

  it("bonus bets lose nothing and pay profit only", () => {
    const bonus = { odds: 250, stake: 25, promotionType: "Bonus Bet", cashoutAmount: null };
    expect(settleProfit({ ...bonus, status: "loss" })).toBe(0);
    expect(settleProfit({ ...bonus, status: "win" })).toBeCloseTo(62.5);
  });

  it("cashout returns cashout minus stake", () => {
    expect(
      settleProfit({ ...base, status: "cashout", cashoutAmount: 150 })
    ).toBeCloseTo(40);
  });
});
