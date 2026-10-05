"use client";

import { useEffect, useState } from "react";
import { Info } from "lucide-react";
import { apiUrl } from "@/lib/api";
import type { ComponentKey, ScoringMethod } from "@/lib/types";
import { Skeleton } from "./ui";

const HOW: Record<ComponentKey, string> = {
  skills: "Share of your goal skills the mentor covers, weighted by priority and mentor proficiency.",
  availability: "Share of your time slots the mentor also offers.",
  experience: "Full marks at or above the years you want, proportional below.",
  timezone: "Full marks in the same timezone, falling to zero at 8+ hours apart.",
  industry: "Full marks when you work in the same industry.",
  format: "Half for a compatible session format, half for a shared language.",
};

// The weights come from the backend (GET /api/scoring-method), so the explanation can't drift from the scorer.
export function ScoringExplainer() {
  const [method, setMethod] = useState<ScoringMethod | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(apiUrl("/api/scoring-method"))
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((m: ScoringMethod) => !cancelled && setMethod(m))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const maxWeight = method ? Math.max(...Object.values(method.weights)) : 1;

  return (
    <details className="card group" open>
      <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold text-fg">
        <Info className="h-4 w-4 text-accent-ink" /> How scoring works
        <span className="ml-auto text-xs font-normal text-subtle group-open:hidden">Show</span>
      </summary>
      <p className="mt-3 text-sm text-muted">
        A fixed formula with no AI and no randomness: the same profile always gives the same ranking. Ties are broken
        alphabetically by mentor id.
      </p>
      {failed ? (
        <p className="mt-4 text-sm text-subtle">Couldn&apos;t load the factor weights right now.</p>
      ) : !method ? (
        <Skeleton className="mt-4 h-48" />
      ) : (
        <>
          <ul className="mt-4 space-y-3.5">
            {(Object.keys(method.weights) as ComponentKey[]).map((k) => (
              <li key={k}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-fg">{method.labels[k]}</span>
                  <span className="tabular-nums text-muted">{Math.round(method.weights[k] * 100)}%</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-accent to-accent-2"
                    style={{ width: `${(method.weights[k] / maxWeight) * 100}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-subtle">{HOW[k]}</p>
              </li>
            ))}
          </ul>
          <p className="mt-4 rounded-xl bg-surface-2 p-3 text-xs text-muted">
            Scores below {method.weakThreshold} are labelled weak matches. Factors with no stated preference score as
            neutral.
          </p>
        </>
      )}
    </details>
  );
}
