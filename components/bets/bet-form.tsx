"use client";

import { useEffect, useState } from "react";
import {
  Bet,
  BET_STATUSES,
  BET_TYPES,
  BetStatus,
  MARKETS,
  PROMO_TYPES,
  SPORTS,
  SPORTSBOOKS,
} from "@/lib/types";
import { totalPayout } from "@/lib/odds";
import { todayISO, uid } from "@/lib/utils";
import {
  Button,
  Dialog,
  Field,
  Input,
  Select,
  Textarea,
} from "@/components/ui/primitives";

export function emptyBet(defaults?: Partial<Bet>): Bet {
  return {
    id: uid(),
    date: todayISO(),
    sport: "NFL",
    league: "",
    event: "",
    sportsbook: "FanDuel",
    betType: "Straight",
    market: "Spread",
    selection: "",
    odds: -110,
    stake: 10,
    potentialPayout: 0,
    promotionUsed: false,
    promotionType: "None",
    confidenceScore: null,
    finalBetScore: null,
    estTrueProb: null,
    closingLine: null,
    status: "pending",
    cashoutAmount: null,
    notes: "",
    createdAt: new Date().toISOString(),
    ...defaults,
  };
}

export function BetFormDialog({
  open,
  onClose,
  onSave,
  initial,
  title,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (bet: Bet) => void;
  initial: Bet | null;
  title: string;
}) {
  const [bet, setBet] = useState<Bet>(initial ?? emptyBet());
  useEffect(() => {
    if (open) setBet(initial ?? emptyBet());
  }, [open, initial]);

  const set = <K extends keyof Bet>(key: K, value: Bet[K]) =>
    setBet((b) => ({ ...b, [key]: value }));

  const num = (v: string): number => (v === "" || isNaN(+v) ? 0 : +v);
  const numOrNull = (v: string): number | null =>
    v === "" || isNaN(+v) ? null : +v;

  const save = () => {
    const payout =
      bet.odds && bet.stake ? totalPayout(bet.odds, bet.stake) : 0;
    onSave({
      ...bet,
      potentialPayout: Math.round(payout * 100) / 100,
      promotionUsed: bet.promotionType !== "None",
    });
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} title={title} wide>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Field label="Date">
          <Input
            type="date"
            value={bet.date}
            onChange={(e) => set("date", e.target.value)}
          />
        </Field>
        <Field label="Sport">
          <Select
            value={bet.sport}
            onChange={(e) => set("sport", e.target.value as Bet["sport"])}
          >
            {SPORTS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
        </Field>
        <Field label="League">
          <Input
            placeholder="NFL, EPL…"
            value={bet.league}
            onChange={(e) => set("league", e.target.value)}
          />
        </Field>
        <Field label="Event" className="col-span-2">
          <Input
            placeholder="Chiefs @ Bills"
            value={bet.event}
            onChange={(e) => set("event", e.target.value)}
          />
        </Field>
        <Field label="Sportsbook">
          <Select
            value={bet.sportsbook}
            onChange={(e) =>
              set("sportsbook", e.target.value as Bet["sportsbook"])
            }
          >
            {SPORTSBOOKS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
        </Field>
        <Field label="Bet type">
          <Select
            value={bet.betType}
            onChange={(e) => set("betType", e.target.value as Bet["betType"])}
          >
            {BET_TYPES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
        </Field>
        <Field label="Market">
          <Select
            value={bet.market}
            onChange={(e) => set("market", e.target.value as Bet["market"])}
          >
            {MARKETS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
        </Field>
        <Field label="Selection">
          <Input
            placeholder="Bills -2.5"
            value={bet.selection}
            onChange={(e) => set("selection", e.target.value)}
          />
        </Field>
        <Field label="Odds (American)">
          <Input
            type="number"
            value={bet.odds || ""}
            onChange={(e) => set("odds", num(e.target.value))}
          />
        </Field>
        <Field label="Stake ($)">
          <Input
            type="number"
            step="0.01"
            value={bet.stake || ""}
            onChange={(e) => set("stake", num(e.target.value))}
          />
        </Field>
        <Field label="Promotion">
          <Select
            value={bet.promotionType}
            onChange={(e) =>
              set("promotionType", e.target.value as Bet["promotionType"])
            }
          >
            {PROMO_TYPES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
        </Field>
        <Field label="Status">
          <Select
            value={bet.status}
            onChange={(e) => set("status", e.target.value as BetStatus)}
          >
            {BET_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </Field>
        {bet.status === "cashout" && (
          <Field label="Cashout amount ($)">
            <Input
              type="number"
              step="0.01"
              value={bet.cashoutAmount ?? ""}
              onChange={(e) => set("cashoutAmount", numOrNull(e.target.value))}
            />
          </Field>
        )}
        <Field label="Est. true win % (optional)">
          <Input
            type="number"
            step="0.1"
            placeholder="55"
            value={bet.estTrueProb == null ? "" : Math.round(bet.estTrueProb * 1000) / 10}
            onChange={(e) => {
              const n = numOrNull(e.target.value);
              set("estTrueProb", n == null ? null : n / 100);
            }}
          />
        </Field>
        <Field label="Confidence 1-10 (optional)">
          <Input
            type="number"
            step="0.5"
            min={1}
            max={10}
            value={bet.confidenceScore ?? ""}
            onChange={(e) => set("confidenceScore", numOrNull(e.target.value))}
          />
        </Field>
        <Field label="Closing line (optional)">
          <Input
            type="number"
            placeholder="-115"
            value={bet.closingLine ?? ""}
            onChange={(e) => set("closingLine", numOrNull(e.target.value))}
          />
        </Field>
        <Field label="Notes" className="col-span-2 md:col-span-3">
          <Textarea
            placeholder="Why did you make this bet?"
            value={bet.notes}
            onChange={(e) => set("notes", e.target.value)}
          />
        </Field>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={save} disabled={!bet.event && !bet.selection}>
          Save bet
        </Button>
      </div>
    </Dialog>
  );
}
