import { describe, expect, it } from "vitest";
import { Bet, BetReview, DEFAULT_SETTINGS } from "@/lib/types";
import {
  clvDistribution,
  groupBy,
  oddsRange,
  overallStats,
  profitByPeriod,
  profitSeries,
  reviewStats,
} from "@/lib/stats";

function bet(overrides: Partial<Bet>): Bet {
  return {
    id: Math.random().toString(36).slice(2),
    date: "2026-06-01",
    sport: "NBA",
    league: "NBA",
    event: "A @ B",
    sportsbook: "FanDuel",
    betType: "Straight",
    market: "Spread",
    selection: "B -2.5",
    odds: -110,
    stake: 110,
    potentialPayout: 210,
    promotionUsed: false,
    promotionType: "None",
    confidenceScore: null,
    finalBetScore: null,
    estTrueProb: null,
    closingLine: null,
    status: "pending",
    cashoutAmount: null,
    notes: "",
    createdAt: "2026-06-01T12:00:00.000Z",
    ...overrides,
  };
}

const settings = { ...DEFAULT_SETTINGS, startingBankroll: 1000, unitSize: 10 };

describe("overallStats", () => {
  const bets: Bet[] = [
    bet({ status: "win", odds: -110, stake: 110, date: "2026-06-01" }), // +100
    bet({ status: "loss", odds: -110, stake: 110, date: "2026-06-02" }), // -110
    bet({ status: "win", odds: 200, stake: 50, date: "2026-06-03" }), // +100
    bet({ status: "push", date: "2026-06-04" }), // 0
    bet({ status: "pending", stake: 25 }),
  ];

  it("computes record, profit, ROI, bankroll", () => {
    const s = overallStats(bets, settings);
    expect(s.wins).toBe(2);
    expect(s.losses).toBe(1);
    expect(s.pushes).toBe(1);
    expect(s.pending).toBe(1);
    expect(s.profit).toBeCloseTo(90);
    expect(s.totalStaked).toBeCloseTo(380);
    expect(s.roi).toBeCloseTo((90 / 380) * 100, 1);
    expect(s.units).toBeCloseTo(9);
    expect(s.currentBankroll).toBeCloseTo(1090);
    expect(s.openExposure).toBe(25);
    expect(s.winRate).toBeCloseTo((2 / 3) * 100, 1);
  });

  it("tracks drawdown and losing streaks", () => {
    const streaky: Bet[] = [
      bet({ status: "win", date: "2026-01-01" }),
      bet({ status: "loss", date: "2026-01-02" }),
      bet({ status: "loss", date: "2026-01-03" }),
      bet({ status: "loss", date: "2026-01-04" }),
      bet({ status: "win", date: "2026-01-05" }),
    ];
    const s = overallStats(streaky, settings);
    expect(s.maxLosingStreak).toBe(3);
    expect(s.maxDrawdown).toBeCloseTo(330);
  });
});

describe("grouping", () => {
  it("groups by sport with ROI", () => {
    const bets = [
      bet({ status: "win", sport: "NBA" }),
      bet({ status: "loss", sport: "NFL" }),
    ];
    const groups = groupBy(bets, (b) => b.sport, 10);
    expect(groups).toHaveLength(2);
    expect(groups[0].key).toBe("NBA"); // sorted by profit desc
    expect(groups[0].profit).toBeCloseTo(100);
    expect(groups[1].profit).toBeCloseTo(-110);
  });

  it("buckets odds ranges", () => {
    expect(oddsRange(-250)).toMatch(/Heavy fav/);
    expect(oddsRange(-110)).toMatch(/Near even/);
    expect(oddsRange(150)).toMatch(/Underdog/);
    expect(oddsRange(500)).toMatch(/Lottery/);
  });
});

describe("series", () => {
  it("builds cumulative profit series by day", () => {
    const bets = [
      bet({ status: "win", date: "2026-06-01" }),
      bet({ status: "loss", date: "2026-06-02" }),
    ];
    const series = profitSeries(bets, settings);
    expect(series).toHaveLength(2);
    expect(series[0].profit).toBeCloseTo(100);
    expect(series[1].profit).toBeCloseTo(-10);
    expect(series[1].bankroll).toBeCloseTo(990);
  });

  it("groups profit by month", () => {
    const bets = [
      bet({ status: "win", date: "2026-05-15" }),
      bet({ status: "win", date: "2026-06-15" }),
    ];
    const months = profitByPeriod(bets, "month", 10);
    expect(months).toHaveLength(2);
    expect(months[0].label).toBe("2026-05");
  });
});

describe("clvDistribution", () => {
  it("buckets only bets with closing lines", () => {
    const bets = [
      bet({ status: "win", odds: 110, closingLine: 100 }), // +5% clv
      bet({ status: "loss" }), // no closing line
    ];
    const dist = clvDistribution(bets);
    expect(dist.reduce((s, d) => s + d.count, 0)).toBe(1);
  });
});

describe("reviewStats — process over outcomes", () => {
  it("classifies the four quadrants", () => {
    const bets = [
      bet({ id: "gw", status: "win" }),
      bet({ id: "bw", status: "win" }),
      bet({ id: "gl", status: "loss" }),
      bet({ id: "bl", status: "loss" }),
    ];
    const reviews: BetReview[] = [
      { betId: "gw", answer: "yes", note: "", reviewedAt: "" },
      { betId: "bw", answer: "no", note: "", reviewedAt: "" },
      { betId: "gl", answer: "yes", note: "", reviewedAt: "" },
      { betId: "bl", answer: "no", note: "", reviewedAt: "" },
    ];
    const rs = reviewStats(bets, reviews);
    expect(rs.goodWins).toBe(1);
    expect(rs.badWins).toBe(1);
    expect(rs.goodLosses).toBe(1);
    expect(rs.badLosses).toBe(1);
    expect(rs.processScore).toBeCloseTo(50);
    // a good loss counts fully toward decision quality; a bad win barely
    expect(rs.decisionQuality).toBeCloseTo(((1 + 1 + 0.25) / 4) * 100, 1);
  });
});
