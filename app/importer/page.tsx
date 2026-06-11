"use client";

// ── Bet Slip Importer: screenshot → tracked bet ──────────────────────
import { useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { Bet } from "@/lib/types";
import { fmtOdds } from "@/lib/odds";
import { todayISO, uid } from "@/lib/utils";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  PageHeader,
} from "@/components/ui/primitives";
import { BetFormDialog, emptyBet } from "@/components/bets/bet-form";
import { Check, Image as ImageIcon, Loader2, Plus, ScanLine, Upload, X } from "lucide-react";

interface ExtractedBet {
  sportsbook: string; sport: string; league: string; event: string;
  betType: string; market: string; selection: string; odds: number;
  stake: number; potentialPayout: number; promotionUsed: boolean;
  promotionType: string; date: string; status: string;
}

interface Job {
  id: string;
  fileName: string;
  previewUrl: string;
  state: "queued" | "extracting" | "done" | "error";
  error?: string;
  confidence?: number;
  needsReview?: boolean;
  sportsbookDetected?: string;
  bets?: ExtractedBet[];
  importedIdx: Set<number>;
}

export default function ImporterPage() {
  const { ready, upsertBet } = useStore();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [reviewBet, setReviewBet] = useState<Bet | null>(null);
  const [reviewJob, setReviewJob] = useState<{ jobId: string; idx: number } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const processing = useRef(false);

  const enqueueFiles = useCallback((files: FileList | File[]) => {
    const imgs = [...files].filter((f) => f.type.startsWith("image/"));
    const newJobs: Job[] = imgs.map((f) => ({
      id: uid(),
      fileName: f.name || "pasted-image.png",
      previewUrl: URL.createObjectURL(f),
      state: "queued",
      importedIdx: new Set(),
    }));
    setJobs((j) => [...newJobs, ...j]);
    newJobs.forEach((job, i) => void runExtraction(job.id, imgs[i]));
  }, []);

  const runExtraction = async (jobId: string, file: File) => {
    // serialize requests so we don't hammer the API with parallel uploads
    while (processing.current) await new Promise((r) => setTimeout(r, 250));
    processing.current = true;
    setJobs((js) => js.map((j) => (j.id === jobId ? { ...j, state: "extracting" } : j)));
    try {
      const dataUrl: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: dataUrl, mediaType: file.type }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Extraction failed (${res.status})`);
      setJobs((js) =>
        js.map((j) =>
          j.id === jobId
            ? {
                ...j,
                state: "done",
                confidence: data.confidence,
                needsReview: data.needsReview,
                sportsbookDetected: data.sportsbookDetected,
                bets: data.bets,
              }
            : j
        )
      );
    } catch (e: any) {
      setJobs((js) =>
        js.map((j) =>
          j.id === jobId ? { ...j, state: "error", error: e?.message ?? "Failed" } : j
        )
      );
    } finally {
      processing.current = false;
    }
  };

  // Paste handler (Ctrl+V anywhere on the page)
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = [...(e.clipboardData?.items ?? [])]
        .filter((i) => i.type.startsWith("image/"))
        .map((i) => i.getAsFile())
        .filter((f): f is File => !!f);
      if (files.length) enqueueFiles(files);
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [enqueueFiles]);

  if (!ready) return null;

  const toBet = (x: ExtractedBet): Bet =>
    emptyBet({
      id: uid(),
      date: /^\d{4}-\d{2}-\d{2}$/.test(x.date) ? x.date : todayISO(),
      sport: (x.sport as Bet["sport"]) || "Other",
      league: x.league ?? "",
      event: x.event ?? "",
      sportsbook: (x.sportsbook as Bet["sportsbook"]) || "Other",
      betType: (x.betType as Bet["betType"]) || "Straight",
      market: (x.market as Bet["market"]) || "Other",
      selection: x.selection ?? "",
      odds: Number(x.odds) || -110,
      stake: Number(x.stake) || 0,
      potentialPayout: Number(x.potentialPayout) || 0,
      promotionUsed: !!x.promotionUsed,
      promotionType: (x.promotionType as Bet["promotionType"]) || "None",
      status: (x.status as Bet["status"]) || "pending",
      notes: "Imported from bet slip screenshot",
    });

  const markImported = (jobId: string, idx: number) =>
    setJobs((js) =>
      js.map((j) =>
        j.id === jobId ? { ...j, importedIdx: new Set([...j.importedIdx, idx]) } : j
      )
    );

  const quickImport = (job: Job, idx: number) => {
    const bet = toBet(job.bets![idx]);
    if (job.needsReview) {
      // confidence below 90 — force manual review before import
      setReviewBet(bet);
      setReviewJob({ jobId: job.id, idx });
    } else {
      upsertBet(bet);
      markImported(job.id, idx);
    }
  };

  const openReview = (job: Job, idx: number) => {
    setReviewBet(toBet(job.bets![idx]));
    setReviewJob({ jobId: job.id, idx });
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Bet Slip Importer"
        sub="Drop FanDuel or DraftKings screenshots — AI extracts the bets. Below 90% confidence, you review before import."
        actions={
          <Button variant="outline" onClick={() => { setReviewBet(emptyBet()); setReviewJob(null); }}>
            <Plus size={15} /> Add manually
          </Button>
        }
      />

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          enqueueFiles(e.dataTransfer.files);
        }}
        onClick={() => fileInput.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors ${
          dragOver
            ? "border-accent bg-accent/8"
            : "border-border-strong bg-panel/50 hover:border-accent/50"
        }`}
      >
        <ScanLine size={28} className="text-blue-400" />
        <div className="text-sm font-semibold text-zinc-200">
          Drop screenshots here, click to browse, or paste (Ctrl+V)
        </div>
        <div className="text-xs text-muted">
          PNG, JPEG, WebP · multiple uploads supported · FanDuel & DraftKings layouts
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) enqueueFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {/* Jobs */}
      {jobs.map((job) => (
        <Card key={job.id}>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 normal-case tracking-normal">
              <ImageIcon size={13} /> {job.fileName}
            </CardTitle>
            <div className="flex items-center gap-2">
              {job.state === "extracting" && (
                <Badge variant="accent">
                  <Loader2 size={11} className="animate-spin" /> Extracting…
                </Badge>
              )}
              {job.state === "queued" && <Badge variant="muted">Queued</Badge>}
              {job.state === "error" && <Badge variant="loss">Failed</Badge>}
              {job.state === "done" && (
                <>
                  {job.sportsbookDetected && job.sportsbookDetected !== "Unknown" && (
                    <Badge variant="muted">{job.sportsbookDetected}</Badge>
                  )}
                  <Badge variant={job.needsReview ? "warn" : "profit"}>
                    {job.confidence}% confidence
                    {job.needsReview ? " — review required" : ""}
                  </Badge>
                </>
              )}
              <button
                onClick={() => setJobs((js) => js.filter((j) => j.id !== job.id))}
                className="rounded-md p-1 text-muted hover:bg-white/5 hover:text-zinc-200"
                aria-label="Remove"
              >
                <X size={14} />
              </button>
            </div>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={job.previewUrl}
              alt="Bet slip preview"
              className="h-40 rounded-lg border border-border object-contain"
            />
            <div className="min-w-[260px] flex-1 space-y-2">
              {job.state === "error" && (
                <div className="rounded-lg border border-loss/30 bg-loss/8 p-3 text-xs leading-relaxed text-zinc-300">
                  {job.error}
                  <div className="mt-2">
                    <Button size="sm" variant="outline" onClick={() => { setReviewBet(emptyBet()); setReviewJob(null); }}>
                      Enter manually instead
                    </Button>
                  </div>
                </div>
              )}
              {job.state === "done" && (job.bets?.length ?? 0) === 0 && (
                <p className="text-xs text-muted">No bets detected in this image.</p>
              )}
              {job.state === "done" &&
                job.bets?.map((b, idx) => {
                  const imported = job.importedIdx.has(idx);
                  return (
                    <div
                      key={idx}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-panel-2/50 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-medium text-zinc-200">
                          {b.selection || b.market}
                        </div>
                        <div className="truncate text-[11px] text-muted">
                          {b.sport} · {b.event || "event n/a"} · {fmtOdds(b.odds)} · $
                          {b.stake}
                          {b.promotionUsed ? ` · ${b.promotionType}` : ""}
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-1.5">
                        {imported ? (
                          <Badge variant="profit">
                            <Check size={11} /> Imported
                          </Badge>
                        ) : (
                          <>
                            <Button size="sm" variant="outline" onClick={() => openReview(job, idx)}>
                              Review
                            </Button>
                            <Button
                              size="sm"
                              variant={job.needsReview ? "outline" : "success"}
                              onClick={() => quickImport(job, idx)}
                              title={
                                job.needsReview
                                  ? "Confidence below 90% — review required"
                                  : "Import to Bet Tracker"
                              }
                            >
                              <Upload size={13} />
                              {job.needsReview ? "Review & import" : "Import"}
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      ))}

      <BetFormDialog
        open={reviewBet != null}
        onClose={() => { setReviewBet(null); setReviewJob(null); }}
        onSave={(b) => {
          upsertBet(b);
          if (reviewJob) markImported(reviewJob.jobId, reviewJob.idx);
        }}
        initial={reviewBet}
        title={reviewJob ? "Review extracted bet" : "Add bet manually"}
      />
    </div>
  );
}
