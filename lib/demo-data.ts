// ── Deterministic demo dataset so the app is alive on first run ──────
import { Bet, BetReview, Promotion, Recommendation } from "./types";
import { totalPayout } from "./odds";

// Mulberry32 PRNG — deterministic so the demo always looks the same.
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SPORT_POOL = [
  { sport: "NFL", league: "NFL", weight: 0.24 },
  { sport: "NBA", league: "NBA", weight: 0.26 },
  { sport: "MLB", league: "MLB", weight: 0.2 },
  { sport: "NHL", league: "NHL", weight: 0.12 },
  { sport: "Soccer", league: "EPL", weight: 0.08 },
  { sport: "UFC", league: "UFC", weight: 0.06 },
  { sport: "Tennis", league: "ATP", weight: 0.04 },
] as const;

const EVENTS: Record<string, string[]> = {
  NFL: [
    "Chiefs @ Bills", "Eagles @ Cowboys", "49ers @ Rams", "Ravens @ Bengals",
    "Lions @ Packers", "Dolphins @ Jets", "Texans @ Colts", "Steelers @ Browns",
  ],
  NBA: [
    "Celtics @ Knicks", "Nuggets @ Lakers", "Bucks @ 76ers", "Thunder @ Mavericks",
    "Warriors @ Suns", "Heat @ Magic", "Timberwolves @ Clippers", "Cavaliers @ Pacers",
  ],
  MLB: [
    "Yankees @ Red Sox", "Dodgers @ Padres", "Braves @ Phillies", "Astros @ Rangers",
    "Cubs @ Cardinals", "Orioles @ Rays", "Mariners @ Angels", "Mets @ Nationals",
  ],
  NHL: [
    "Oilers @ Avalanche", "Rangers @ Devils", "Maple Leafs @ Bruins", "Stars @ Jets",
    "Panthers @ Lightning", "Golden Knights @ Kings",
  ],
  Soccer: [
    "Arsenal vs Liverpool", "Man City vs Chelsea", "Spurs vs Man United",
    "Newcastle vs Brighton", "Aston Villa vs West Ham",
  ],
  UFC: [
    "Makhachev vs Tsarukyan", "Pereira vs Ankalaev", "Jones vs Aspinall",
    "O'Malley vs Dvalishvili",
  ],
  Tennis: [
    "Alcaraz vs Sinner", "Djokovic vs Zverev", "Medvedev vs Rune", "Fritz vs Tiafoe",
  ],
};

const SELECTIONS: Record<string, (rng: () => number, event: string) => { market: Bet["market"]; betType: Bet["betType"]; selection: string }> = {
  default: (rng, event) => {
    const r = rng();
    const teams = event.split(/ @ | vs /);
    const team = teams[Math.floor(rng() * teams.length)];
    if (r < 0.3) return { market: "Spread", betType: "Straight", selection: `${team} ${rng() < 0.5 ? "-" : "+"}${(Math.floor(rng() * 9) + 1) * 0.5 + 1}` };
    if (r < 0.5) return { market: "Moneyline", betType: "Straight", selection: `${team} ML` };
    if (r < 0.68) return { market: "Total", betType: "Straight", selection: `${rng() < 0.5 ? "Over" : "Under"} ${Math.floor(rng() * 40) + 38}.5` };
    if (r < 0.86) return { market: "Player Prop", betType: "Prop", selection: `${team} star player Over ${Math.floor(rng() * 20) + 15}.5 pts` };
    if (r < 0.94) return { market: "Parlay", betType: "Parlay", selection: `3-leg parlay (${team} +2 more)` };
    return { market: "Same Game Parlay", betType: "Same Game Parlay", selection: `SGP: ${team} ML + Over + prop` };
  },
};

function pickSport(rng: () => number) {
  const r = rng();
  let acc = 0;
  for (const s of SPORT_POOL) {
    acc += s.weight;
    if (r < acc) return s;
  }
  return SPORT_POOL[0];
}

