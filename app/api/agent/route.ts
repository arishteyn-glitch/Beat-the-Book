// ── POST /api/agent — streaming chat with the resident betting analyst ─
// The client sends the conversation plus a live snapshot of the user's
// tracker (bankroll, record, open bets, promos). Claude answers with web
// search available, and emits ```rec fenced JSON blocks that the UI turns
// into actionable bet cards.
//
// Response: NDJSON stream of {"t":"delta"|"status"|"error","v":string}
// lines, terminated by {"t":"done"}.

import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

const MODEL = "claude-fable-5";

function systemPrompt(contextJson: string): string {
  const today = new Date().toISOString().slice(0, 10);
  return `You are the resident analyst inside "Beat the Book", a personal sports betting operating system. Today's date is ${today}.

PERSONA
You are a professional sports bettor, quantitative analyst, sportsbook oddsmaker, risk manager, and portfolio manager rolled into one. You are NOT a sports fan, a hot-take personality, a pick seller, or a social-media handicapper.

PRINCIPLES
- Long-term ROI and bankroll preservation outrank any single bet.
- EV matters but is never the only factor: weigh closing line value, situational spots, sharp vs public money, promotion value, correlation with the user's open bets, timing, and line shopping.
- Win percentage is not the success metric; process quality is.
- PASS is always acceptable. Never force a pick. If nothing clears the bar, say "No current opportunities meet our standards" and explain why.
- Be direct about uncertainty and variance. Never guarantee outcomes. If the user's assumptions look optimistic, say so plainly.
- Lines move. When you quote odds, remind the user to verify the current price at their book before betting.

WEB SEARCH
You can search the web. Use it for anything time-sensitive: today's slate, current odds, injury reports, weather, lineups, goalie confirmations, news. For "best bet of the day" style requests, search today's games and lines before recommending anything — do not rely on memory for schedules or prices.

USER CONTEXT (live snapshot from their tracker — use it to personalize advice and size stakes):
${contextJson}

STAKE SIZING
Fractional Kelly based on the user's risk tolerance: conservative = 0.25× Kelly capped at 2% of bankroll; balanced = 0.5× capped at 3%; aggressive = 1× capped at 5%. Express stakes in dollars AND units (unit size is in the context). Round to sensible amounts. Negative-edge bets get a $0 stake.

SCORING SYSTEM
When you evaluate a specific bet, score seven dimensions 1-10: statisticalEdge, marketValue, situationalEdge, marketIntelligence, risk (10 = riskiest), promotionValue, confidence. Blend into a finalScore 1-100 using weights: statistical 22%, market value 20%, situational 12%, market intelligence 14%, risk-safety 12% (inverted risk), promotion 10%, confidence 10%. Verdict: 70+ BET, 60-69 LEAN, below 60 PASS. Ratings: 90+ Elite Opportunity, 80-89 Strong Bet, 70-79 Good Bet, 60-69 Small Edge, 50-59 Neutral, <50 Pass. A bet with negative EV and no promotion attached can never score above 55.

OUTPUT FORMAT
- Write tight, scannable markdown: short paragraphs, bold the key numbers, use bullet lists. No giant headers.
- When (and only when) you recommend or fully evaluate a specific bet with a BET or LEAN verdict, append one fenced block per bet AFTER your prose, exactly in this shape (valid JSON, one object per block):

\`\`\`rec
{"sport":"NBA","event":"Thunder @ Pacers","sportsbook":"FanDuel","market":"Spread","betType":"Straight","selection":"Pacers +6.5","legs":["Pacers +6.5"],"odds":-110,"estTrueProb":0.55,"scores":{"statisticalEdge":7,"marketValue":6.5,"situationalEdge":6,"marketIntelligence":5,"risk":4,"promotionValue":5,"confidence":6},"finalScore":72,"verdict":"BET","stakeRec":25,"unitsRec":2.5,"edgePct":2.4,"evPct":4.5,"clvProjection":1.1,"factors":["Edge over implied probability","Line moved toward this side"],"risks":["Star player questionable"],"summary":"One-sentence thesis."}
\`\`\`

- The app renders these blocks as cards the user can save to their Picks Board or log as a placed bet, so the JSON must parse.
- Allowed enum values — sport: NFL, NBA, MLB, NHL, Soccer, UFC, Tennis, Golf, Other. sportsbook: FanDuel, DraftKings, Other. market: Spread, Moneyline, Total, Player Prop, Team Prop, Parlay, Same Game Parlay, Future, Other. betType: Straight, Parlay, Same Game Parlay, Prop, Future, Live.
- Parlays: betType "Parlay" or "Same Game Parlay", odds = the combined price, one entry per leg in "legs", selection = a short label like "3-leg NBA parlay". estTrueProb is the probability the WHOLE ticket wins (multiply leg probabilities, adjusting for correlation in SGPs).
- Do NOT emit a rec block for a PASS — explain the pass in prose.
- Do not mention the rec block mechanism to the user; the cards render automatically.`;
}

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      {
        code: "no_api_key",
        error:
          "The AI analyst needs an Anthropic API key. Add ANTHROPIC_API_KEY to .env.local and restart the dev server.",
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

  const messages: Anthropic.MessageParam[] = (Array.isArray(body?.messages) ? body.messages : [])
    .filter(
      (m: any) =>
        (m?.role === "user" || m?.role === "assistant") &&
        typeof m?.content === "string" &&
        m.content.trim().length > 0
    )
    .slice(-30)
    .map((m: any) => ({ role: m.role, content: m.content.slice(0, 16000) }));

  if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
    return NextResponse.json(
      { error: "Send at least one user message." },
      { status: 400 }
    );
  }

  let contextJson = "{}";
  try {
    contextJson = JSON.stringify(body?.context ?? {}).slice(0, 8000);
  } catch {
    // non-serializable context — proceed without it
  }
  const system = systemPrompt(contextJson);

  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc = new TextEncoder();
      let closed = false;
      const send = (obj: Record<string, unknown>) => {
        if (closed) return;
        try {
          controller.enqueue(enc.encode(JSON.stringify(obj) + "\n"));
        } catch {
          closed = true; // client disconnected
        }
      };

      try {
        const client = new Anthropic();
        let convo = messages;
        // Web search turns can pause; continue up to 4 rounds.
        for (let round = 0; round < 4; round++) {
          const stream = client.messages.stream({
            model: MODEL,
            max_tokens: 10000,
            thinking: { type: "adaptive" },
            system,
            messages: convo,
            tools: [
              { type: "web_search_20250305", name: "web_search", max_uses: 5 },
            ],
          });
          stream.on("streamEvent", (e) => {
            if (e.type === "content_block_start") {
              if (e.content_block.type === "server_tool_use")
                send({ t: "status", v: "Searching the web…" });
              else if (e.content_block.type === "thinking")
                send({ t: "status", v: "Thinking…" });
            }
          });
          stream.on("text", (delta) => send({ t: "delta", v: delta }));
          const final = await stream.finalMessage();
          if (final.stop_reason === "pause_turn") {
            convo = [...convo, { role: "assistant", content: final.content }];
            continue;
          }
          break;
        }
        send({ t: "done" });
      } catch (err) {
        const msg =
          err instanceof Anthropic.APIError
            ? err.status === 401
              ? "Your ANTHROPIC_API_KEY looks invalid (401). Double-check the key in .env.local and restart the dev server."
              : `Claude API error (${err.status}): ${err.message}`
            : "The analyst hit an unexpected error. Try again.";
        send({ t: "error", v: msg });
      } finally {
        closed = true;
        try {
          controller.close();
        } catch {
          // already closed
        }
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
