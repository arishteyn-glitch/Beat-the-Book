"use client";

// ── AI Agent: chat with your resident betting analyst ─────────────────
// Free-form conversation: ask for the best bet of the day, paste a
// multi-leg parlay to get it scored, ask how to use a promo, or have it
// review your results. Replies stream in; concrete recommendations
// arrive as ```rec JSON blocks rendered into actionable cards.

import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { groupBy, overallStats, round2 } from "@/lib/stats";
import { fmtOdds, impliedProbability, totalPayout } from "@/lib/odds";
import { fmtMoney, todayISO, uid } from "@/lib/utils";
import {
  AgentScores,
  BET_TYPES,
  MARKETS,
  SPORTS,
  SPORTSBOOKS,
  type BetType,
  type Market,
  type Sport,
  type Sportsbook,
} from "@/lib/types";
import { emptyBet } from "@/components/bets/bet-form";
import {
  Badge,
  Button,
  Card,
  PageHeader,
  VerdictBadge,
} from "@/components/ui/primitives";
import {
  Bot,
  Check,
  ClipboardCheck,
  RotateCcw,
  Save,
  Send,
  Square,
} from "lucide-react";

const CHAT_KEY = "beat-the-book:agent-chat:v1";

interface ChatMsg {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
  status?: string | null;
  error?: "no_api_key" | "generic" | null;
}

type SavedMap = Record<string, { board?: boolean; bet?: boolean }>;

const SUGGESTIONS = [
  "What's the best bet of the day?",
  "Find me a strong NBA player prop tonight",
  "Score this parlay: Lakers ML + over 224.5, +260 on FanDuel, $20",
  "Review my results — where am I leaking money?",
  "I have a 30% profit boost (max $25) on FanDuel. Optimal use?",
];

