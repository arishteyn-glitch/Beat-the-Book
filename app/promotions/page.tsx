"use client";

// ── Promotion Optimizer: squeeze every dollar of EV from the books ───
import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { Promotion, PROMO_TYPES, SPORTSBOOKS } from "@/lib/types";
import { analyzePromotion, bonusBetConversion } from "@/lib/promo";
import { fmtOdds } from "@/lib/odds";
import { fmtDate, fmtMoney, fmtPct, uid } from "@/lib/utils";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
} from "@/components/ui/primitives";
import { Gift, Plus, Trash2 } from "lucide-react";

export default function PromotionsPage() {
  const { db, ready, upsertPromotion, deletePromotion } = useStore();
  const [form, setForm] = useState({
    sportsbook: "FanDuel",
    promoType: "Profit Boost",
    description: "",
    boostPct: "30",
    maxStake: "25",
    minOdds: "",
    expiration: "",
    eligibleMarkets: "",
  });
  const [calcOdds, setCalcOdds] = useState(200);
  const [calcProb, setCalcProb] = useState("");

  const analysis = useMemo(() => {
    return analyzePromotion({
      promoType: form.promoType as Promotion["promoType"],
      maxStake: +form.maxStake || 25,
      odds: calcOdds || 150,
      boostPct: form.boostPct === "" ? null : +form.boostPct,
      trueProb: calcProb === "" ? null : +calcProb / 100,
    });
  }, [form.promoType, form.maxStake, form.boostPct, calcOdds, calcProb]);

  if (!ready) return null;
  const cur = db.settings.currency;

  const save = () => {
    upsertPromotion({
      id: uid(),
      sportsbook: form.sportsbook as Promotion["sportsbook"],
      promoType: form.promoType as Promotion["promoType"],
      description: form.description,
      boostPct: form.boostPct === "" ? null : +form.boostPct,
      maxStake: form.maxStake === "" ? null : +form.maxStake,
      minOdds: form.minOdds === "" ? null : +form.minOdds,
      expiration: form.expiration || null,
      eligibleMarkets: form.eligibleMarkets,
      status: "active",
      createdAt: new Date().toISOString(),
    });
    setForm({ ...form, description: "" });
  };

  const setStatus = (p: Promotion, status: Promotion["status"]) =>
    upsertPromotion({ ...p, status });

  const groups: { label: string; status: Promotion["status"] }[] = [
    { label: "Active", status: "active" },
    { label: "Used", status: "used" },
    { label: "Expired", status: "expired" },
  ];

  const isBoost = form.promoType.includes("Boost");

  return (
    <div className="space-y-5">
      <PageHeader
        title="Promotion Optimizer"
        sub="FanDuel and DraftKings give away real EV every week. Capture it systematically."
      />

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Input + calculator */}
        <Card>
          <CardHeader>
            <CardTitle>Log a promotion</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Sportsbook">
                <Select
                  value={form.sportsbook}
                  onChange={(e) => setForm({ ...form, sportsbook: e.target.value })}
                >
                  {SPORTSBOOKS.map((s) => <option key={s}>{s}</option>)}
                </Select>
              </Field>
              <Field label="Promotion type">
                <Select
                  value={form.promoType}
                  onChange={(e) => setForm({ ...form, promoType: e.target.value })}
                >
                  {PROMO_TYPES.filter((p) => p !== "None").map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="Description">
              <Input
                placeholder="30% profit boost, any NBA market"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </Field>
            <div className="grid grid-cols-3 gap-3">
              {isBoost && (
                <Field label="Boost %">
                  <Input
                    type="number"
                    value={form.boostPct}
                    onChange={(e) => setForm({ ...form, boostPct: e.target.value })}
                  />
                </Field>
              )}
              <Field label="Max stake ($)">
                <Input
                  type="number"
                  value={form.maxStake}
                  onChange={(e) => setForm({ ...form, maxStake: e.target.value })}
                />
              </Field>
              <Field label="Min odds (e.g. 200)">
                <Input
                  type="number"
                  placeholder="none"
                  value={form.minOdds}
                  onChange={(e) => setForm({ ...form, minOdds: e.target.value })}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Expiration">
                <Input
                  type="date"
                  value={form.expiration}
                  onChange={(e) => setForm({ ...form, expiration: e.target.value })}
                />
              </Field>
              <Field label="Eligible markets">
                <Input
                  placeholder="NBA SGP, min 3 legs…"
                  value={form.eligibleMarkets}
                  onChange={(e) => setForm({ ...form, eligibleMarkets: e.target.value })}
                />
              </Field>
            </div>
            <Button onClick={save} className="w-full">
              <Plus size={15} /> Save to promotion library
            </Button>
          </CardContent>
        </Card>

        {/* EV analysis */}
        <Card>
          <CardHeader>
            <CardTitle>Optimal use analysis</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Odds you plan to use it at">
                <Input
                  type="number"
                  value={calcOdds || ""}
                  onChange={(e) => setCalcOdds(+e.target.value || 0)}
                />
              </Field>
              <Field label="Your est. win % (optional)">
                <Input
                  type="number"
                  placeholder="fair odds assumed"
                  value={calcProb}
                  onChange={(e) => setCalcProb(e.target.value)}
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-profit/25 bg-profit/8 p-3">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                  Estimated EV
                </div>
                <div className="mt-1 font-mono text-xl font-bold text-profit">
                  {fmtMoney(analysis.estEvDollars, cur, { sign: true })}
                </div>
                <div className="text-[11px] text-muted">
                  {fmtPct(analysis.estEvPct, { sign: true })} of max stake
                </div>
              </div>
              <div className="rounded-lg border border-border bg-panel-2/60 p-3">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                  Optimal stake
                </div>
                <div className="mt-1 font-mono text-xl font-bold text-zinc-100">
                  {fmtMoney(analysis.optimalStake, cur)}
                </div>
                <div className="text-[11px] text-muted">
                  Promos are +EV — always use the max
                </div>
              </div>
            </div>

            {form.promoType === "Bonus Bet" && (
              <div className="rounded-lg border border-border bg-panel-2/60 p-3 text-xs text-zinc-300">
                Conversion at {fmtOdds(calcOdds)}:{" "}
                <span className="font-mono font-bold text-profit">
                  {(bonusBetConversion(calcOdds || 150) * 100).toFixed(0)}%
                </span>{" "}
                of face value (fair odds assumed).
              </div>
            )}

            <InfoBlock label="Best use" body={analysis.bestUse} tone="profit" />
            <InfoBlock label="Risk" body={analysis.risk} tone="warn" />
            <div>
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">
                Alternative uses
              </div>
              <ul className="space-y-1 text-[13px] text-zinc-300">
                {analysis.alternatives.map((a, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-blue-400">▸</span> {a}
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Library */}
      {db.promotions.length === 0 ? (
        <EmptyState
          title="No promotions logged yet"
          body="Every boost, bonus bet, and no-sweat token you let expire is EV left on the table. Log them as you get them."
        />
      ) : (
        groups.map(({ label, status }) => {
          const items = db.promotions
            .filter((p) => p.status === status)
            .sort((a, b) => (a.expiration ?? "9999").localeCompare(b.expiration ?? "9999"));
          if (!items.length) return null;
          return (
            <Card key={status}>
              <CardHeader>
                <CardTitle>
                  {label} ({items.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {items.map((p) => (
                  <div
                    key={p.id}
                    className="rounded-lg border border-border/60 bg-panel-2/50 p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <Gift size={13} className="text-violet" />
                        <Badge variant="violet">{p.promoType}</Badge>
                      </div>
                      <span className="text-[11px] text-muted">{p.sportsbook}</span>
                    </div>
                    <div className="mt-1.5 text-[13px] font-medium text-zinc-200">
                      {p.description || p.promoType}
                    </div>
                    <div className="mt-1 text-[11px] text-muted">
                      {p.boostPct ? `+${p.boostPct}% · ` : ""}
                      {p.maxStake ? `max ${fmtMoney(p.maxStake, cur, { decimals: 0 })} · ` : ""}
                      {p.minOdds ? `min ${fmtOdds(p.minOdds)} · ` : ""}
                      {p.expiration ? `expires ${fmtDate(p.expiration)}` : "no expiry"}
                    </div>
                    <div className="mt-2 flex gap-1.5">
                      {status === "active" && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => setStatus(p, "used")}>
                            Mark used
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setStatus(p, "expired")}>
                            Expired
                          </Button>
                        </>
                      )}
                      {status !== "active" && (
                        <Button size="sm" variant="ghost" onClick={() => setStatus(p, "active")}>
                          Reactivate
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="ml-auto text-muted hover:text-loss"
                        onClick={() => deletePromotion(p.id)}
                      >
                        <Trash2 size={13} />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}

function InfoBlock({
  label,
  body,
  tone,
}: {
  label: string;
  body: string;
  tone: "profit" | "warn";
}) {
  return (
    <div>
      <div
        className={`mb-1 text-[11px] font-semibold uppercase tracking-wider ${
          tone === "profit" ? "text-profit" : "text-warn"
        }`}
      >
        {label}
      </div>
      <p className="text-[13px] leading-relaxed text-zinc-300">{body}</p>
    </div>
  );
}
