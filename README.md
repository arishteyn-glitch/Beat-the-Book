# Beat the Book

A professional sports betting operating system — analytics platform, bankroll manager, promotion optimizer, performance tracker, and AI betting agent. Bloomberg Terminal meets a hedge fund dashboard, built for sports betting.

**The goal is not picking winners. It's becoming profitable long-term:** ROI, closing line value, decision quality, and bankroll preservation over win percentage.

## Features

| Page | What it does |
| --- | --- |
| **Dashboard** | Bankroll, P/L, ROI, units, CLV, win rate, equity curves, sport breakdowns, recent bets, AI plays, promo opportunities |
| **Bet Tracker** | Full CRUD for every wager — odds, stake, promos, confidence, closing line, CLV, notes. Filter / sort / search / duplicate |
| **Analytics** | ROI by sport, league, book, bet type, odds range, market, promo. CLV distribution and CLV-vs-results. Favorites vs dogs, home vs away, straights vs parlays |
| **AI Agent** | Seven-dimension scoring engine (statistical edge, market value, situational, market intelligence, risk, promo value, confidence) → Final Bet Score 1-100 → BET / LEAN / PASS. Per-sport analysis frameworks. Optional Claude-powered qualitative analysis |
| **Picks Board** | Only opportunities scoring 60+. No forced picks — "no opportunities meet our standards" is a valid state |
| **Promotion Optimizer** | EV calculators for FanDuel/DraftKings promos: profit boosts, bonus bets, no-sweat bets, deposit matches. Optimal stake, best use, alternatives |
| **Bankroll** | Kelly + flat staking recommendations, conservative/balanced/aggressive modes, drawdown, losing streaks, open exposure |
| **Bet Slip Importer** | Drop / paste FanDuel & DraftKings screenshots → AI extracts the bets (structured output + confidence score; <90% forces manual review) → one-click import |
| **Performance Review** | "Would you place this exact bet again knowing only what you knew then?" Good/bad wins and losses matrix, process score, decision quality. Process over outcomes |
| **Settings** | Bankroll, unit size, risk tolerance, preferred sports/book, staking method, theme, currency |

## Tech stack

Next.js 14 (App Router) · React 18 · TypeScript · Tailwind CSS · Recharts · Supabase (PostgreSQL) · Anthropic Claude API · Vitest

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000. The app starts in **Local Mode** — data is saved in your browser, zero configuration. Click **Load demo data** on the Dashboard to explore with a realistic 96-bet dataset.

### Optional: cloud database (Supabase)

1. Create a free project at [supabase.com](https://supabase.com)
2. Open the SQL editor and run [supabase/schema.sql](supabase/schema.sql)
3. Copy `.env.example` to `.env.local` and fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Restart the dev server — the topbar badge flips from "Local mode" to "Cloud sync"

### Optional: AI features (Claude)

Add `ANTHROPIC_API_KEY` to `.env.local` (get one at [console.anthropic.com](https://console.anthropic.com)) to enable:

- **AI Agent** — qualitative analysis from a professional-bettor persona on top of the built-in quant scoring engine
- **Bet Slip Importer** — vision extraction of FanDuel/DraftKings screenshots

Both degrade gracefully without a key: the scoring engine is fully local, and the importer falls back to manual entry.

## Tests

```bash
npm test
```

Covers the betting math: odds conversion, EV/edge, Kelly staking with caps, CLV, bonus-bet conversion, promo EV, settlement (including bonus-bet and cashout rules), drawdown/streaks, and the agent scoring engine's bankroll-preservation override.

## Philosophy

- A losing bet can be a great bet. A winning bet can be a terrible one.
- Positive EV is necessary but not sufficient — CLV, situational spots, sharp-money signals, promo value, correlation, and timing all matter.
- The bets you don't make are where long-term profit lives. Passing is a result.

---

*Bet with your head, not over it. If gambling stops being fun, call 1-800-GAMBLER.*
