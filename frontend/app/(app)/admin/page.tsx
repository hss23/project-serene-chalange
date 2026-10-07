"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Check, Clock, GraduationCap, Handshake, History, Presentation, Shield, ShieldCheck, Sparkles, ToggleRight, type LucideIcon } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { Avatar, EmptyState, ErrorBanner, PageHeader, Skeleton, Spinner } from "@/components/ui";
import { describeAudit } from "@/lib/audit";
import type { AdminStats, AuditEntry, Features } from "@/lib/types";

function Stat({ icon: Icon, label, value, sub, href }: { icon: LucideIcon; label: string; value: number; sub: string; href: string }) {
  return (
    <Link href={href} className="card flex items-center gap-4 transition hover:-translate-y-0.5 hover:border-accent/30">
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-accent-soft text-accent-ink">
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <p className="text-2xl font-semibold tabular-nums text-fg">{value}</p>
        <p className="text-sm text-muted">{label}</p>
        <p className="text-xs text-subtle">{sub}</p>
      </div>
    </Link>
  );
}

export default function AdminHome() {
  const { api } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [audit, setAudit] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [approving, setApproving] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);

  async function toggleMentorship(enabled: boolean) {
    setToggling(true);
    try {
      const r = await api<{ features: Features }>("/api/admin/settings", {
        method: "PATCH",
        body: JSON.stringify({ feature: "mentorshipRequests", enabled }),
      });
      setStats((s) => (s ? { ...s, features: r.features } : s));
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setToggling(false);
    }
  }

  const load = useCallback(async () => {
    try {
      const [s, a] = await Promise.all([
        api<AdminStats>("/api/admin/stats"),
        api<{ entries: AuditEntry[] }>("/api/admin/audit?limit=8"),
      ]);
      setStats(s);
      setAudit(a.entries);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [api]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api<AdminStats>("/api/admin/stats"), api<{ entries: AuditEntry[] }>("/api/admin/audit?limit=8")])
      .then(([s, a]) => {
        if (cancelled) return;
        setStats(s);
        setAudit(a.entries);
      })
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [api]);

  async function approve(id: string) {
    setApproving(id);
    try {
      await api(`/api/admin/users/${id}`, { method: "PATCH", body: JSON.stringify({ status: "active" }) });
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setApproving(null);
    }
  }

  const total = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-8">
      <PageHeader icon={Shield} title="Admin overview" subtitle="Manage students and teachers, approve new teachers, and review admin activity." />
      {error && <ErrorBanner message={error} onRetry={load} />}

      {!stats ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-28" />)}
        </div>
      ) : (
        <section className="grid gap-4 sm:grid-cols-3">
          <Stat icon={GraduationCap} label="Students" value={total(stats.students)} sub={`${stats.students.suspended} suspended`} href="/admin/users?role=student" />
          <Stat icon={Presentation} label="Teachers" value={total(stats.teachers)} sub={`${stats.teachers.pending} pending · ${stats.teachers.suspended} suspended`} href="/admin/users?role=teacher" />
          <Stat icon={ShieldCheck} label="Admins" value={total(stats.admins)} sub={`${stats.noRole} users without a role`} href="/admin/users?role=admin" />
        </section>
      )}

      {stats && (
        <section className="card">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-ink">
                <ToggleRight className="h-5 w-5" />
              </span>
              <div>
                <p className="font-semibold text-fg">Mentorship requests</p>
                <p className="mt-0.5 max-w-xl text-sm text-muted">
                  When on, students can request a teacher from their matches and teachers accept or decline. Rules: one active
                  mentor per student, teachers&apos; capacity (max 4), at most 3 pending requests, and requests expire after 7 days.
                  Turning it off hides the feature; existing requests are kept.
                </p>
              </div>
            </div>
            <button
              role="switch"
              aria-checked={stats.features.mentorshipRequests}
              aria-label="Mentorship requests"
              disabled={toggling}
              onClick={() => toggleMentorship(!stats.features.mentorshipRequests)}
              className={`relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-50 ${stats.features.mentorshipRequests ? "brand-gradient" : "bg-line"}`}
            >
              <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${stats.features.mentorshipRequests ? "left-6" : "left-1"}`} />
            </button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <span className="chip"><Handshake className="h-3 w-3" /> {stats.mentorships.accepted} active</span>
            <span className="chip">{stats.mentorships.pending} pending</span>
            <span className="chip">{stats.mentorships.declined + stats.mentorships.cancelled + stats.mentorships.expired} closed without a match</span>
            <span className="chip">{stats.mentorships.ended} ended</span>
          </div>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <div className="mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4 text-subtle" />
            <h2 className="font-semibold text-fg">Teachers awaiting approval</h2>
          </div>
          {!stats ? (
            <Skeleton className="h-40" />
          ) : stats.pendingTeachers.length === 0 ? (
            <EmptyState icon={Check} title="Nothing to approve">New teacher sign-ups will appear here.</EmptyState>
          ) : (
            <ul className="card divide-y divide-line p-0">
              {stats.pendingTeachers.map((u) => (
                <li key={u.id} className="flex items-center gap-3 px-5 py-3">
                  <Avatar name={u.display_name ?? u.email ?? "?"} size="sm" />
                  <Link href={`/admin/users/${u.id}`} className="min-w-0 flex-1 hover:underline">
                    <p className="truncate text-sm font-medium text-fg">{u.display_name ?? "Unnamed"}</p>
                    <p className="truncate text-xs text-subtle">{u.email} · {u.profile ? "profile complete" : "no profile yet"}</p>
                  </Link>
                  <button className="btn-primary px-3 py-1.5 text-xs" disabled={approving === u.id} onClick={() => approve(u.id)}>
                    {approving === u.id ? <Spinner className="h-3 w-3" /> : <Check className="h-3.5 w-3.5" />} Approve
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <div className="mb-3 flex items-center gap-2">
            <History className="h-4 w-4 text-subtle" />
            <h2 className="font-semibold text-fg">Recent admin activity</h2>
            <span className="text-xs text-subtle">· Firestore audit log</span>
          </div>
          {!audit ? (
            <Skeleton className="h-40" />
          ) : audit.length === 0 ? (
            <EmptyState icon={History} title="No admin actions yet" />
          ) : (
            <ul className="card divide-y divide-line p-0 text-sm">
              {audit.map((a) => (
                <li key={a.id} className="px-5 py-3">
                  <p className="text-fg">{describeAudit(a)}</p>
                  <p className="text-xs text-subtle">{a.actorEmail} · {a.at ? new Date(a.at).toLocaleString() : ""}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="card flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="font-semibold text-fg">Run matching for any student</p>
          <p className="text-sm text-muted">Pick a student profile and see their ranked teachers with reasons.</p>
        </div>
        <Link href="/match" className="btn-primary"><Sparkles className="h-4 w-4" /> Open matching</Link>
      </section>
    </div>
  );
}