export default function AgentPage() {
  const { db, ready, upsertRecommendation, upsertBet } = useStore();
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [savedMap, setSavedMap] = useState<SavedMap>({});
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Restore the conversation after reloads
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CHAT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.messages)) setMessages(parsed.messages);
        if (parsed.savedMap) setSavedMap(parsed.savedMap);
      }
    } catch {
      // corrupt cache — start fresh
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(
        CHAT_KEY,
        JSON.stringify({
          messages: messages.filter((m) => !m.streaming).slice(-60),
          savedMap,
        })
      );
    } catch {
      // storage full — keep chatting in memory
    }
  }, [messages, savedMap, loaded]);

  // Keep the newest message in view
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Auto-grow the composer
  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }, [input]);

  // Compact tracker snapshot so the analyst knows the user's situation
  const buildContext = () => {
    const s = overallStats(db.bets, db.settings);
    const bySport = groupBy(db.bets, (b) => b.sport, db.settings.unitSize);
    const st = db.settings;
    return {
      settings: {
        currency: st.currency,
        startingBankroll: st.startingBankroll,
        unitSize: st.unitSize,
        riskTolerance: st.riskTolerance,
        preferredSportsbook: st.preferredSportsbook,
        preferredSports: st.preferredSports,
      },
      bankroll: round2(s.currentBankroll),
      record: `${s.wins}-${s.losses}-${s.pushes}`,
      roiPct: round2(s.roi),
      netProfit: round2(s.profit),
      netUnits: round2(s.units),
      avgClvPct: s.avgClv == null ? null : round2(s.avgClv),
      openExposure: round2(s.openExposure),
      sportPerformance: bySport.slice(0, 8).map((g) => ({
        sport: g.key,
        bets: g.bets,
        profit: round2(g.profit),
        roiPct: round2(g.roi),
      })),
      openBets: db.bets
        .filter((b) => b.status === "pending")
        .slice(0, 20)
        .map((b) => ({
          sport: b.sport,
          event: b.event,
          selection: b.selection,
          odds: b.odds,
          stake: b.stake,
          sportsbook: b.sportsbook,
          betType: b.betType,
        })),
      activePromotions: db.promotions
        .filter((p) => p.status === "active")
        .slice(0, 10)
        .map((p) => ({
          sportsbook: p.sportsbook,
          type: p.promoType,
          description: p.description,
          boostPct: p.boostPct,
          maxStake: p.maxStake,
          minOdds: p.minOdds,
          expiration: p.expiration,
        })),
    };
  };

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    setInput("");
    const userMsg: ChatMsg = { id: uid(), role: "user", content: q };
    const asstId = uid();
    const history = [...messages, userMsg];
    setMessages([
      ...history,
      { id: asstId, role: "assistant", content: "", streaming: true, status: "Thinking…" },
    ]);
    setBusy(true);
    const ac = new AbortController();
    abortRef.current = ac;

    const patch = (fn: (m: ChatMsg) => ChatMsg) =>
      setMessages((cur) => cur.map((m) => (m.id === asstId ? fn(m) : m)));

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ac.signal,
        body: JSON.stringify({
          messages: history.slice(-24).map((m) => ({ role: m.role, content: m.content })),
          context: buildContext(),
        }),
      });

      if (!res.ok || !res.body) {
        let err = "The analyst is unavailable right now. Try again in a moment.";
        let code: ChatMsg["error"] = "generic";
        try {
          const data = await res.json();
          if (data?.error) err = data.error;
          if (data?.code === "no_api_key") code = "no_api_key";
        } catch {
          // non-JSON error body
        }
        patch((m) => ({ ...m, streaming: false, status: null, error: code, content: err }));
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          let ev: any;
          try {
            ev = JSON.parse(line);
          } catch {
            continue;
          }
          if (ev.t === "delta")
            patch((m) => ({ ...m, content: m.content + ev.v, status: null }));
          else if (ev.t === "status") patch((m) => ({ ...m, status: ev.v }));
          else if (ev.t === "error")
            patch((m) => ({
              ...m,
              streaming: false,
              status: null,
              error: m.content ? null : "generic",
              content: m.content || ev.v,
            }));
        }
      }
      patch((m) => ({
        ...m,
        streaming: false,
        status: null,
        content: m.content || "No response came back — try again.",
      }));
    } catch (e: any) {
      if (e?.name === "AbortError")
        patch((m) => ({
          ...m,
          streaming: false,
          status: null,
          content: (m.content || "").trimEnd() + "\n\n*(stopped)*",
        }));
      else
        patch((m) => ({
          ...m,
          streaming: false,
          status: null,
          error: "generic",
          content: "Network error — is the dev server still running?",
        }));
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  };

  const stop = () => abortRef.current?.abort();

  const newChat = () => {
    if (busy) return;
    setMessages([]);
    setSavedMap({});
    try {
      localStorage.removeItem(CHAT_KEY);
    } catch {
      // ignore
    }
  };

  const saveToBoard = (key: string, r: ParsedRec) => {
    upsertRecommendation({
      id: uid(),
      createdAt: new Date().toISOString(),
      sport: r.sport,
      event: r.event || "(event not specified)",
      sportsbook: r.sportsbook,
      market: r.market,
      betType: r.betType,
      selection: r.selection,
      odds: r.odds,
      scores: r.scores,
      finalScore: r.finalScore,
      verdict: r.verdict,
      stakeRec: r.stakeRec,
      unitsRec: r.unitsRec,
      estTrueProb: r.estTrueProb,
      impliedProb: Math.round(impliedProbability(r.odds) * 1000) / 10,
      edgePct: r.edgePct,
      evPct: r.evPct,
      clvProjection: r.clvProjection,
      factors: r.factors,
      risks: r.risks,
      summary: r.summary,
      status: "active",
    });
    setSavedMap((s) => ({ ...s, [key]: { ...s[key], board: true } }));
  };

  const logAsBet = (key: string, r: ParsedRec) => {
    const stake = r.stakeRec > 0 ? r.stakeRec : db.settings.unitSize;
    upsertBet(
      emptyBet({
        date: todayISO(),
        sport: r.sport,
        event: r.event,
        sportsbook: r.sportsbook,
        betType: r.betType,
        market: r.market,
        selection: r.legs.length > 1 ? r.legs.join(" + ") : r.selection,
        odds: r.odds,
        stake,
        potentialPayout: Math.round(totalPayout(r.odds, stake) * 100) / 100,
        estTrueProb: r.estTrueProb || null,
        confidenceScore: r.scores.confidence,
        finalBetScore: r.finalScore,
        notes: `From AI Agent chat (score ${r.finalScore}). ${r.summary}`.trim(),
      })
    );
    setSavedMap((s) => ({ ...s, [key]: { ...s[key], bet: true } }));
  };

  if (!ready) return null;
  const cur = db.settings.currency;

  return (
    <div className="flex h-[calc(100dvh-150px)] min-h-[440px] flex-col md:h-[calc(100dvh-130px)]">
      <PageHeader
        title="AI Agent"
        sub="Your betting analyst — ask anything: best bets today, parlay scoring, promo strategy, performance review."
        actions={
          <Button variant="outline" size="sm" onClick={newChat} disabled={busy || messages.length === 0}>
            <RotateCcw size={13} /> New chat
          </Button>
        }
      />

      <Card className="flex min-h-0 flex-1 flex-col">
        {/* Message thread */}
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto p-4">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center p-4 text-center">
              <Bot size={30} className="mb-3 text-blue-400" />
              <h2 className="text-sm font-semibold text-zinc-100">
                Talk to your betting analyst
              </h2>
              <p className="mt-2 max-w-md text-xs leading-relaxed text-muted">
                Ask for the best bets today, paste a parlay (any number of legs)
                to get it scored 1–100, ask how to use a promo, or have it review
                your results. It knows your bankroll, open bets, and active
                promotions — and it will say PASS when nothing clears the bar.
              </p>
              <div className="mt-4 flex max-w-xl flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="rounded-lg border border-border bg-panel-2 px-3 py-1.5 text-[12px] text-zinc-300 transition-colors hover:border-accent/50 hover:text-blue-400"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((m) =>
                m.role === "user" ? (
                  <div key={m.id} className="flex justify-end">
                    <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm border border-accent/25 bg-accent/15 px-3.5 py-2.5 text-[13px] leading-relaxed text-zinc-100">
                      {m.content}
                    </div>
                  </div>
                ) : (
                  <AssistantMessage
                    key={m.id}
                    msg={m}
                    cur={cur}
                    savedMap={savedMap}
                    onBoard={saveToBoard}
                    onBet={logAsBet}
                  />
                )
              )}
            </div>
          )}
        </div>

        {/* Composer */}
        <div className="border-t border-border p-3">
          <div className="flex items-end gap-2">
            <textarea
              ref={taRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              placeholder='Ask anything — "best NBA bet tonight?", "score this 4-leg parlay: …"'
              className="max-h-40 min-h-[42px] w-full resize-none rounded-lg border border-border bg-panel-2 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-muted/60 focus:border-accent/60 focus:outline-none focus:ring-1 focus:ring-accent/40"
            />
            {busy ? (
              <Button variant="outline" onClick={stop} title="Stop" className="shrink-0">
                <Square size={14} /> Stop
              </Button>
            ) : (
              <Button
                onClick={() => send(input)}
                disabled={!input.trim()}
                title="Send (Enter)"
                className="shrink-0"
              >
                <Send size={14} />
              </Button>
            )}
          </div>
          <p className="mt-1.5 text-[10.5px] text-muted">
            Enter to send · Shift+Enter for a new line · Lines move — always
            verify the live price at your book before betting.
          </p>
        </div>
      </Card>
    </div>
  );
}