function pickOdds(rng: () => number, market: string): number {
  if (market === "Parlay") return Math.floor(rng() * 450) + 250; // +250 to +700
  if (market === "Same Game Parlay") return Math.floor(rng() * 600) + 300;
  if (market === "Player Prop") {
    const r = rng();
    return r < 0.6 ? -(Math.floor(rng() * 40) + 105) : Math.floor(rng() * 60) + 100;
  }
  const r = rng();
  if (r < 0.55) return -(Math.floor(rng() * 60) + 105); // -105 to -165
  if (r < 0.85) return Math.floor(rng() * 80) + 100; // +100 to +180
  return Math.floor(rng() * 150) + 180; // +180 to +330
}

export function generateDemoData(): {
  bets: Bet[];
  reviews: BetReview[];
  promotions: Promotion[];
  recommendations: Recommendation[];
} {
  const rng = mulberry32(20260611);
  const bets: Bet[] = [];
  const reviews: BetReview[] = [];
  const today = new Date("2026-06-11T00:00:00Z");
  const N = 96;

  for (let i = 0; i < N; i++) {
    // Spread bets over the last ~100 days, oldest first
    const daysAgo = Math.floor((1 - i / N) * 100);
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - daysAgo);
    const date = d.toISOString().slice(0, 10);

    const sp = pickSport(rng);
    const event = EVENTS[sp.sport][Math.floor(rng() * EVENTS[sp.sport].length)];
    const sel = SELECTIONS.default(rng, event);
    const odds = pickOdds(rng, sel.market);
    const sportsbook = rng() < 0.55 ? "FanDuel" : "DraftKings";

    const usePromo = rng() < 0.18;
    const promoType = !usePromo
      ? "None"
      : rng() < 0.4
        ? "Profit Boost"
        : rng() < 0.65
          ? "Bonus Bet"
          : "No Sweat Bet";

    const stake =
      promoType === "Bonus Bet"
        ? [10, 25, 50][Math.floor(rng() * 3)]
        : Math.round(([0.5, 1, 1, 1, 1.5, 2, 2.5][Math.floor(rng() * 7)]) * 10 * 100) / 100;

    // True prob: small skill edge baked in (~1.5 points avg), parlays none
    const implied = odds > 0 ? 100 / (odds + 100) : Math.abs(odds) / (Math.abs(odds) + 100);
    const skill = sel.betType === "Parlay" || sel.betType === "Same Game Parlay"
      ? -0.01
      : 0.012 + (rng() - 0.4) * 0.03;
    const trueProb = Math.max(0.03, Math.min(0.92, implied + skill));

    const pending = daysAgo <= 1 && rng() < 0.7;
    let status: Bet["status"] = "pending";
    if (!pending) {
      const r = rng();
      if (r < trueProb) status = "win";
      else if (r < trueProb + 0.035) status = "push";
      else status = "loss";
    }

    // Closing line: your edge partially gets priced in by close
    let closingLine: number | null = null;
    if (!pending && rng() < 0.85) {
      const clvNoise = (rng() - 0.42) * 0.035 + skill * 0.5;
      const closeImplied = Math.max(0.05, Math.min(0.95, implied + clvNoise));
      const closeDec = 1 / closeImplied;
      closingLine = closeDec >= 2
        ? Math.round((closeDec - 1) * 100)
        : Math.round(-100 / (closeDec - 1));
    }

    const confidence = Math.round((4 + rng() * 5) * 10) / 10;
    const id = `demo-${i.toString().padStart(3, "0")}`;

    bets.push({
      id,
      date,
      sport: sp.sport,
      league: sp.league,
      event,
      sportsbook,
      betType: sel.betType,
      market: sel.market,
      selection: sel.selection,
      odds,
      stake,
      potentialPayout: Math.round(totalPayout(odds, stake) * 100) / 100,
      promotionUsed: usePromo,
      promotionType: promoType,
      confidenceScore: confidence,
      finalBetScore: Math.round(48 + confidence * 4 + (skill > 0 ? 8 : -4) + rng() * 8),
      estTrueProb: Math.round(trueProb * 1000) / 1000,
      closingLine,
      status,
      cashoutAmount: null,
      notes: "",
      createdAt: date + "T12:00:00.000Z",
    });

    // ~60% of settled bets reviewed; good process correlates with skill
    if (!pending && (status === "win" || status === "loss") && rng() < 0.6) {
      const goodProcess = skill > 0 ? rng() < 0.82 : rng() < 0.35;
      reviews.push({
        betId: id,
        answer: goodProcess ? "yes" : rng() < 0.8 ? "no" : "unsure",
        note: goodProcess
          ? "Had a clear read and beat the number I needed."
          : "Chased the line / bet without doing the full checklist.",
        reviewedAt: date + "T20:00:00.000Z",
      });
    }
  }

  const promotions: Promotion[] = [
    {
      id: "promo-1",
      sportsbook: "FanDuel",
      promoType: "Profit Boost",
      description: "30% Profit Boost — any NBA Finals market",
      boostPct: 30,
      maxStake: 50,
      minOdds: null,
      expiration: "2026-06-14",
      eligibleMarkets: "NBA Finals, all markets",
      status: "active",
      createdAt: "2026-06-09T12:00:00.000Z",
    },
    {
      id: "promo-2",
      sportsbook: "DraftKings",
      promoType: "No Sweat Bet",
      description: "No Sweat Bet up to $25 — MLB same game parlay",
      boostPct: null,
      maxStake: 25,
      minOdds: 200,
      expiration: "2026-06-12",
      eligibleMarkets: "MLB SGP, min +200",
      status: "active",
      createdAt: "2026-06-10T12:00:00.000Z",
    },
    {
      id: "promo-3",
      sportsbook: "FanDuel",
      promoType: "Bonus Bet",
      description: "$25 Bonus Bet from referral reward",
      boostPct: null,
      maxStake: 25,
      minOdds: null,
      expiration: "2026-06-20",
      eligibleMarkets: "Any market",
      status: "active",
      createdAt: "2026-06-08T12:00:00.000Z",
    },
  ];

  const recommendations: Recommendation[] = [
    {
      id: "rec-1",
      createdAt: "2026-06-10T16:00:00.000Z",
      sport: "NBA",
      event: "Thunder @ Pacers",
      sportsbook: "FanDuel",
      market: "Spread",
      betType: "Straight",
      selection: "Pacers +6.5",
      odds: -108,
      scores: {
        statisticalEdge: 7.4, marketValue: 7.1, situationalEdge: 7.5,
        marketIntelligence: 7, risk: 3.5, promotionValue: 5, confidence: 7.5,
      },
      finalScore: 74,
      verdict: "BET",
      stakeRec: 22.5,
      unitsRec: 2.25,
      estTrueProb: 0.56,
      impliedProb: 51.9,
      edgePct: 4.1,
      evPct: 7.9,
      clvProjection: 2.6,
      factors: [
        "Home dog in a series the market is overreacting to",
        "Rest advantage with two days off",
        "Reverse line movement toward Indiana",
      ],
      risks: ["Star usage uncertainty in a potential blowout"],
      summary:
        "Market is overweighting the road favorite's last game. Number should close shorter.",
      status: "active",
    },
    {
      id: "rec-2",
      createdAt: "2026-06-10T17:30:00.000Z",
      sport: "MLB",
      event: "Dodgers @ Padres",
      sportsbook: "DraftKings",
      market: "Total",
      betType: "Straight",
      selection: "Under 8.5",
      odds: -105,
      scores: {
        statisticalEdge: 6.8, marketValue: 6.5, situationalEdge: 6.5,
        marketIntelligence: 6, risk: 3, promotionValue: 5, confidence: 7,
      },
      finalScore: 68,
      verdict: "LEAN",
      stakeRec: 12,
      unitsRec: 1.25,
      estTrueProb: 0.545,
      impliedProb: 51.2,
      edgePct: 3.3,
      evPct: 6.4,
      clvProjection: 1.9,
      factors: [
        "Both starters' xERA beats season ERA meaningfully",
        "Marine layer night game, wind in",
        "Plate umpire is a strong pitcher's ump",
      ],
      risks: ["Bullpens are both bottom-10 in fatigue-adjusted xFIP this week"],
      summary:
        "Pitching matchup and conditions both point under; the number opened too high.",
      status: "active",
    },
  ];

  return { bets, reviews, promotions, recommendations };
}
