"use client";

// ── Performance Review: grade the process, not the outcome ───────────
import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { Bet, BetReview } from "@/lib/types";
import { profitOf, reviewStats } from "@/lib/stats";
import { fmtOdds } from "@/lib/odds";
import { fmtDate, fmtMoney, fmtPct, profitColor } from "@/lib/utils";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  PageHeader,
  StatCard,
  statusBadgeVariant,
  Tabs,
  Textarea,
} from "@/components/ui/primitives";

export default function ReviewPage() {
  const { db, ready, upsertReview } = useStore();
  const [tab, setTab] = useState("queue");
  const [notes, setNotes] = useState<Record<string, string>>({});

  const reviewsById = useMemo(
    () => new Map(db.reviews.map((r) => [r.betId, r])),
    [db.reviews]
  );
  const reviewable = useMemo(
    () =>
      db.bets
        .filter((b) => b.status === "win" || b.status === "loss")
        .sort((a, b) => b.date.localeCompare(a.date)),
    [db.bets]
  );
  const queue = reviewable.filter((b) => !reviewsById.has(b.id));
  const done = reviewable.filter((b) => reviewsById.has(b.id));
  const rs = useMemo(() => reviewStats(db.bets, db.reviews), [db.bets, db.reviews]);

  if (!ready) return null;
  const cur = db.settings.currency;

  const answer = (bet: Bet, ans: BetReview["answer"]) => {
    upsertReview({
      betId: bet.id,
      answer: ans,
      note: notes[bet.id] ?? "",
      reviewedAt: new Date().toISOString(),
    });
  };

  const matrixTotal = Math.max(
    1,
    rs.goodWins + rs.badWins + rs.goodLosses + rs.badLosses
  );
  const cell = (n: number) => `${n} (${((n / matrixTotal) * 100).toFixed(0)}%)`;

  const list = tab === "queue" ? queue : done;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Performance Review"
        sub="A losing bet can be a great bet. A winning bet can be a terrible one. Grade the decision, not the result."
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          label="Decision quality"
          value={rs.decisionQuality.toFixed(0)}
          tone={rs.decisionQuality >= 70 ? "profit" : rs.decisionQuality >= 50 ? "warn" : "loss"}
          sub="0-100, weighted for outcome bias"
        />
        <StatCard
          label="Process score"
          value={fmtPct(rs.processScore, { decimals: 0 })}
          tone={rs.processScore >= 70 ? "profit" : "warn"}
          sub="% of reviewed bets you'd make again"
        />
        <StatCard
          label="Reviewed"
          value={`${rs.reviewed} / ${reviewable.length}`}
          sub={`${queue.length} awaiting review`}
        />
        <StatCard
          label="Bad wins"
          value={rs.badWins}
          tone={rs.badWins > rs.goodWins ? "loss" : "neutral"}
          sub="Wins that taught the wrong lesson"
        />
      </div>

      {/* Process matrix */}
      <Card>
        <CardHeader>
          <CardTitle>Process × outcome matrix</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 md:max-w-xl">
            <MatrixCell
              title="Good wins"
              value={cell(rs.goodWins)}
              desc="Good process + won. The goal."
              tone="profit"
            />
            <MatrixCell
              title="Good losses"
              value={cell(rs.goodLosses)}
              desc="Good process + lost. Variance — keep making this bet."
              tone="accent"
            />
            <MatrixCell
              title="Bad wins"
              value={cell(rs.badWins)}
              desc="Poor process + won. The most dangerous outcome in gambling."
              tone="warn"
            />
            <MatrixCell
              title="Bad losses"
              value={cell(rs.badLosses)}
              desc="Poor process + lost. The market charged you tuition."
              tone="loss"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Tabs
          value={tab}
          onChange={setTab}
          options={[
            { value: "queue", label: `To review (${queue.length})` },
            { value: "done", label: `Reviewed (${done.length})` },
          ]}
        />
      </div>

      {list.length === 0 ? (
        <EmptyState
          title={tab === "queue" ? "Review queue is empty" : "No reviewed bets yet"}
          body={
            tab === "queue"
              ? "Every settled win or loss lands here for a process review. Stay current — memory of why you bet decays fast."
              : "Work through the queue. The question is always the same: knowing only what you knew then, would you place it again?"
          }
        />
      ) : (
        <div className="space-y-3">
          {list.map((b) => {
            const existing = reviewsById.get(b.id);
            const p = profitOf(b);
            return (
              <Card key={b.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-zinc-100">
                        {b.selection || b.market}
                      </span>
                      <Badge variant={statusBadgeVariant(b.status)}>{b.status}</Badge>
                      <span className={`font-mono text-xs font-bold ${profitColor(p)}`}>
                        {fmtMoney(p, cur, { sign: true })}
                      </span>
                    </div>
                    <div className="mt-0.5 text-xs text-muted">
                      {fmtDate(b.date)} · {b.sport} · {b.event} · {fmtOdds(b.odds)} ·{" "}
                      {fmtMoney(b.stake, cur)} stake
                      {b.promotionUsed ? ` · ${b.promotionType}` : ""}
                    </div>
                    {b.notes && (
                      <div className="mt-1.5 rounded-md border border-border/60 bg-panel-2/50 px-2.5 py-1.5 text-xs italic text-zinc-400">
                        Your note at bet time: “{b.notes}”
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-3 border-t border-border pt-3">
                  <div className="mb-2 text-[13px] font-medium text-zinc-200">
                    Would you place this exact bet again,{" "}
                    <span className="text-blue-400">
                      knowing only what you knew at the time?
                    </span>
                  </div>
                  {existing ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <AnswerBadge answer={existing.answer} />
                      {existing.note && (
                        <span className="text-xs text-muted">“{existing.note}”</span>
                      )}
                      <ReAnswer bet={b} answer={answer} />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Textarea
                        placeholder="Optional: what did you know, and what was the read?"
                        value={notes[b.id] ?? ""}
                        onChange={(e) =>
                          setNotes((n) => ({ ...n, [b.id]: e.target.value }))
                        }
                        className="min-h-[52px]"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" variant="success" onClick={() => answer(b, "yes")}>
                          Yes — good process
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => answer(b, "no")}>
                          No — wouldn't repeat
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => answer(b, "unsure")}>
                          Unsure
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MatrixCell({
  title,
  value,
  desc,
  tone,
}: {
  title: string;
  value: string;
  desc: string;
  tone: "profit" | "loss" | "warn" | "accent";
}) {
  const borders = {
    profit: "border-profit/30 bg-profit/8",
    loss: "border-loss/30 bg-loss/8",
    warn: "border-warn/30 bg-warn/8",
    accent: "border-accent/30 bg-accent/8",
  };
  const texts = {
    profit: "text-profit",
    loss: "text-loss",
    warn: "text-warn",
    accent: "text-blue-400",
  };
  return (
    <div className={`rounded-lg border p-3 ${borders[tone]}`}>
      <div className={`text-[11px] font-bold uppercase tracking-wider ${texts[tone]}`}>
        {title}
      </div>
      <div className="mt-1 font-mono text-lg font-bold text-zinc-100">{value}</div>
      <div className="mt-0.5 text-[11px] leading-snug text-muted">{desc}</div>
    </div>
  );
}

function AnswerBadge({ answer }: { answer: BetReview["answer"] }) {
  if (answer === "yes") return <Badge variant="profit">YES — would repeat</Badge>;
  if (answer === "no") return <Badge variant="loss">NO — process error</Badge>;
  return <Badge variant="warn">UNSURE</Badge>;
}

function ReAnswer({
  bet,
  answer,
}: {
  bet: Bet;
  answer: (b: Bet, a: BetReview["answer"]) => void;
}) {
  return (
    <div className="ml-auto flex gap-1">
      <Button size="sm" variant="ghost" onClick={() => answer(bet, "yes")}>
        Yes
      </Button>
      <Button size="sm" variant="ghost" onClick={() => answer(bet, "no")}>
        No
      </Button>
      <Button size="sm" variant="ghost" onClick={() => answer(bet, "unsure")}>
        Unsure
      </Button>
    </div>
  );
}
