// ── POST /api/agent — Claude-powered qualitative bet analysis ─────────
// The deterministic scoring engine runs client-side; this route adds a
// professional analyst's qualitative read when ANTHROPIC_API_KEY is set.

import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

const SYSTEM = `You are the analysis engine inside "Beat the Book", a personal sports betting analytics platform.

You are: a professional sports bettor, quantitative analyst, sportsbook oddsmaker, risk manager, and portfolio manager.
You are NOT: a sports fan, a hot-take personality, a pick seller, or a social media handicapper.

Principles:
- Long-term ROI and bankroll preservation outrank any single bet.
- EV matters but is not the only factor: weigh closing line value, situational spots, sharp/public money signals, promotion value, correlation, and timing.
- Win percentage is not the success metric. Process quality is.
- It is always acceptable to say PASS. Never force a pick.
- Be direct about uncertainty. If the user's probability estimate looks optimistic, say so.

Respond in plain text (no markdown headers), under 220 words, structured as:
1) Read on the price (is there real value at these odds?)
2) The 2-3 factors that matter most here
3) What to verify before placing (injuries, line moves, weather, etc.)
4) Verdict: BET / LEAN / PASS with one-sentence justification and stake guidance in units.`;

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      {
        error:
          "AI analysis is not configured. Add ANTHROPIC_API_KEY to .env.local and restart the dev server. The built-in scoring engine still works without it.",
      },
      { status: 503 }
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const {
    sport, event, sportsbook, market, betType, selection,
    odds, estTrueProbPct, promoType, flags, notes,
  } = body ?? {};

  if (typeof odds !== "number" || !selection && !event) {
    return NextResponse.json(
      { error: "Provide at least odds and a selection or event." },
      { status: 400 }
    );
  }

  const flagList = Object.entries(flags ?? {})
    .filter(([, v]) => v)
    .map(([k]) => k)
    .join(", ") || "none reported";

  const prompt = `Analyze this candidate bet.

Sport: ${sport ?? "unknown"}
Event: ${event || "not specified"}
Sportsbook: ${sportsbook ?? "unknown"}
Market: ${market ?? "unknown"} (${betType ?? "Straight"})
Selection: ${selection || "not specified"}
Odds (American): ${odds}
Bettor's estimated true win probability: ${estTrueProbPct ?? "not provided"}%
Promotion applied: ${promoType ?? "None"}
Situational/market flags the bettor reports: ${flagList}
Bettor notes: ${notes || "none"}`;

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      system: SYSTEM,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    if (!text) {
      return NextResponse.json(
        { error: "The model returned no analysis. Try again." },
        { status: 502 }
      );
    }
    return NextResponse.json({ analysis: text });
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `Claude API error (${error.status}): ${error.message}` },
        { status: 502 }
      );
    }
    return NextResponse.json(
      { error: "AI analysis failed unexpectedly." },
      { status: 500 }
    );
  }
}
