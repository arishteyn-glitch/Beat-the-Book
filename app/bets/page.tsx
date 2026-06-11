"use client";

// ── Bet Tracker: full CRUD over every wager ──────────────────────────
import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { Bet, BET_STATUSES, SPORTS, SPORTSBOOKS } from "@/lib/types";
import { clvPct, fmtOdds, impliedProbability } from "@/lib/odds";
import { profitOf } from "@/lib/stats";
import { fmtDate, fmtMoney, fmtPct, profitColor, uid } from "@/lib/utils";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  PageHeader,
  Select,
  statusBadgeVariant,
  Table,
  Td,
  Th,
  THead,
  Tr,
} from "@/components/ui/primitives";
import { BetFormDialog } from "@/components/bets/bet-form";
import { Copy, Pencil, Plus, Trash2 } from "lucide-react";

type SortKey = "date" | "stake" | "odds" | "profit" | "sport";

export default function BetTrackerPage() {
  const { db, ready, upsertBet, deleteBet, loadDemoData } = useStore();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Bet | null>(null);
  const [search, setSearch] = useState("");
  const [fSport, setFSport] = useState("all");
  const [fBook, setFBook] = useState("all");
  const [fStatus, setFStatus] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<1 | -1>(-1);
  const cur = db.settings.currency;

  const bets = useMemo(() => {
    let list = [...db.bets];
    if (fSport !== "all") list = list.filter((b) => b.sport === fSport);
    if (fBook !== "all") list = list.filter((b) => b.sportsbook === fBook);
    if (fStatus !== "all") list = list.filter((b) => b.status === fStatus);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((b) =>
        [b.event, b.selection, b.league, b.market, b.notes]
          .join(" ")
          .toLowerCase()
          .includes(q)
      );
    }
    const dir = sortDir;
    list.sort((a, b) => {
      switch (sortKey) {
        case "stake": return (a.stake - b.stake) * dir;
        case "odds": return (a.odds - b.odds) * dir;
        case "profit": return (profitOf(a) - profitOf(b)) * dir;
        case "sport": return a.sport.localeCompare(b.sport) * dir;
        default:
          return (
            (a.date.localeCompare(b.date) ||
              a.createdAt.localeCompare(b.createdAt)) * dir
          );
      }
    });
    return list;
  }, [db.bets, fSport, fBook, fStatus, search, sortKey, sortDir]);

  if (!ready) return null;

  const sortBy = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === 1 ? -1 : 1));
    else {
      setSortKey(k);
      setSortDir(-1);
    }
  };

  const duplicate = (b: Bet) => {
    upsertBet({
      ...b,
      id: uid(),
      status: "pending",
      closingLine: null,
      cashoutAmount: null,
      createdAt: new Date().toISOString(),
    });
  };

  const arrow = (k: SortKey) =>
    sortKey === k ? (sortDir === -1 ? " ↓" : " ↑") : "";

  return (
    <div>
      <PageHeader
        title="Bet Tracker"
        sub={`${db.bets.length} bets tracked. Every wager, graded and annotated.`}
        actions={
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus size={15} /> Add bet
          </Button>
        }
      />

      {/* Filters */}
      <Card className="mb-4 flex flex-wrap items-center gap-2 p-3">
        <Input
          placeholder="Search event, selection, notes…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={fSport} onChange={(e) => setFSport(e.target.value)} className="w-32">
          <option value="all">All sports</option>
          {SPORTS.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </Select>
        <Select value={fBook} onChange={(e) => setFBook(e.target.value)} className="w-36">
          <option value="all">All books</option>
          {SPORTSBOOKS.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </Select>
        <Select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className="w-32">
          <option value="all">All statuses</option>
          {BET_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </Select>
        <span className="ml-auto text-xs text-muted">{bets.length} shown</span>
      </Card>

      {db.bets.length === 0 ? (
        <EmptyState
          title="No bets yet"
          body="Add your first bet, or load the demo dataset to see the tracker in action."
          action={
            <div className="flex gap-2">
              <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
                <Plus size={15} /> Add bet
              </Button>
              <Button variant="outline" onClick={loadDemoData}>
                Load demo data
              </Button>
            </div>
          }
        />
      ) : (
        <Card>
          <Table>
            <THead>
              <Th className="cursor-pointer" onClick={() => sortBy("date")}>
                Date{arrow("date")}
              </Th>
              <Th className="cursor-pointer" onClick={() => sortBy("sport")}>
                Sport{arrow("sport")}
              </Th>
              <Th>Bet</Th>
              <Th>Book</Th>
              <Th className="cursor-pointer text-right" onClick={() => sortBy("odds")}>
                Odds{arrow("odds")}
              </Th>
              <Th className="cursor-pointer text-right" onClick={() => sortBy("stake")}>
                Stake{arrow("stake")}
              </Th>
              <Th className="text-right">Edge / CLV</Th>
              <Th>Status</Th>
              <Th className="cursor-pointer text-right" onClick={() => sortBy("profit")}>
                P/L{arrow("profit")}
              </Th>
              <Th className="text-right">Actions</Th>
            </THead>
            <tbody>
              {bets.map((b) => {
                const p = profitOf(b);
                const edgePct =
                  b.estTrueProb != null
                    ? (b.estTrueProb - impliedProbability(b.odds)) * 100
                    : null;
                const clv =
                  b.closingLine != null ? clvPct(b.odds, b.closingLine) : null;
                return (
                  <Tr key={b.id}>
                    <Td className="whitespace-nowrap text-xs text-muted">
                      {fmtDate(b.date)}
                    </Td>
                    <Td>
                      <Badge variant="muted">{b.sport}</Badge>
                    </Td>
                    <Td className="max-w-[260px]">
                      <div className="truncate text-[13px] font-medium text-zinc-200">
                        {b.selection || b.market}
                      </div>
                      <div className="truncate text-[11px] text-muted">
                        {b.event}
                        {b.promotionUsed && (
                          <span className="ml-1.5 text-violet">
                            ◆ {b.promotionType}
                          </span>
                        )}
                      </div>
                    </Td>
                    <Td className="text-xs text-muted">{b.sportsbook}</Td>
                    <Td className="text-right font-mono text-xs tabular-nums text-zinc-300">
                      {fmtOdds(b.odds)}
                    </Td>
                    <Td className="text-right font-mono text-xs tabular-nums text-zinc-300">
                      {fmtMoney(b.stake, cur)}
                    </Td>
                    <Td className="text-right font-mono text-[11px] tabular-nums">
                      <span className={edgePct == null ? "text-muted" : profitColor(edgePct)}>
                        {edgePct == null ? "—" : fmtPct(edgePct, { sign: true })}
                      </span>
                      <span className="text-muted"> / </span>
                      <span className={clv == null ? "text-muted" : profitColor(clv)}>
                        {clv == null ? "—" : fmtPct(clv, { sign: true })}
                      </span>
                    </Td>
                    <Td>
                      <Badge variant={statusBadgeVariant(b.status)}>{b.status}</Badge>
                    </Td>
                    <Td
                      className={`text-right font-mono text-xs font-bold tabular-nums ${
                        b.status === "pending" ? "text-muted" : profitColor(p)
                      }`}
                    >
                      {b.status === "pending" ? "open" : fmtMoney(p, cur, { sign: true })}
                    </Td>
                    <Td>
                      <div className="flex justify-end gap-0.5">
                        <IconBtn title="Edit" onClick={() => { setEditing(b); setFormOpen(true); }}>
                          <Pencil size={13} />
                        </IconBtn>
                        <IconBtn title="Duplicate" onClick={() => duplicate(b)}>
                          <Copy size={13} />
                        </IconBtn>
                        <IconBtn
                          title="Delete"
                          onClick={() => {
                            if (confirm("Delete this bet?")) deleteBet(b.id);
                          }}
                          danger
                        >
                          <Trash2 size={13} />
                        </IconBtn>
                      </div>
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        </Card>
      )}

      <BetFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSave={upsertBet}
        initial={editing}
        title={editing ? "Edit bet" : "Add bet"}
      />
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  title,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  danger?: boolean;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`rounded-md p-1.5 transition-colors ${
        danger
          ? "text-muted hover:bg-loss/15 hover:text-loss"
          : "text-muted hover:bg-white/5 hover:text-zinc-200"
      }`}
    >
      {children}
    </button>
  );
}
