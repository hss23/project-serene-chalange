"use client";

import { useState } from "react";
import { AlertTriangle, Bookmark, BookmarkCheck, Check, ChevronDown } from "lucide-react";
import type { MatchResult } from "@/lib/types";
import { Avatar, Bar, ScoreRing } from "./ui";

export function MatchCard({
  rank,
  result,
  saved,
  onToggleSave,
}: {
  rank: number;
  result: MatchResult;
  saved: boolean;
  onToggleSave: () => void;
}) {
  const [open, setOpen] = useState(rank === 1);
  const confidence = result.weak ? "Weak match" : result.score >= 75 ? "Strong match" : "Good match";
  const tone = result.weak ? "warn" : result.score >= 75 ? "success" : "accent";
  const badge = {
    warn: "bg-warn-soft text-warn",
    success: "bg-success-soft text-success",
    accent: "bg-accent-soft text-accent-ink",
  }[tone];

  return (
    <article
      className={`card animate-fade-up p-0 transition hover:border-accent/30 ${rank === 1 ? "ring-1 ring-accent/30" : ""}`}
      style={{ animationDelay: `${(rank - 1) * 60}ms` }}
    >
      <div className="flex flex-wrap items-center gap-4 p-5">
        <div className="relative">
          <Avatar name={result.mentorName} size="lg" />
          <span className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full border-2 border-surface bg-fg text-[11px] font-bold text-bg">
            {rank}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-semibold text-fg">{result.mentorName}</h3>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${badge}`}>{confidence}</span>
          </div>
          <p className="truncate text-sm text-muted">{result.headline}</p>
        </div>
        <ScoreRing score={result.score} weak={result.weak} />
        <button
          onClick={onToggleSave}
          aria-pressed={saved}
          aria-label={saved ? "Remove from saved" : "Save match"}
          title={saved ? "Saved" : "Save"}
          className={`btn h-10 w-10 shrink-0 rounded-xl border p-0 ${
            saved ? "border-accent/40 bg-accent-soft text-accent-ink" : "border-line bg-surface text-muted hover:text-fg"
          }`}
        >
          {saved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
        </button>
      </div>

      <div className="border-t border-line px-5 py-4">
        <ul className="grid gap-2 text-sm sm:grid-cols-2">
          {result.reasons.map((r) => (
            <li key={r} className="flex gap-2 text-fg">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
              <span>{r}</span>
            </li>
          ))}
          {result.caveats.slice(0, 2).map((c) => (
            <li key={c} className="flex gap-2 text-muted">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warn" />
              <span>{c}</span>
            </li>
          ))}
        </ul>
      </div>

      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between border-t border-line px-5 py-3 text-xs font-medium text-muted transition hover:text-fg"
      >
        Score breakdown
        <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="space-y-3 px-5 pb-5">
          {result.breakdown.map((c) => (
            <div key={c.key} className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-xs sm:grid-cols-[150px_1fr_72px] sm:items-center">
              <span className="font-medium text-fg">
                {c.label} <span className="font-normal text-subtle">· {Math.round(c.weight * 100)}%</span>
              </span>
              <span className="text-right font-semibold tabular-nums text-fg sm:order-last">
                {(c.contribution * 100).toFixed(1)} <span className="font-normal text-subtle">pts</span>
              </span>
              <div className="col-span-2 sm:col-span-1">
                <Bar value={c.score} tone={c.score >= 0.75 ? "success" : c.score >= 0.5 ? "accent" : "warn"} />
                <p className="mt-1 text-subtle">{c.specified ? c.detail : `${c.detail} (neutral)`}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}
