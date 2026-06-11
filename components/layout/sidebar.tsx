"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  ListChecks,
  BarChart3,
  Bot,
  Target,
  Gift,
  Wallet,
  ScanLine,
  ClipboardCheck,
  Settings,
  TrendingUp,
} from "lucide-react";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/bets", label: "Bet Tracker", icon: ListChecks },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/agent", label: "AI Agent", icon: Bot },
  { href: "/picks", label: "Picks Board", icon: Target },
  { href: "/promotions", label: "Promotion Optimizer", icon: Gift },
  { href: "/bankroll", label: "Bankroll", icon: Wallet },
  { href: "/importer", label: "Bet Slip Importer", icon: ScanLine },
  { href: "/review", label: "Performance Review", icon: ClipboardCheck },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-56 flex-col border-r border-border bg-panel md:flex">
      <div className="flex items-center gap-2.5 border-b border-border px-4 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15 text-blue-400">
          <TrendingUp size={17} />
        </div>
        <div>
          <div className="text-sm font-bold tracking-tight text-zinc-50">
            Beat the Book
          </div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-muted">
            Betting OS
          </div>
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2.5">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors",
                active
                  ? "bg-accent/12 text-blue-400"
                  : "text-muted hover:bg-white/[0.04] hover:text-zinc-200"
              )}
            >
              <Icon size={15} strokeWidth={2.2} />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-border p-3 text-[10px] leading-relaxed text-muted/70">
        Bet with your head, not over it.
        <br />
        Gambling problem? Call 1-800-GAMBLER.
      </div>
    </aside>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex justify-around border-t border-border bg-panel/95 py-1.5 backdrop-blur md:hidden">
      {NAV.slice(0, 5).map(({ href, icon: Icon, label }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-label={label}
            className={cn(
              "rounded-lg p-2.5",
              active ? "text-blue-400" : "text-muted"
            )}
          >
            <Icon size={19} />
          </Link>
        );
      })}
    </nav>
  );
}
