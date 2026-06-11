"use client";

// ── App-wide data store ───────────────────────────────────────────────
// Local Mode: persists to localStorage (zero setup).
// Cloud Mode: persists to Supabase/Postgres when env keys are present.

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Bet,
  BetReview,
  DB,
  DEFAULT_SETTINGS,
  EMPTY_DB,
  Promotion,
  Recommendation,
  Settings,
} from "./types";
import { generateDemoData } from "./demo-data";
import { getSupabase, supabaseConfigured } from "./supabase";

const LS_KEY = "beat-the-book:db:v1";

// ── Supabase row mapping (snake_case ↔ camelCase) ─────────────────────
const betToRow = (b: Bet) => ({
  id: b.id, date: b.date, sport: b.sport, league: b.league, event: b.event,
  sportsbook: b.sportsbook, bet_type: b.betType, market: b.market,
  selection: b.selection, odds: b.odds, stake: b.stake,
  potential_payout: b.potentialPayout, promotion_used: b.promotionUsed,
  promotion_type: b.promotionType, confidence_score: b.confidenceScore,
  final_bet_score: b.finalBetScore, est_true_prob: b.estTrueProb,
  closing_line: b.closingLine, status: b.status,
  cashout_amount: b.cashoutAmount, notes: b.notes, created_at: b.createdAt,
});
const rowToBet = (r: any): Bet => ({
  id: r.id, date: r.date, sport: r.sport, league: r.league, event: r.event,
  sportsbook: r.sportsbook, betType: r.bet_type, market: r.market,
  selection: r.selection, odds: r.odds, stake: Number(r.stake),
  potentialPayout: Number(r.potential_payout),
  promotionUsed: r.promotion_used, promotionType: r.promotion_type,
  confidenceScore: r.confidence_score == null ? null : Number(r.confidence_score),
  finalBetScore: r.final_bet_score == null ? null : Number(r.final_bet_score),
  estTrueProb: r.est_true_prob == null ? null : Number(r.est_true_prob),
  closingLine: r.closing_line, status: r.status,
  cashoutAmount: r.cashout_amount == null ? null : Number(r.cashout_amount),
  notes: r.notes ?? "", createdAt: r.created_at,
});
const promoToRow = (p: Promotion) => ({
  id: p.id, sportsbook: p.sportsbook, promo_type: p.promoType,
  description: p.description, boost_pct: p.boostPct, max_stake: p.maxStake,
  min_odds: p.minOdds, expiration: p.expiration,
  eligible_markets: p.eligibleMarkets, status: p.status, created_at: p.createdAt,
});
const rowToPromo = (r: any): Promotion => ({
  id: r.id, sportsbook: r.sportsbook, promoType: r.promo_type,
  description: r.description, boostPct: r.boost_pct == null ? null : Number(r.boost_pct),
  maxStake: r.max_stake == null ? null : Number(r.max_stake),
  minOdds: r.min_odds, expiration: r.expiration,
  eligibleMarkets: r.eligible_markets, status: r.status, createdAt: r.created_at,
});
const recToRow = (x: Recommendation) => ({
  id: x.id, created_at: x.createdAt, sport: x.sport, event: x.event,
  sportsbook: x.sportsbook, market: x.market, bet_type: x.betType,
  selection: x.selection, odds: x.odds, scores: x.scores,
  final_score: x.finalScore, verdict: x.verdict, stake_rec: x.stakeRec,
  units_rec: x.unitsRec, est_true_prob: x.estTrueProb,
  implied_prob: x.impliedProb, edge_pct: x.edgePct, ev_pct: x.evPct,
  clv_projection: x.clvProjection, factors: x.factors, risks: x.risks,
  summary: x.summary, status: x.status,
});
const rowToRec = (r: any): Recommendation => ({
  id: r.id, createdAt: r.created_at, sport: r.sport, event: r.event,
  sportsbook: r.sportsbook, market: r.market, betType: r.bet_type,
  selection: r.selection, odds: r.odds, scores: r.scores,
  finalScore: Number(r.final_score), verdict: r.verdict,
  stakeRec: Number(r.stake_rec), unitsRec: Number(r.units_rec),
  estTrueProb: Number(r.est_true_prob), impliedProb: Number(r.implied_prob),
  edgePct: Number(r.edge_pct), evPct: Number(r.ev_pct),
  clvProjection: Number(r.clv_projection), factors: r.factors ?? [],
  risks: r.risks ?? [], summary: r.summary ?? "", status: r.status,
});
const reviewToRow = (r: BetReview) => ({
  bet_id: r.betId, answer: r.answer, note: r.note, reviewed_at: r.reviewedAt,
});
const rowToReview = (r: any): BetReview => ({
  betId: r.bet_id, answer: r.answer, note: r.note ?? "", reviewedAt: r.reviewed_at,
});

interface StoreApi {
  db: DB;
  ready: boolean;
  cloudMode: boolean;
  upsertBet: (b: Bet) => void;
  deleteBet: (id: string) => void;
  upsertReview: (r: BetReview) => void;
  upsertPromotion: (p: Promotion) => void;
  deletePromotion: (id: string) => void;
  upsertRecommendation: (r: Recommendation) => void;
  deleteRecommendation: (id: string) => void;
  saveSettings: (s: Settings) => void;
  loadDemoData: () => void;
  clearAllData: () => void;
}

const StoreContext = createContext<StoreApi | null>(null);