// ── Assistant message: markdown + rec cards ───────────────────────────

function AssistantMessage({
  msg,
  cur,
  savedMap,
  onBoard,
  onBet,
}: {
  msg: ChatMsg;
  cur: string;
  savedMap: SavedMap;
  onBoard: (key: string, r: ParsedRec) => void;
  onBet: (key: string, r: ParsedRec) => void;
}) {
  const segs = useMemo(
    () => splitSegments(msg.content, !!msg.streaming),
    [msg.content, msg.streaming]
  );
  return (
    <div className="flex gap-2.5">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-accent/30 bg-accent/10">
        <Bot size={14} className="text-blue-400" />
      </div>
      <div className="min-w-0 max-w-[92%] flex-1 text-[13px] text-zinc-300">
        {msg.error === "no_api_key" ? (
          <SetupCard />
        ) : (
          <>
            {segs.map((seg, i) => {
              if (seg.kind === "text") return <MarkdownBlocks key={i} text={seg.text} />;
              if (seg.kind === "drafting")
                return (
                  <div
                    key={i}
                    className="my-2 animate-pulse rounded-xl border border-dashed border-accent/30 bg-panel-2/50 p-3 text-xs text-muted"
                  >
                    Building bet card…
                  </div>
                );
              const key = `${msg.id}:${i}`;
              return (
                <RecCard
                  key={i}
                  rec={seg.rec}
                  raw={seg.raw}
                  cur={cur}
                  saved={savedMap[key] ?? {}}
                  onBoard={() => seg.rec && onBoard(key, seg.rec)}
                  onBet={() => seg.rec && onBet(key, seg.rec)}
                />
              );
            })}
            {msg.error === "generic" && segs.length === 0 && (
              <p className="text-loss">{msg.content}</p>
            )}
          </>
        )}
        {msg.status && (
          <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-blue-400" />
            {msg.status}
          </div>
        )}
      </div>
    </div>
  );
}

