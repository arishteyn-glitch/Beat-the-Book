// ── POST /api/extract — bet slip screenshot → structured bet data ─────
// Vision extraction for FanDuel / DraftKings slips using structured
// outputs, so the response is guaranteed to match the schema.

import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

const ALLOWED_MEDIA = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

const EXTRACTION_SCHEMA = {
  type: "object" as const,
  additionalProperties: false,
  required: ["bets", "confidence", "sportsbookDetected"],
  properties: {
    confidence: {
      type: "integer",
      description:
        "Overall extraction confidence from 0 to 100. Below 90 means a human must review. Consider image clarity, cropped fields, and ambiguous text.",
    },
    sportsbookDetected: {
      type: "string",
      enum: ["FanDuel", "DraftKings", "Other", "Unknown"],
      description: "Which sportsbook UI this screenshot is from.",
    },
    bets: {
      type: "array",
      description: "Every distinct wager visible on the slip. A parlay is ONE bet.",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "sportsbook", "sport", "league", "event", "betType", "market",
          "selection", "odds", "stake", "potentialPayout", "promotionUsed",
          "promotionType", "date", "status",
        ],
        properties: {
          sportsbook: { type: "string", enum: ["FanDuel", "DraftKings", "Other"] },
          sport: {
            type: "string",
            enum: ["NFL", "NBA", "MLB", "NHL", "Soccer", "UFC", "Tennis", "Golf", "Other"],
          },
          league: { type: "string", description: "League if visible, else empty string" },
          event: { type: "string", description: "Matchup, e.g. 'Chiefs @ Bills'. Empty if not visible." },
          betType: {
            type: "string",
            enum: ["Straight", "Parlay", "Same Game Parlay", "Prop", "Future", "Live"],
          },
          market: {
            type: "string",
            enum: ["Spread", "Moneyline", "Total", "Player Prop", "Team Prop", "Parlay", "Same Game Parlay", "Future", "Other"],
          },
          selection: { type: "string", description: "The pick, e.g. 'Bills -2.5' or 'SGP: 3 legs'" },
          odds: { type: "integer", description: "American odds as a signed integer, e.g. -110 or 250" },
          stake: { type: "number", description: "Wager amount in dollars. 0 if not visible." },
          potentialPayout: { type: "number", description: "Total potential payout in dollars. 0 if not visible." },
          promotionUsed: { type: "boolean" },
          promotionType: {
            type: "string",
            enum: ["None", "Profit Boost", "Odds Boost", "Bonus Bet", "No Sweat Bet", "SGP Boost", "Parlay Boost", "Deposit Match", "Insurance", "Token", "VIP"],
          },
          date: { type: "string", description: "Bet placement date as YYYY-MM-DD if visible, else empty string" },
          status: {
            type: "string",
            enum: ["pending", "win", "loss", "push", "cashout", "void"],
            description: "Settlement status if the slip shows one, else pending",
          },
        },
      },
    },
  },
};

const SYSTEM = `You extract structured wager data from sportsbook bet slip screenshots (FanDuel and DraftKings primarily).

Rules:
- A parlay or same-game parlay is ONE bet; summarize its legs in "selection" (e.g. "SGP 4 legs: Mahomes 2+ TD, Over 47.5, ...").
- Odds: convert any displayed format to American integer odds.
- "Bonus bet" / "No Sweat" / "Profit Boost" labels on the slip mean promotionUsed=true with the matching promotionType.
- Never invent values. If a field is not visible, use the documented empty/zero default and lower your confidence.
- Confidence below 90 when: blurry image, cropped fields, partial slip, unusual layout, or any guesswork.`;

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      {
        error:
          "AI extraction is not configured. Add ANTHROPIC_API_KEY to .env.local and restart the dev server — or add the bet manually below.",
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

  let { imageBase64, mediaType } = body ?? {};
  if (typeof imageBase64 !== "string" || !imageBase64) {
    return NextResponse.json({ error: "imageBase64 is required." }, { status: 400 });
  }
  // Accept data URLs and derive the media type from them
  const dataUrlMatch = imageBase64.match(/^data:(image\/[a-z+]+);base64,(.+)$/i);
  if (dataUrlMatch) {
    mediaType = dataUrlMatch[1].toLowerCase();
    imageBase64 = dataUrlMatch[2];
  }
  if (!ALLOWED_MEDIA.has(mediaType)) {
    return NextResponse.json(
      { error: `Unsupported image type "${mediaType}". Use PNG, JPEG, GIF, or WebP.` },
      { status: 400 }
    );
  }

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      system: SYSTEM,
      output_config: {
        format: {
          type: "json_schema",
          schema: EXTRACTION_SCHEMA,
        },
      },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType as "image/png" | "image/jpeg" | "image/gif" | "image/webp",
                data: imageBase64,
              },
            },
            {
              type: "text",
              text: "Extract every wager from this bet slip screenshot.",
            },
          ],
        },
      ],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { error: "Extraction returned unparseable output. Try a clearer screenshot." },
        { status: 502 }
      );
    }

    const confidence = Math.max(0, Math.min(100, Number(parsed.confidence) || 0));
    return NextResponse.json({
      confidence,
      needsReview: confidence < 90,
      sportsbookDetected: parsed.sportsbookDetected ?? "Unknown",
      bets: Array.isArray(parsed.bets) ? parsed.bets : [],
    });
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `Claude API error (${error.status}): ${error.message}` },
        { status: 502 }
      );
    }
    return NextResponse.json(
      { error: "Extraction failed unexpectedly." },
      { status: 500 }
    );
  }
}