function loadLocal(): DB {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return EMPTY_DB;
    const parsed = JSON.parse(raw);
    return {
      ...EMPTY_DB,
      ...parsed,
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
    };
  } catch {
    return EMPTY_DB;
  }
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [db, setDb] = useState<DB>(EMPTY_DB);
  const [ready, setReady] = useState(false);
  const cloudMode = supabaseConfigured();
  const dbRef = useRef(db);
  dbRef.current = db;

  // Initial load
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (cloudMode) {
        const sb = getSupabase()!;
        try {
          const [bets, reviews, promos, recs, settings] = await Promise.all([
            sb.from("bets").select("*"),
            sb.from("bet_reviews").select("*"),
            sb.from("promotions").select("*"),
            sb.from("recommendations").select("*"),
            sb.from("settings").select("*").eq("id", 1).maybeSingle(),
          ]);
          if (cancelled) return;
          setDb({
            bets: (bets.data ?? []).map(rowToBet),
            reviews: (reviews.data ?? []).map(rowToReview),
            promotions: (promos.data ?? []).map(rowToPromo),
            recommendations: (recs.data ?? []).map(rowToRec),
            settings: {
              ...DEFAULT_SETTINGS,
              ...((settings.data?.data as Partial<Settings>) ?? {}),
            },
          });
        } catch {
          if (!cancelled) setDb(loadLocal()); // graceful fallback
        }
      } else {
        setDb(loadLocal());
      }
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [cloudMode]);

  // Persist locally on every change (also a cache in cloud mode)
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(db));
    } catch {
      // storage full or unavailable — keep working in memory
    }
  }, [db, ready]);

  // Apply theme
  useEffect(() => {
    if (!ready) return;
    const root = document.documentElement;
    root.classList.toggle("light", db.settings.theme === "light");
    root.classList.toggle("dark", db.settings.theme !== "light");
  }, [db.settings.theme, ready]);

  const sb = cloudMode ? getSupabase() : null;
  const fireAndForget = (p: PromiseLike<unknown> | undefined) => {
    void Promise.resolve(p).catch(() => {});
  };

  const upsertBet = useCallback((b: Bet) => {
    setDb((d) => ({
      ...d,
      bets: [...d.bets.filter((x) => x.id !== b.id), b],
    }));
    if (sb) fireAndForget(sb.from("bets").upsert(betToRow(b)));
  }, [sb]);

  const deleteBet = useCallback((id: string) => {
    setDb((d) => ({
      ...d,
      bets: d.bets.filter((x) => x.id !== id),
      reviews: d.reviews.filter((r) => r.betId !== id),
    }));
    if (sb) fireAndForget(sb.from("bets").delete().eq("id", id));
  }, [sb]);

  const upsertReview = useCallback((r: BetReview) => {
    setDb((d) => ({
      ...d,
      reviews: [...d.reviews.filter((x) => x.betId !== r.betId), r],
    }));
    if (sb) fireAndForget(sb.from("bet_reviews").upsert(reviewToRow(r)));
  }, [sb]);

  const upsertPromotion = useCallback((p: Promotion) => {
    setDb((d) => ({
      ...d,
      promotions: [...d.promotions.filter((x) => x.id !== p.id), p],
    }));
    if (sb) fireAndForget(sb.from("promotions").upsert(promoToRow(p)));
  }, [sb]);

  const deletePromotion = useCallback((id: string) => {
    setDb((d) => ({
      ...d,
      promotions: d.promotions.filter((x) => x.id !== id),
    }));
    if (sb) fireAndForget(sb.from("promotions").delete().eq("id", id));
  }, [sb]);

  const upsertRecommendation = useCallback((r: Recommendation) => {
    setDb((d) => ({
      ...d,
      recommendations: [
        ...d.recommendations.filter((x) => x.id !== r.id),
        r,
      ],
    }));
    if (sb) fireAndForget(sb.from("recommendations").upsert(recToRow(r)));
  }, [sb]);

  const deleteRecommendation = useCallback((id: string) => {
    setDb((d) => ({
      ...d,
      recommendations: d.recommendations.filter((x) => x.id !== id),
    }));
    if (sb) fireAndForget(sb.from("recommendations").delete().eq("id", id));
  }, [sb]);

  const saveSettings = useCallback((s: Settings) => {
    setDb((d) => ({ ...d, settings: s }));
    if (sb) fireAndForget(sb.from("settings").upsert({ id: 1, data: s }));
  }, [sb]);

  const loadDemoData = useCallback(() => {
    const demo = generateDemoData();
    setDb((d) => ({ ...d, ...demo }));
    if (sb) {
      fireAndForget(sb.from("bets").upsert(demo.bets.map(betToRow)));
      fireAndForget(sb.from("bet_reviews").upsert(demo.reviews.map(reviewToRow)));
      fireAndForget(sb.from("promotions").upsert(demo.promotions.map(promoToRow)));
      fireAndForget(sb.from("recommendations").upsert(demo.recommendations.map(recToRow)));
    }
  }, [sb]);

  const clearAllData = useCallback(() => {
    setDb((d) => ({ ...EMPTY_DB, settings: d.settings }));
    if (sb) {
      fireAndForget(sb.from("bets").delete().neq("id", ""));
      fireAndForget(sb.from("bet_reviews").delete().neq("bet_id", ""));
      fireAndForget(sb.from("promotions").delete().neq("id", ""));
      fireAndForget(sb.from("recommendations").delete().neq("id", ""));
    }
  }, [sb]);

  return (
    <StoreContext.Provider
      value={{
        db,
        ready,
        cloudMode,
        upsertBet,
        deleteBet,
        upsertReview,
        upsertPromotion,
        deletePromotion,
        upsertRecommendation,
        deleteRecommendation,
        saveSettings,
        loadDemoData,
        clearAllData,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore(): StoreApi {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside <StoreProvider>");
  return ctx;
}