function SetupCard() {
  return (
    <div className="rounded-xl border border-warn/30 bg-warn/8 p-4">
      <div className="mb-1.5 text-[13px] font-semibold text-warn">
        One-time setup needed
      </div>
      <p className="mb-2 text-xs leading-relaxed text-zinc-300">
        The chat is powered by Claude, which needs an API key (a password that
        lets this app talk to the AI). Three steps:
      </p>
      <ol className="ml-4 list-decimal space-y-1.5 text-xs leading-relaxed text-zinc-300">
        <li>
          Get a key at{" "}
          <a
            href="https://console.anthropic.com"
            target="_blank"
            rel="noreferrer"
            className="text-blue-400 underline"
          >
            console.anthropic.com
          </a>{" "}
          (sign up → Settings → API Keys → Create Key).
        </li>
        <li>
          In the project folder, create a file named{" "}
          <code className="rounded bg-white/8 px-1 font-mono text-[11px]">.env.local</code>{" "}
          containing one line:{" "}
          <code className="rounded bg-white/8 px-1 font-mono text-[11px]">
            ANTHROPIC_API_KEY=your-key-here
          </code>
        </li>
        <li>
          Restart the dev server (stop it with Ctrl+C, then run{" "}
          <code className="rounded bg-white/8 px-1 font-mono text-[11px]">npm run dev</code>{" "}
          again).
        </li>
      </ol>
    </div>
  );
}

// ── Rec block parsing ─────────────────────────────────────────────────

interface ParsedRec {
  sport: Sport;
  event: string;
  sportsbook: Sportsbook;
  market: Market;
  betType: BetType;
  selection: string;
  legs: string[];
  odds: number;
  estTrueProb: number;
  scores: AgentScores;
  finalScore: number;
  verdict: "BET" | "LEAN" | "PASS";
  stakeRec: number;
  unitsRec: number;
  edgePct: number;
  evPct: number;
  clvProjection: number;
  factors: string[];
  risks: string[];
  summary: string;
}

type Segment =
  | { kind: "text"; text: string }
  | { kind: "rec"; rec: ParsedRec | null; raw: string }
  | { kind: "drafting" };

function splitSegments(content: string, streaming: boolean): Segment[] {
  const out: Segment[] = [];
  const re = /```rec\s*\n?([\s\S]*?)```/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content))) {
    if (m.index > last) out.push({ kind: "text", text: content.slice(last, m.index) });
    out.push({ kind: "rec", rec: normalizeRec(m[1]), raw: m[1] });
    last = m.index + m[0].length;
  }
  const tail = content.slice(last);
  const open = tail.indexOf("```rec");
  if (open >= 0) {
    if (tail.slice(0, open).trim()) out.push({ kind: "text", text: tail.slice(0, open) });
    if (streaming) out.push({ kind: "drafting" });
    else out.push({ kind: "text", text: tail.slice(open) });
  } else if (tail.trim()) {
    out.push({ kind: "text", text: tail });
  }
  return out;
}

