import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  CAD: "C$",
};

export function fmtMoney(
  n: number | null | undefined,
  currency = "USD",
  opts: { sign?: boolean; decimals?: number } = {}
): string {
  if (n == null || isNaN(n)) return "—";
  const sym = CURRENCY_SYMBOLS[currency] ?? "$";
  const decimals = opts.decimals ?? 2;
  const abs = Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  const sign = n < 0 ? "-" : opts.sign && n > 0 ? "+" : "";
  return `${sign}${sym}${abs}`;
}

export function fmtPct(
  n: number | null | undefined,
  opts: { sign?: boolean; decimals?: number } = {}
): string {
  if (n == null || isNaN(n)) return "—";
  const decimals = opts.decimals ?? 1;
  const sign = n < 0 ? "" : opts.sign && n > 0 ? "+" : "";
  return `${sign}${n.toFixed(decimals)}%`;
}

export function fmtUnits(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}u`;
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso.slice(0, 10) + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function uid(): string {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
  );
}

export const profitColor = (n: number) =>
  n > 0 ? "text-profit" : n < 0 ? "text-loss" : "text-muted";
