// ── Core domain types for Beat the Book ──────────────────────────────

export type Sport =
  | "NFL"
  | "NBA"
  | "MLB"
  | "NHL"
  | "Soccer"
  | "UFC"
  | "Tennis"
  | "Golf"
  | "Other";

export const SPORTS: Sport[] = [
  "NFL",
  "NBA",
  "MLB",
  "NHL",
  "Soccer",
  "UFC",
  "Tennis",
  "Golf",
  "Other",
];

export type Sportsbook = "FanDuel" | "DraftKings" | "Other";
export const SPORTSBOOKS: Sportsbook[] = ["FanDuel", "DraftKings", "Other"];

export type BetType =
  | "Straight"
  | "Parlay"
  | "Same Game Parlay"
  | "Prop"
  | "Future"
  | "Live";

export const BET_TYPES: BetType[] = [
  "Straight",
  "Parlay",
  "Same Game Parlay",
  "Prop",
  "Future",
  "Live",
];

export type Market =
  | "Spread"
  | "Moneyline"
  | "Total"
  | "Player Prop"
  | "Team Prop"
  | "Parlay"
  | "Same Game Parlay"
  | "Future"
  | "Other";

export const MARKETS: Market[] = [
  "Spread",
  "Moneyline",
  "Total",
  "Player Prop",
  "Team Prop",
  "Parlay",
  "Same Game Parlay",
  "Future",
  "Other",
];

export type BetStatus = "pending" | "win" | "loss" | "push" | "cashout" | "void";
export const BET_STATUSES: BetStatus[] = [
  "pending",
  "win",
  "loss",
  "push",
  "cashout",
  "void",
];

export type PromoType =
  | "None"
  | "Profit Boost"
  | "Odds Boost"
  | "Bonus Bet"
  | "No Sweat Bet"
  | "SGP Boost"
  | "Parlay Boost"
  | "Deposit Match"
  | "Insurance"
  | "Token"
  | "VIP";

export const PROMO_TYPES: PromoType[] = [
  "None",
  "Profit Boost",
  "Odds Boost",
  "Bonus Bet",
  "No Sweat Bet",
  "SGP Boost",
  "Parlay Boost",
  "Deposit Match",
  "Insurance",
  "Token",
  "VIP",
];

export interface Bet {
  id: string;
  date: string; // ISO date the bet was placed
  sport: Sport;
  league: string;
  event: string;
  sportsbook: Sportsbook;
  betType: BetType;
  market: Market;
  selection: string;
  odds: number; // American odds at time of bet
  stake: number; // dollars
  potentialPayout: number; // total return incl. stake (0 stake risk for bonus bets)
  promotionUsed: boolean;
  promotionType: PromoType;
  confidenceScore: number | null; // 1-10
  finalBetScore: number | null; // 1-100
  estTrueProb: number | null; // 0-1, bettor's estimate
  closingLine: number | null; // American odds at close
  status: BetStatus;
  cashoutAmount: number | null; // total amount received on cashout
  notes: string;
  createdAt: string;
}

export interface BetReview {
  betId: string;
  answer: "yes" | "no" | "unsure"; // would you place it again?
  note: string;
  reviewedAt: string;
}

export interface Promotion {
  id: string;
  sportsbook: Sportsbook;
  promoType: PromoType;
  description: string;
  boostPct: number | null; // for boosts, e.g. 30 = +30%
  maxStake: number | null;
  minOdds: number | null; // American
  expiration: string | null; // ISO date
  eligibleMarkets: string;
  status: "active" | "used" | "expired";
  createdAt: string;
}

export interface Recommendation {
  id: string;
  createdAt: string;
  sport: Sport;
  event: string;
  sportsbook: Sportsbook;
  market: Market;
  betType: BetType;
  selection: string;
  odds: number;
  scores: AgentScores;
  finalScore: number; // 1-100
  verdict: "BET" | "LEAN" | "PASS";
  stakeRec: number;
  unitsRec: number;
  estTrueProb: number;
  impliedProb: number;
  edgePct: number;
  evPct: number;
  clvProjection: number;
  factors: string[];
  risks: string[];
  summary: string;
  status: "active" | "dismissed" | "placed";
}

export interface AgentScores {
  statisticalEdge: number; // 1-10
  marketValue: number; // 1-10
  situationalEdge: number; // 1-10
  marketIntelligence: number; // 1-10
  risk: number; // 1-10, higher = riskier
  promotionValue: number; // 1-10
  confidence: number; // 1-10
}

export type RiskTolerance = "conservative" | "balanced" | "aggressive";
export type StakeMethod = "flat" | "kelly" | "percent";

export interface Settings {
  startingBankroll: number;
  unitSize: number;
  riskTolerance: RiskTolerance;
  preferredSports: Sport[];
  preferredSportsbook: Sportsbook;
  stakeMethod: StakeMethod;
  theme: "dark" | "light";
  currency: string; // ISO code, e.g. "USD"
}

export const DEFAULT_SETTINGS: Settings = {
  startingBankroll: 1000,
  unitSize: 10,
  riskTolerance: "balanced",
  preferredSports: ["NFL", "NBA"],
  preferredSportsbook: "FanDuel",
  stakeMethod: "flat",
  theme: "dark",
  currency: "USD",
};

export interface DB {
  bets: Bet[];
  reviews: BetReview[];
  promotions: Promotion[];
  recommendations: Recommendation[];
  settings: Settings;
}

export const EMPTY_DB: DB = {
  bets: [],
  reviews: [],
  promotions: [],
  recommendations: [],
  settings: DEFAULT_SETTINGS,
};
