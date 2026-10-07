"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { doc, getDoc, onSnapshot, collection, serverTimestamp, setDoc, deleteDoc } from "firebase/firestore";
import { useAuth } from "@/components/AuthProvider";
import { MatchCard } from "@/components/MatchCard";
import { RequestMentorDialog } from "@/components/RequestMentorDialog";
import { ScoringExplainer } from "@/components/ScoringExplainer";
import { Briefcase, CalendarClock, ChevronDown, Globe, Languages, Pencil, RotateCw, Sparkles, Star, Users, Video, type LucideIcon } from "lucide-react";
import { Avatar, EmptyState, ErrorBanner, PageHeader, Skeleton, Spinner } from "@/components/ui";
import { clientDb } from "@/lib/firebase/client";
import { formatTz, SLOT_LABELS, type MatchResponse, type MatchResult, type MenteeProfile, type MenteesResponse } from "@/lib/types";

export default function MatchPage() {
  const { user, api, me } = useAuth();
  // Admins pick any student (Dataset A); students always see matches for their own profile.
  const isAdmin = me?.user.role === "admin";
  const autoRan = useRef(false);
  const [mentees, setMentees] = useState<MenteeProfile[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [match, setMatch] = useState<MatchResponse | null>(null);
  const [matching, setMatching] = useState(false);
  const [matchError, setMatchError] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [saveError, setSaveError] = useState<string | null>(null);
  const [requestFor, setRequestFor] = useState<MatchResult | null>(null);
  const [requestNotice, setRequestNotice] = useState<string | null>(null);

  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    api<MenteesResponse>("/api/mentees")
      .then((res) => !cancelled && setMentees(res.mentees))
      .catch((err: Error) => !cancelled && setListError(err.message));
    return () => {
      cancelled = true;
    };
  }, [api, reloadKey, isAdmin]);

  const retryMentees = () => {
    setListError(null);
    setReloadKey((k) => k + 1);
  };

  // Restore the last selected mentee from Firestore preferences (admin picker).
  useEffect(() => {
    if (!user || !isAdmin) return;
    getDoc(doc(clientDb(), `users/${user.uid}/preferences/settings`))
      .then((snap) => {
        const id = snap.data()?.lastMenteeId;
        if (typeof id === "string") setSelectedId((cur) => cur || id);
      })
      .catch(() => {});
  }, [user, isAdmin]);

  // Live set of saved mentor ids (Firestore).
  useEffect(() => {
    if (!user) return;
    return onSnapshot(
      collection(clientDb(), `users/${user.uid}/savedMatches`),
      (snap) => setSavedIds(new Set(snap.docs.map((d) => d.id))),
      () => setSaveError("Couldn't load your saved matches."),
    );
  }, [user]);

  async function findMatches(menteeId = selectedId) {
    if (isAdmin && !menteeId) return;
    setMatching(true);
    setMatchError(null);
    try {
      const res = await api<MatchResponse>(isAdmin ? `/api/match?menteeId=${encodeURIComponent(menteeId)}` : "/api/match");
      setMatch(res);
      if (user && isAdmin) {
        setDoc(
          doc(clientDb(), `users/${user.uid}/preferences/settings`),
          { lastMenteeId: menteeId, updatedAt: serverTimestamp() },
          { merge: true },
        ).catch(() => {});
      }
    } catch (err) {
      setMatch(null);
      setMatchError((err as Error).message);
    } finally {
      setMatching(false);
    }
  }

  async function toggleSave(r: MatchResult) {
    if (!user || !match) return;
    setSaveError(null);
    const ref = doc(clientDb(), `users/${user.uid}/savedMatches/${r.mentorId}`);
    try {
      if (savedIds.has(r.mentorId)) {
        await deleteDoc(ref);
      } else {
        await setDoc(ref, {
          mentorId: r.mentorId,
          mentorName: r.mentorName,
          headline: r.headline,
          score: r.score,
          reasons: r.reasons.slice(0, 6),
          menteeId: match.mentee.id,
          menteeName: match.mentee.name,
          savedAt: serverTimestamp(),
        });
      }
    } catch {
      setSaveError("Couldn't update your saved matches. Please try again.");
    }
  }

  // Students: load their own matches once on arrival.
  useEffect(() => {
    if (!me || isAdmin || autoRan.current) return;
    autoRan.current = true;
    findMatches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, isAdmin]);

  const selected = isAdmin ? (mentees?.find((m) => m.id === selectedId) ?? null) : ((me?.profile as MenteeProfile | null) ?? null);

  return (
    <div>
      <PageHeader
        icon={Sparkles}
        title={isAdmin ? "Run matching" : "Your mentor matches"}
        subtitle={
          isAdmin
            ? "Choose any student (Dataset A) to rank all active teachers (Dataset B) with a transparent score."
            : "Teachers ranked for your profile with a transparent score. Update your profile to change the results."
        }
      />

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          <div className="card">
            {isAdmin ? <label htmlFor="mentee" className="label">Student</label> : <p className="eyebrow mb-3">Matching on your profile</p>}
            {!isAdmin ? null : listError ? (
              <ErrorBanner message={listError} onRetry={retryMentees} />
            ) : !mentees ? (
              <Skeleton className="h-11" />
            ) : mentees.length === 0 ? (
              <p className="text-sm text-muted">No mentee profiles found. Run the seed script.</p>
            ) : (
              <div className="relative">
                <select
                  id="mentee"
                  className="input appearance-none pr-10"
                  value={selectedId}
                  onChange={(e) => {
                    setSelectedId(e.target.value);
                    setMatch(null);
                  }}
                >
                  <option value="">Select a mentee…</option>
                  {mentees.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} · {m.career_stage}, {m.industry}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
              </div>
            )}

            {selected && (
              <div className="mt-5 space-y-4 animate-fade-up">
                <div className="flex items-center gap-3">
                  <Avatar name={selected.name} />
                  <div className="min-w-0">
                    <p className="font-semibold text-fg">{selected.name}</p>
                    <p className="text-xs text-muted">
                      {selected.career_stage} · {selected.industry}
                    </p>
                  </div>
                </div>
                <p className="text-sm leading-relaxed text-muted">{selected.goal_summary}</p>
                <div>
                  <p className="eyebrow mb-2">Goal skills</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selected.goals.map((g) =>
                      g.priority === 3 ? (
                        <span key={g.name} className="chip-accent">
                          <Star className="h-3 w-3 fill-current" /> {g.name}
                        </span>
                      ) : (
                        <span key={g.name} className="chip">{g.name}</span>
                      ),
                    )}
                  </div>
                </div>
                <dl className="grid grid-cols-2 gap-3 rounded-xl bg-surface-2 p-3 text-xs">
                  <Fact icon={Briefcase} label="Wants experience" value={`${selected.desired_min_years}+ years`} />
                  <Fact icon={Globe} label="Timezone" value={formatTz(selected.timezone_offset)} />
                  <Fact icon={Video} label="Format" value={selected.format.replace("_", "-")} capitalize />
                  <Fact icon={Languages} label="Languages" value={selected.languages.join(", ")} />
                  <div className="col-span-2">
                    <Fact
                      icon={CalendarClock}
                      label="Availability"
                      value={selected.availability.map((s) => SLOT_LABELS[s] ?? s).join(", ") || "Not specified"}
                    />
                  </div>
                </dl>
              </div>
            )}

            {isAdmin ? (
              <button className="btn-primary mt-5 w-full py-3" disabled={!selectedId || matching} onClick={() => findMatches()}>
                {matching ? <Spinner /> : <Sparkles className="h-4 w-4" />}
                {matching ? "Ranking mentors…" : "Find matches"}
              </button>
            ) : (
              <div className="mt-5 grid grid-cols-2 gap-2">
                <Link href="/profile" className="btn-secondary">
                  <Pencil className="h-4 w-4" /> Edit profile
                </Link>
                <button className="btn-primary" disabled={matching} onClick={() => findMatches()}>
                  {matching ? <Spinner /> : <RotateCw className="h-4 w-4" />} Refresh
                </button>
              </div>
            )}
          </div>
          <ScoringExplainer />
        </aside>

        <section className="space-y-4">
          {saveError && <ErrorBanner message={saveError} />}
          {requestNotice && (
            <div className="rounded-2xl border border-success/20 bg-success-soft p-4 text-sm text-success">
              {requestNotice} <Link href="/mentorship" className="font-medium underline">View your requests</Link>
            </div>
          )}
          {matchError && <ErrorBanner message={matchError} onRetry={() => findMatches()} />}
          {matching ? (
            Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-52" />)
          ) : match ? (
            <>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm text-muted">
                  Top {match.results.length} of {match.candidatesConsidered} active teachers for{" "}
                  <span className="font-semibold text-fg">{isAdmin ? match.mentee.name : "you"}</span>
                </p>
                {!match.historySaved && <span className="text-xs text-warn">Couldn&apos;t record this in your history</span>}
              </div>
              {match.results.length === 0 ? (
                <EmptyState icon={Users} title="No teachers available yet">No active teachers with complete profiles. An admin may need to approve new teachers.</EmptyState>
              ) : (
                match.results.map((r, i) => (
                  <MatchCard
                    key={r.mentorId}
                    rank={i + 1}
                    result={r}
                    saved={savedIds.has(r.mentorId)}
                    onToggleSave={isAdmin ? undefined : () => toggleSave(r)}
                    onRequest={!isAdmin && match.mentorshipRequests ? () => setRequestFor(r) : undefined}
                  />
                ))
              )}
            </>
          ) : (
            !matchError && (
              <EmptyState icon={Sparkles} title="Your ranked matches will appear here">
                {isAdmin ? "Pick a student and press “Find matches” to rank all teachers with reasons for each." : "Loading your matches…"}
              </EmptyState>
            )
          )}
        </section>
      </div>
      <RequestMentorDialog
        open={!!requestFor}
        mentorName={requestFor?.mentorName ?? ""}
        onCancel={() => setRequestFor(null)}
        onSend={async (message) => {
          await api("/api/mentorships", {
            method: "POST",
            body: JSON.stringify({ mentorId: requestFor!.mentorId, ...(message ? { message } : {}) }),
          });
          setRequestNotice(`Request sent to ${requestFor!.mentorName}. They have 7 days to respond.`);
          setRequestFor(null);
          await findMatches();
        }}
      />
    </div>
  );
}

function Fact({
  icon: Icon,
  label,
  value,
  capitalize,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  capitalize?: boolean;
}) {
  return (
    <div>
      <dt className="flex items-center gap-1 text-subtle">
        <Icon className="h-3.5 w-3.5" /> {label}
      </dt>
      <dd className={`mt-0.5 font-medium text-fg ${capitalize ? "capitalize" : ""}`}>{value}</dd>
    </div>
  );
}
