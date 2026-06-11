"use client";

// ── shadcn-style UI primitives, tuned for a dark financial dashboard ──
import React from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

// Card
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-panel shadow-sm",
        className
      )}
      {...props}
    />
  );
}
export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1 p-4 pb-2", className)} {...props} />;
}
export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        "text-[13px] font-semibold uppercase tracking-wider text-muted",
        className
      )}
      {...props}
    />
  );
}
export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-4 pt-2", className)} {...props} />;
}

// Button
type ButtonVariant = "default" | "outline" | "ghost" | "danger" | "success";
export const Button = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant;
    size?: "sm" | "md" | "lg";
  }
>(function Button({ className, variant = "default", size = "md", ...props }, ref) {
  const variants: Record<ButtonVariant, string> = {
    default:
      "bg-accent text-white hover:bg-blue-500 disabled:bg-accent/40 shadow-glow",
    outline:
      "border border-border-strong bg-transparent text-zinc-200 hover:bg-white/5",
    ghost: "bg-transparent text-zinc-300 hover:bg-white/5",
    danger: "bg-loss/15 text-loss border border-loss/30 hover:bg-loss/25",
    success: "bg-profit/15 text-profit border border-profit/30 hover:bg-profit/25",
  };
  const sizes = {
    sm: "h-7 px-2.5 text-xs",
    md: "h-9 px-3.5 text-sm",
    lg: "h-10 px-5 text-sm",
  };
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  );
});

// Inputs
export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function Input({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        "h-9 w-full rounded-lg border border-border bg-panel-2 px-3 text-sm text-zinc-100 placeholder:text-muted/60 focus:border-accent/60 focus:outline-none focus:ring-1 focus:ring-accent/40",
        className
      )}
      {...props}
    />
  );
});

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        "min-h-[72px] w-full rounded-lg border border-border bg-panel-2 px-3 py-2 text-sm text-zinc-100 placeholder:text-muted/60 focus:border-accent/60 focus:outline-none focus:ring-1 focus:ring-accent/40",
        className
      )}
      {...props}
    />
  );
});

export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-9 w-full appearance-none rounded-lg border border-border bg-panel-2 px-3 text-sm text-zinc-100 focus:border-accent/60 focus:outline-none focus:ring-1 focus:ring-accent/40 [&>option]:bg-panel-2",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("mb-1 block text-xs font-medium text-muted", className)}
      {...props}
    />
  );
}

export function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

// Badge
type BadgeVariant =
  | "default"
  | "profit"
  | "loss"
  | "warn"
  | "accent"
  | "violet"
  | "muted";
export function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  const variants: Record<BadgeVariant, string> = {
    default: "bg-white/8 text-zinc-300 border-white/10",
    profit: "bg-profit/12 text-profit border-profit/25",
    loss: "bg-loss/12 text-loss border-loss/25",
    warn: "bg-warn/12 text-warn border-warn/25",
    accent: "bg-accent/12 text-blue-400 border-accent/25",
    violet: "bg-violet/12 text-violet border-violet/25",
    muted: "bg-white/5 text-muted border-white/8",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-semibold",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}

export function statusBadgeVariant(status: string): BadgeVariant {
  switch (status) {
    case "win": return "profit";
    case "loss": return "loss";
    case "pending": return "accent";
    case "push":
    case "void": return "muted";
    case "cashout": return "warn";
    default: return "default";
  }
}

// Table
export function Table({ className, ...props }: React.HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn("w-full text-sm", className)} {...props} />
    </div>
  );
}
export function THead({ children }: { children: React.ReactNode }) {
  return (
    <thead>
      <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted">
        {children}
      </tr>
    </thead>
  );
}
export function Th({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={cn("px-3 py-2.5 font-medium", className)} {...props} />;
}
export function Td({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn("px-3 py-2.5 align-middle", className)} {...props} />
  );
}
export function Tr({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        "border-b border-border/50 transition-colors hover:bg-white/[0.025]",
        className
      )}
      {...props}
    />
  );
}

// Dialog (lightweight, no portal needed for this app)
export function Dialog({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 pt-[6vh] backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={cn(
          "w-full rounded-xl border border-border-strong bg-panel shadow-2xl",
          wide ? "max-w-3xl" : "max-w-xl"
        )}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <h2 className="text-sm font-semibold text-zinc-100">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted hover:bg-white/5 hover:text-zinc-200"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

// Tabs
export function Tabs({
  value,
  onChange,
  options,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 rounded-lg border border-border bg-panel-2 p-0.5",
        className
      )}
    >
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            value === o.value
              ? "bg-accent/15 text-blue-400"
              : "text-muted hover:text-zinc-200"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// Stat card
export function StatCard({
  label,
  value,
  sub,
  tone = "neutral",
  mono = true,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: "neutral" | "profit" | "loss" | "accent" | "warn";
  mono?: boolean;
}) {
  const tones = {
    neutral: "text-zinc-100",
    profit: "text-profit",
    loss: "text-loss",
    accent: "text-blue-400",
    warn: "text-warn",
  };
  return (
    <Card className="p-4">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">
        {label}
      </div>
      <div
        className={cn(
          "mt-1.5 text-xl font-bold tabular-nums",
          mono && "font-mono",
          tones[tone]
        )}
      >
        {value}
      </div>
      {sub != null && <div className="mt-1 text-xs text-muted">{sub}</div>}
    </Card>
  );
}

// Empty state
export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border-strong bg-panel/50 px-6 py-12 text-center">
      <div className="text-sm font-semibold text-zinc-200">{title}</div>
      {body && <div className="max-w-md text-xs text-muted">{body}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

// Page header
export function PageHeader({
  title,
  sub,
  actions,
}: {
  title: string;
  sub?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-zinc-50">{title}</h1>
        {sub && <p className="mt-1 text-[13px] text-muted">{sub}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

// Score bar (1-10)
export function ScoreBar({
  label,
  value,
  invert,
}: {
  label: string;
  value: number;
  invert?: boolean; // for risk: high = bad
}) {
  const good = invert ? value <= 4 : value >= 7;
  const bad = invert ? value >= 7 : value <= 3.5;
  const color = good ? "bg-profit" : bad ? "bg-loss" : "bg-warn";
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-muted">{label}</span>
        <span className="font-mono font-semibold text-zinc-200">
          {value.toFixed(1)}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
        <div
          className={cn("h-full rounded-full transition-all", color)}
          style={{ width: `${value * 10}%` }}
        />
      </div>
    </div>
  );
}

export function VerdictBadge({ verdict }: { verdict: "BET" | "LEAN" | "PASS" }) {
  return (
    <Badge
      variant={verdict === "BET" ? "profit" : verdict === "LEAN" ? "warn" : "muted"}
      className="px-2 py-1 text-xs"
    >
      {verdict}
    </Badge>
  );
}
