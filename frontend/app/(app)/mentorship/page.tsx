"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Clock, Handshake, History, Mail, Sparkles, X } from "lucide-react";
import { ApiError, useAuth } from "@/components/AuthProvider";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Avatar, EmptyState, ErrorBanner, InfoBanner, PageHeader, Skeleton } from "@/components/ui";
import { useFeatures } from "@/lib/hooks/useFeatures";
import type { MentorshipList, MentorshipStatus, StudentMentorshipRequest } from "@/lib/types";

const STATUS_LABEL: Record<MentorshipStatus, string> = {
  pending: "Pending",
  accepted: "Active",
  declined: "Declined",
  cancelled: "Cancelled",
  expired: "Expired (no reply in 7 days)",
  ended: "Ended",
};

export default function MentorshipPage() {
  const { api } = useAuth();
  const { features } = useFeatures();
  const [requests, setRequests] = useState<StudentMentorshipRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmEnd, setConfirmEnd] = useState<StudentMentorshipRequest | null>(null);
  const [now] = useState(() => Date.now()); // fixed per visit; used for "days left"

  const load = useCallback(async () => {
    try {
      const r = await api<MentorshipList>("/api/mentorships");
      setRequests(r.role === "student" ? r.requests : []);
      setError(null);
    } catch (e) {
      if ((e as ApiError).code !== "feature_disabled") setError((e as Error).message);
    }
  }, [api]);

  useEffect(() => {
    if (!features?.mentorshipRequests) return;
    let cancelled = false;
    api<MentorshipList>("/api/mentorships")
      .then((r) => !cancelled && setRequests(r.role === "student" ? r.requests : []))
      .catch((e: ApiError) => !cancelled && e.code !== "feature_disabled" && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [api, features]);

  async function act(id: string, action: "cancel" | "end") {
    setBusy(id);
    try {
      await api(`/api/mentorships/${id}/${action}`, { method: "POST" });
      setConfirmEnd(null);
      await load();
    } catch (e) {
      setError((e as Error).message);
      setConfirmEnd(null);
    } finally {
      setBusy(null);
    }
  }

  if (features && !features.mentorshipRequests) {
    return (
      <div className="mx-auto max-w-xl">
        <PageHeader icon={Handshake} title="Mentorship" />
        <InfoBanner>Mentorship requests aren&apos;t enabled right now. An admin can turn them on.</InfoBanner>
      </div>
    );
  }

  const active = requests?.find((r) => r.status === "accepted") ?? null;
  const pending = requests?.filter((r) => r.status === "pending") ?? [];
  const past = requests?.filter((r) => !["pending", "accepted"].includes(r.status)) ?? [];

  return (
    <div className="space-y-8">
      <PageHeader icon={Handshake} title="Mentorship" subtitle="Your mentor and the requests you've sent. Teachers have 7 days to respond." />
      {error && <ErrorBanner message={error} onRetry={load} />}

      {!requests ? (
        <Skeleton className="h-48" />
      ) : (
        <>
          <section>
            <p className="eyebrow mb-3">Your mentor</p>
            {active ? (
              <div className="card flex flex-wrap items-center gap-4">
                <Avatar name={active.mentor?.name ?? "?"} size="lg" />
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-semibold text-fg">{active.mentor?.name}</p>
                  <p className="text-sm text-muted">{active.mentor?.headline}</p>
                  {active.mentorEmail && (
                    <a href={`mailto:${active.mentorEmail}`} className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-accent-ink hover:underline">
                      <Mail className="h-3.5 w-3.5" /> {active.mentorEmail}
                    </a>
                  )}
                  <p className="mt-1 text-xs text-subtle">
                    Since {active.responded_at ? new Date(active.responded_at).toLocaleDateString() : "—"} · match score {active.score ?? "—"}
                  </p>
                </div>
                <button className="btn-secondary text-danger" disabled={busy === active.id} onClick={() => setConfirmEnd(active)}>
                  End mentorship
                </button>
              </div>
            ) : (
              <EmptyState icon={Sparkles} title="No mentor yet">
                <Link href="/match" className="font-medium text-accent-ink hover:underline">Open your matches</Link> and press “Request mentorship” on a teacher.
              </EmptyState>
            )}
          </section>

          <section>
            <p className="eyebrow mb-3 flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> Pending requests ({pending.length}/3)</p>
            {pending.length === 0 ? (
              <p className="text-sm text-subtle">No pending requests.</p>
            ) : (
              <ul className="card divide-y divide-line p-0">
                {pending.map((r) => {
                  const days = Math.max(0, Math.ceil(7 - (now - new Date(r.created_at).getTime()) / 86_400_000));
                  return (
                    <li key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                      <Avatar name={r.mentor?.name ?? "?"} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-fg">{r.mentor?.name}</p>
                        <p className="text-xs text-subtle">Sent {new Date(r.created_at).toLocaleDateString()} · {days} day{days === 1 ? "" : "s"} left for a reply</p>
                      </div>
                      <button className="btn-ghost px-2 py-1 text-xs" disabled={busy === r.id} onClick={() => act(r.id, "cancel")}>
                        <X className="h-4 w-4" /> Cancel
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {past.length > 0 && (
            <section>
              <p className="eyebrow mb-3 flex items-center gap-1.5"><History className="h-3.5 w-3.5" /> History</p>
              <ul className="card divide-y divide-line p-0 text-sm">
                {past.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                    <span className="text-fg">{r.mentor?.name}</span>
                    <span className="text-xs text-subtle">
                      {STATUS_LABEL[r.status]} · {new Date(r.responded_at ?? r.ended_at ?? r.created_at).toLocaleDateString()}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <ConfirmDialog
        open={!!confirmEnd}
        danger
        busy={!!busy}
        title="End this mentorship?"
        confirmLabel="End mentorship"
        onCancel={() => setConfirmEnd(null)}
        onConfirm={() => confirmEnd && act(confirmEnd.id, "end")}
      >
        You and <b>{confirmEnd?.mentor?.name}</b> will no longer be paired, and you can request a new mentor.
      </ConfirmDialog>
    </div>
  );
}
