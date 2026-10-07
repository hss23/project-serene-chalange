"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Handshake, Inbox, Mail, X } from "lucide-react";
import { ApiError, useAuth } from "./AuthProvider";
import { ConfirmDialog } from "./ConfirmDialog";
import { Avatar, ErrorBanner, Skeleton } from "./ui";
import type { MentorshipList, TeacherMentorshipRequest } from "@/lib/types";

/** Teacher view of mentorship requests (rendered only when the feature is enabled). */
export function TeacherMentorshipPanel() {
  const { api } = useAuth();
  const [data, setData] = useState<{ requests: TeacherMentorshipRequest[]; capacity: { used: number; max: number } } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmEnd, setConfirmEnd] = useState<TeacherMentorshipRequest | null>(null);

  const apply = (r: MentorshipList) => r.role === "teacher" && setData({ requests: r.requests, capacity: r.capacity });

  const load = useCallback(async () => {
    try {
      apply(await api<MentorshipList>("/api/mentorships"));
      setError(null);
    } catch (e) {
      if ((e as ApiError).code !== "feature_disabled") setError((e as Error).message);
    }
  }, [api]);

  useEffect(() => {
    let cancelled = false;
    api<MentorshipList>("/api/mentorships")
      .then((r) => !cancelled && apply(r))
      .catch((e: ApiError) => !cancelled && e.code !== "feature_disabled" && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [api]);

  async function act(r: TeacherMentorshipRequest, action: "accept" | "decline" | "end") {
    setBusy(r.id);
    setError(null);
    setNotice(null);
    try {
      await api(`/api/mentorships/${r.id}/${action}`, { method: "POST" });
      setNotice(
        action === "accept" ? `You're now mentoring ${r.mentee?.name}.` : action === "decline" ? `Declined ${r.mentee?.name}'s request.` : `Ended the mentorship with ${r.mentee?.name}.`,
      );
      setConfirmEnd(null);
      await load();
    } catch (e) {
      setError((e as Error).message);
      setConfirmEnd(null);
    } finally {
      setBusy(null);
    }
  }

  if (!data && !error) return <Skeleton className="h-40" />;
  const pending = data?.requests.filter((r) => r.status === "pending") ?? [];
  const active = data?.requests.filter((r) => r.status === "accepted") ?? [];
  const cap = data?.capacity ?? { used: 0, max: 0 };
  const full = cap.used >= cap.max;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Handshake className="h-4 w-4 text-subtle" />
          <h2 className="font-semibold text-fg">Mentorship</h2>
        </div>
        <div className="flex min-w-48 items-center gap-3 text-xs text-muted">
          <span>{cap.used} of {cap.max} spots used</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
            <div className={`h-full rounded-full ${full ? "bg-warn" : "bg-success"}`} style={{ width: `${cap.max ? (cap.used / cap.max) * 100 : 0}%` }} />
          </div>
        </div>
      </div>
      {notice && <div className="rounded-2xl border border-success/20 bg-success-soft p-4 text-sm text-success">{notice}</div>}
      {error && <ErrorBanner message={error} onRetry={load} />}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <p className="eyebrow mb-3 flex items-center gap-1.5"><Inbox className="h-3.5 w-3.5" /> Requests ({pending.length})</p>
          {pending.length === 0 ? (
            <p className="text-sm text-subtle">No pending requests.</p>
          ) : (
            <ul className="space-y-3">
              {pending.map((r) => (
                <li key={r.id} className="rounded-xl border border-line p-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={r.mentee?.name ?? "?"} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-fg">{r.mentee?.name} <span className="font-normal text-subtle">· {r.mentee?.careerStage}</span></p>
                      <p className="text-xs text-subtle">Match {r.score ?? "—"} · {r.daysLeft} day{r.daysLeft === 1 ? "" : "s"} left to reply</p>
                    </div>
                  </div>
                  {r.message && <p className="mt-2 rounded-lg bg-surface-2 p-2 text-sm text-fg">“{r.message}”</p>}
                  {!r.message && r.mentee?.goalSummary && <p className="mt-2 line-clamp-2 text-xs text-muted">{r.mentee.goalSummary}</p>}
                  <div className="mt-3 flex justify-end gap-2">
                    <button className="btn-secondary px-3 py-1.5 text-xs" disabled={busy === r.id} onClick={() => act(r, "decline")}>
                      <X className="h-3.5 w-3.5" /> Decline
                    </button>
                    <button
                      className="btn-primary px-3 py-1.5 text-xs"
                      disabled={busy === r.id || full}
                      title={full ? "You're at capacity" : undefined}
                      onClick={() => act(r, "accept")}
                    >
                      <Check className="h-3.5 w-3.5" /> Accept
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {full && pending.length > 0 && (
            <p className="mt-3 text-xs text-warn">You&apos;re at capacity. Raise your limit in your profile (max 4) or end a mentorship to accept more.</p>
          )}
        </div>

        <div className="card">
          <p className="eyebrow mb-3">My students ({active.length})</p>
          {active.length === 0 ? (
            <p className="text-sm text-subtle">No active mentorships yet.</p>
          ) : (
            <ul className="space-y-2">
              {active.map((r) => (
                <li key={r.id} className="flex items-center gap-3 rounded-xl border border-line p-3">
                  <Avatar name={r.mentee?.name ?? "?"} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-fg">{r.mentee?.name}</p>
                    {r.menteeEmail && (
                      <a href={`mailto:${r.menteeEmail}`} className="inline-flex items-center gap-1 text-xs text-accent-ink hover:underline">
                        <Mail className="h-3 w-3" /> {r.menteeEmail}
                      </a>
                    )}
                  </div>
                  <button className="btn-ghost px-2 py-1 text-xs text-danger" disabled={busy === r.id} onClick={() => setConfirmEnd(r)}>
                    End
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!confirmEnd}
        danger
        busy={!!busy}
        title="End this mentorship?"
        confirmLabel="End mentorship"
        onCancel={() => setConfirmEnd(null)}
        onConfirm={() => confirmEnd && act(confirmEnd, "end")}
      >
        <b>{confirmEnd?.mentee?.name}</b> will be free to request another mentor, and a spot opens up for you.
      </ConfirmDialog>
    </section>
  );
}
