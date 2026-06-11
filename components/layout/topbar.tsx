"use client";

import { useStore } from "@/lib/store";
import { overallStats } from "@/lib/stats";
import { fmtMoney, fmtPct, fmtUnits, profitColor } from "@/lib/utils";
import { Badge } from "@/components/ui/primitives";
import { Cloud, HardDrive } from "lucide-react";

export function Topbar() {
  const { db, ready, cloudMode } = useStore();
  if (!ready) return <div className="h-12 border-b border-border bg-panel" />;
  const s = overallStats(db.bets, db.settings);
  const cur = db.settings.currency;

  return (
    <header className="sticky top-0 z-30 flex h-12 items-center justify-between gap-4 border-b border-border bg-panel/90 px-4 backdrop-blur">
      <div className="flex items-center gap-4 overflow-x-auto text-xs">
        <Stat label="Bankroll" value={fmtMoney(s.currentBankroll, cur)} className="text-zinc-100" />
        <Stat
          label="P/L"
          value={fmtMoney(s.profit, cur, { sign: true })}
          className={profitColor(s.profit)}
        />
        <Stat
          label="ROI"
          value={fmtPct(s.roi, { sign: true })}
          className={profitColor(s.roi)}
        />
        <Stat
          label="Units"
          value={fmtUnits(s.units)}
          className={profitColor(s.units)}
        />
        <Stat
          label="Record"
          value={`${s.wins}-${s.losses}${s.pushes ? `-${s.pushes}` : ""}`}
          className="text-zinc-300"
        />
        {s.pending > 0 && (
          <Stat label="Open" value={`${s.pending} bets`} className="text-blue-400" />
        )}
      </div>
      <Badge variant={cloudMode ? "accent" : "muted"} className="shrink-0">
        {cloudMode ? <Cloud size={11} /> : <HardDrive size={11} />}
        {cloudMode ? "Cloud sync" : "Local mode"}
      </Badge>
    </header>
  );
}

function Stat({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className="flex shrink-0 items-baseline gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">
        {label}
      </span>
      <span className={`font-mono text-xs font-bold tabular-nums ${className ?? ""}`}>
        {value}
      </span>
    </div>
  );
}