function normalizeRec(jsonText: string): ParsedRec | null {
  let raw: any;
  try {
    raw = JSON.parse(jsonText);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== "object") return null;
  const num = (v: any, d = 0) => (isFinite(Number(v)) ? Number(v) : d);
  const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
  const odds = Math.round(num(raw.odds));
  if (!odds) return null;
  const s10 = (v: any) => clamp(num(v, 5), 1, 10);
  let p = num(raw.estTrueProb);
  if (p > 1) p = p / 100; // tolerate percentages
  const finalScore = clamp(Math.round(num(raw.finalScore, 50)), 1, 100);
  const strArr = (v: any) =>
    Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(0, 8) : [];
  return {
    sport: SPORTS.includes(raw.sport) ? raw.sport : "Other",
    event: typeof raw.event === "string" ? raw.event : "",
    sportsbook: SPORTSBOOKS.includes(raw.sportsbook) ? raw.sportsbook : "Other",
    market: MARKETS.includes(raw.market) ? raw.market : "Other",
    betType: BET_TYPES.includes(raw.betType) ? raw.betType : "Straight",
    selection:
      typeof raw.selection === "string" && raw.selection ? raw.selection : "Recommended bet",
    legs: strArr(raw.legs),
    odds,
    estTrueProb: clamp(p, 0, 1),
    scores: {
      statisticalEdge: s10(raw.scores?.statisticalEdge),
      marketValue: s10(raw.scores?.marketValue),
      situationalEdge: s10(raw.scores?.situationalEdge),
      marketIntelligence: s10(raw.scores?.marketIntelligence),
      risk: s10(raw.scores?.risk),
      promotionValue: s10(raw.scores?.promotionValue),
      confidence: s10(raw.scores?.confidence),
    },
    finalScore,
    verdict:
      raw.verdict === "BET" || raw.verdict === "LEAN" || raw.verdict === "PASS"
        ? raw.verdict
        : finalScore >= 70
          ? "BET"
          : finalScore >= 60
            ? "LEAN"
            : "PASS",
    stakeRec: Math.max(0, num(raw.stakeRec)),
    unitsRec: Math.max(0, num(raw.unitsRec)),
    edgePct: num(raw.edgePct),
    evPct: num(raw.evPct),
    clvProjection: num(raw.clvProjection),
    factors: strArr(raw.factors),
    risks: strArr(raw.risks),
    summary: typeof raw.summary === "string" ? raw.summary : "",
  };
}

// ── Rec card ──────────────────────────────────────────────────────────

