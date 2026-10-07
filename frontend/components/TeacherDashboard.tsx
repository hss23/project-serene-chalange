"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, Check, Clock, GraduationCap, MessageSquareText, Pencil } from "lucide-react";
import { useFeatures } from "@/lib/hooks/useFeatures";
import { useAuth } from "./AuthProvider";
import { TeacherMentorshipPanel } from "./TeacherMentorshipPanel";
import { Avatar, EmptyState, ErrorBanner, InfoBanner, ScoreRing, Skeleton } from "./ui";
import type { OwnedMentor, StudentMatchesResponse } from "@/lib/types";

/** Teacher home: approval status, profile summary, and the students this teacher fits best. */
export function TeacherDashboard() {
  const { me, api } = useAuth();
  const { features } = useFeatures();
  const [data, setData] = useState<StudentMatchesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api<StudentMatchesResponse>("/api/match/students")
      .then((r) => !cancelled && setData(r))
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [api, reloadKey]);

  if (!me) return null;
  const profile = me.profile as OwnedMentor | null;
  const pending = me.user.status === "pending";

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl brand-gradient p-7 text-white sm:p-9">
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/15 blur-2xl" />
        <p className="relative text-sm text-white/80">Teacher dashboard</p>
        <h1 className="relative mt-1 text-3xl font-semibold tracking-tight">Welcome back, {me.user.displayName ?? "teacher"}</h1>
        <p className="relative mt-2 max-w-lg text-sm text-white/85">
          {profile?.headline ?? "Complete your profile so students can be matched to you."}
        </p>
        <div className="relative mt-6 flex flex-wrap gap-3">
          <Link href="/profile" className="btn bg-white text-[#3f3fd1] shadow-sm hover:bg-white/90">
            <Pencil className="h-4 w-4" /> Edit profile
          </Link>
          <Link href="/chat" className="btn border border-white/30 bg-white/10 text-white hover:bg-white/20">
            <MessageSquareText className="h-4 w-4" /> Ask the assistant
          </Link>
        </div>
      </section>

      {pending && (
        <InfoBanner>
          <span className="flex items-center gap-2 font-medium"><Clock className="h-4 w-4" /> Awaiting admin approval</span>
          Students won&apos;t see you in their matches until an admin approves your account. You can still see which students
          you&apos;d fit best below.
        </InfoBanner>
      )}

      {features?.mentorshipRequests && <TeacherMentorshipPanel />}

      {profile && (
        <section className="card">
          <p className="eyebrow mb-3">Your skills</p>
          <div className="flex flex-wrap gap-1.5">
            {profile.skills.map((s) => (
              <span key={s.name} className="chip">{s.name} · {s.proficiency}/5</span>
            ))}
          </div>
          <p className="mt-3 text-xs text-subtle">
            {profile.years_experience} years · {profile.industry} · {profile.city} · up to {profile.max_mentees} students
          </p>
        </section>
      )}

      <section>
        <div className="mb-4 flex items-center gap-2">
          <GraduationCap className="h-4 w-4 text-subtle" />
          <h2 className="font-semibold text-fg">Students who match you best</h2>
          {data && <span className="text-xs text-subtle">· top {data.results.length} of {data.candidatesConsidered}</span>}
        </div>
        {error ? (
          <ErrorBanner message={error} onRetry={() => { setError(null); setReloadKey((k) => k + 1); }} />
        ) : !data ? (
          <div className="space-y-3">
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </div>
        ) : data.results.length === 0 ? (
          <EmptyState icon={GraduationCap} title="No students yet">Students with complete profiles will appear here.</EmptyState>
        ) : (
          <ul className="space-y-3">
            {data.results.map((s, i) => (
              <li key={s.menteeId} className="card animate-fade-up" style={{ animationDelay: `${i * 60}ms` }}>
                <div className="flex flex-wrap items-center gap-4">
                  <Avatar name={s.menteeName} />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-fg">{s.menteeName}</p>
                    <p className="text-xs text-muted">{s.careerStage}</p>
                  </div>
                  <ScoreRing score={s.score} weak={s.weak} size={52} />
                </div>
                <p className="mt-3 line-clamp-2 text-sm text-muted">{s.goalSummary}</p>
                <ul className="mt-3 grid gap-1.5 text-sm sm:grid-cols-2">
                  {s.reasons.map((r) => (
                    <li key={r} className="flex gap-2 text-fg"><Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />{r}</li>
                  ))}
                  {s.caveats.slice(0, 1).map((c) => (
                    <li key={c} className="flex gap-2 text-muted"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warn" />{c}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
