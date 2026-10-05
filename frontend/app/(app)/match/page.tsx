"use client";

import { useEffect, useState } from "react";
import { doc, getDoc, onSnapshot, collection, serverTimestamp, setDoc, deleteDoc } from "firebase/firestore";
import { useAuth } from "@/components/AuthProvider";
import { MatchCard } from "@/components/MatchCard";
import { ScoringExplainer } from "@/components/ScoringExplainer";
import { Briefcase, CalendarClock, ChevronDown, Globe, Languages, Sparkles, Star, Users, Video, type LucideIcon } from "lucide-react";
import { Avatar, EmptyState, ErrorBanner, PageHeader, Skeleton, Spinner } from "@/components/ui";
import { clientDb } from "@/lib/firebase/client";
import { formatTz, SLOT_LABELS, type MatchResponse, type MatchResult, type MenteeProfile, type MenteesResponse } from "@/lib/types";

export default function MatchPage() {
  const { user, api } = useAuth();
  const [mentees, setMentees] = useState<MenteeProfile[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [match, setMatch] = useState<MatchResponse | null>(null);
  const [matching, setMatching] = useState(false);
  const [matchError, setMatchError] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [saveError, setSaveError] = useState<string | null>(null);

  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api<MenteesResponse>("/api/mentees")
      .then((res) => !cancelled && setMentees(res.mentees))
      .catch((err: Error) => !cancelled && setListError(err.message));
    return () => {
      cancelled = true;
    };
  }, [api, reloadKey]);

  const retryMentees = () => {
    setListError(null);
    setReloadKey((k) => k + 1);
  };

  // Restore the last selected mentee from Firestore preferences.
  useEffect(() => {
    if (!user) return;
    getDoc(doc(clientDb(), `users/${user.uid}/preferences/settings`))
      .then((snap) => {
        const id = snap.data()?.lastMenteeId;
        if (typeof id === "string") setSelectedId((cur) => cur || id);
      })
      .catch(() => {});
  }, [user]);

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
    if (!menteeId) return;
    setMatching(true);
    setMatchError(null);
    try {
      const res = await api<MatchResponse>(`/api/match?menteeId=${encodeURIComponent(menteeId)}`);
      setMatch(res);
      if (user) {
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

  const selected = mentees?.find((m) => m.id === selectedId) ?? null;

  return (
    <div>
      <PageHeader
        icon={Sparkles}
        title="Find a mentor"
        subtitle="Choose a mentee profile (Dataset A) to rank all 30 mentors (Dataset B) with a transparent score."
      />

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          <div className="card">
            <label htmlFor="mentee" className="label">Mentee profile</label>
            {listError ? (
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

            <button className="btn-primary mt-5 w-full py-3" disabled={!selectedId || matching} onClick={() => findMatches()}>
              {matching ? <Spinner /> : <Sparkles className="h-4 w-4" />}
              {matching ? "Ranking mentors…" : "Find matches"}
            </button>
          </div>
          <ScoringExplainer />
        </aside>

        <section className="space-y-4">
          {saveError && <ErrorBanner message={saveError} />}
          {matchError && <ErrorBanner message={matchError} onRetry={() => findMatches()} />}
          {matching ? (
            Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-52" />)
          ) : match ? (
            <>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm text-muted">
                  Top {match.results.length} of {match.candidatesConsidered} mentors for{" "}
                  <span className="font-semibold text-fg">{match.mentee.name}</span>
                </p>
                {!match.historySaved && <span className="text-xs text-warn">Couldn&apos;t record this in your history</span>}
              </div>
              {match.results.length === 0 ? (
                <EmptyState icon={Users} title="No mentors available">The mentor list is empty. Run the seed script.</EmptyState>
              ) : (
                match.results.map((r, i) => (
                  <MatchCard key={r.mentorId} rank={i + 1} result={r} saved={savedIds.has(r.mentorId)} onToggleSave={() => toggleSave(r)} />
                ))
              )}
            </>
          ) : (
            !matchError && (
              <EmptyState icon={Sparkles} title="Your ranked matches will appear here">
                Pick a mentee profile and press “Find matches” to rank all mentors with reasons for each.
              </EmptyState>
            )
          )}
        </section>
      </div>
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