function RecCard({
  rec,
  raw,
  cur,
  saved,
  onBoard,
  onBet,
}: {
  rec: ParsedRec | null;
  raw: string;
  cur: string;
  saved: { board?: boolean; bet?: boolean };
  onBoard: () => void;
  onBet: () => void;
}) {
  if (!rec)
    return (
      <pre className="my-2 overflow-x-auto rounded-lg bg-black/30 p-3 font-mono text-[11px] text-zinc-400">
        {raw.trim()}
      </pre>
    );
  const scoreColor =
    rec.finalScore >= 80
      ? "text-profit"
      : rec.finalScore >= 70
        ? "text-blue-400"
        : rec.finalScore >= 60
          ? "text-warn"
          : "text-muted";
  const sign = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
  return (
    <div className="my-2.5 rounded-xl border border-accent/25 bg-panel-2/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`font-mono text-2xl font-black tabular-nums ${scoreColor}`}>
              {rec.finalScore}
            </span>
            <VerdictBadge verdict={rec.verdict} />
            <Badge variant="muted">{rec.sport}</Badge>
            <Badge variant="muted">{rec.sportsbook}</Badge>
          </div>
          <div className="mt-1.5 text-sm font-semibold text-zinc-100">{rec.selection}</div>
          {rec.event && <div className="text-xs text-muted">{rec.event}</div>}
          {rec.legs.length > 1 && (
            <ul className="mt-1.5 space-y-0.5">
              {rec.legs.map((l, i) => (
                <li key={i} className="flex gap-1.5 text-xs text-zinc-300">
                  <span className="font-mono text-blue-400">{i + 1}.</span> {l}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="text-right">
          <div className="font-mono text-xl font-bold tabular-nums text-zinc-100">
            {fmtOdds(rec.odds)}
          </div>
          <div className="text-[11px] text-muted">
            {rec.market} · {rec.betType}
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-4">
        <RecKv k="Est. win prob" v={`${(rec.estTrueProb * 100).toFixed(1)}%`} />
        <RecKv k="Edge" v={sign(rec.edgePct)} good={rec.edgePct > 0} />
        <RecKv k="EV" v={sign(rec.evPct)} good={rec.evPct > 0} />
        <RecKv
          k="Stake rec"
          v={rec.stakeRec > 0 ? `${fmtMoney(rec.stakeRec, cur)} (${rec.unitsRec}u)` : "No bet"}
        />
      </div>

      {(rec.factors.length > 0 || rec.risks.length > 0) && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {rec.factors.length > 0 && (
            <ul className="space-y-1">
              {rec.factors.slice(0, 4).map((f, i) => (
                <li key={i} className="flex gap-1.5 text-[11.5px] leading-snug text-zinc-300">
                  <span className="shrink-0 text-profit">+</span> {f}
                </li>
              ))}
            </ul>
          )}
          {rec.risks.length > 0 && (
            <ul className="space-y-1">
              {rec.risks.slice(0, 4).map((r, i) => (
                <li key={i} className="flex gap-1.5 text-[11.5px] leading-snug text-zinc-300">
                  <span className="shrink-0 text-loss">–</span> {r}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {rec.summary && <p className="mt-2.5 text-xs italic text-muted">{rec.summary}</p>}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" onClick={onBoard} disabled={!!saved.board}>
          {saved.board ? (
            <>
              <Check size={13} /> On Picks Board
            </>
          ) : (
            <>
              <Save size={13} /> Save to Picks Board
            </>
          )}
        </Button>
        <Button size="sm" variant="success" onClick={onBet} disabled={!!saved.bet}>
          {saved.bet ? (
            <>
              <Check size={13} /> Logged in Tracker
            </>
          ) : (
            <>
              <ClipboardCheck size={13} /> I placed this — log it
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

function RecKv({ k, v, good }: { k: string; v: string; good?: boolean }) {
  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-wider text-muted">{k}</div>
      <div
        className={`font-mono font-bold tabular-nums ${
          good == null ? "text-zinc-200" : good ? "text-profit" : "text-loss"
        }`}
      >
        {v}
      </div>
    </div>
  );
}

// ── Tiny markdown renderer (bold, code, lists, headings, tables) ──────

function MarkdownBlocks({ text }: { text: string }) {
  const lines = text.split("\n");
  const out: React.ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    if (line.startsWith("```")) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) buf.push(lines[i++]);
      i++; // closing fence
      out.push(
        <pre
          key={key++}
          className="my-2 overflow-x-auto rounded-lg bg-black/30 p-3 font-mono text-[12px] leading-relaxed text-zinc-300"
        >
          {buf.join("\n")}
        </pre>
      );
      continue;
    }
    if (/^#{1,4}\s/.test(line)) {
      out.push(
        <div key={key++} className="mb-1 mt-3 text-[13px] font-bold text-zinc-100">
          <Inline s={line.replace(/^#{1,4}\s/, "")} />
        </div>
      );
      i++;
      continue;
    }
    if (/^(-{3,}|\*{3,})\s*$/.test(line)) {
      out.push(<hr key={key++} className="my-3 border-border" />);
      i++;
      continue;
    }
    if (/^\s*([-*•]|\d+[.)])\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*•]|\d+[.)])\s/.test(lines[i]))
        items.push(lines[i++].replace(/^\s*([-*•]|\d+[.)])\s/, ""));
      out.push(
        <ul key={key++} className="my-1.5 space-y-1 pl-1">
          {items.map((it, j) => (
            <li key={j} className="flex gap-2">
              <span className="mt-[1px] shrink-0 text-blue-400">▸</span>
              <span>
                <Inline s={it} />
              </span>
            </li>
          ))}
        </ul>
      );
      continue;
    }
    if (line.trimStart().startsWith("|")) {
      const rows: string[] = [];
      while (i < lines.length && lines[i].trimStart().startsWith("|")) rows.push(lines[i++]);
      out.push(
        <pre
          key={key++}
          className="my-2 overflow-x-auto rounded-lg bg-black/30 p-3 font-mono text-[11.5px] leading-relaxed text-zinc-300"
        >
          {rows.join("\n")}
        </pre>
      );
      continue;
    }
    const buf: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,4}\s|```|-{3,}\s*$|\s*([-*•]|\d+[.)])\s)/.test(lines[i]) &&
      !lines[i].trimStart().startsWith("|")
    )
      buf.push(lines[i++]);
    out.push(
      <p key={key++} className="my-1.5 leading-relaxed">
        <Inline s={buf.join(" ")} />
      </p>
    );
  }
  return <>{out}</>;
}

function Inline({ s }: { s: string }) {
  const parts: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    if (m.index > last) parts.push(s.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**"))
      parts.push(
        <strong key={m.index} className="font-semibold text-zinc-100">
          {tok.slice(2, -2)}
        </strong>
      );
    else if (tok.startsWith("`"))
      parts.push(
        <code key={m.index} className="rounded bg-white/8 px-1 font-mono text-[12px]">
          {tok.slice(1, -1)}
        </code>
      );
    else parts.push(<em key={m.index}>{tok.slice(1, -1)}</em>);
    last = m.index + tok.length;
  }
  if (last < s.length) parts.push(s.slice(last));
  return <>{parts}</>;
}
