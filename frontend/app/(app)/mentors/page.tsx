"use client";

import { useEffect, useMemo, useState } from "react";
import { Briefcase, CalendarClock, Globe, MapPin, Search, Users } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { Avatar, EmptyState, ErrorBanner, PageHeader, Skeleton } from "@/components/ui";
import { formatTz, SLOT_LABELS, type MentorProfile, type MentorsResponse } from "@/lib/types";

function Dots({ n }: { n: number }) {
  return (
    <span className="flex gap-0.5" aria-label={`Proficiency ${n} of 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={`h-1.5 w-1.5 rounded-full ${i < n ? "bg-accent" : "bg-line"}`} />
      ))}
    </span>
  );
}

export default function MentorsPage() {
  const { api } = useAuth();
  const [mentors, setMentors] = useState<MentorProfile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api<MentorsResponse>("/api/mentors")
      .then((res) => !cancelled && setMentors(res.mentors))
      .catch((err: Error) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [api, reloadKey]);

  const retry = () => {
    setError(null);
    setReloadKey((k) => k + 1);
  };

  const visible = useMemo(() => {
    const f = filter.trim().toLowerCase();
    if (!mentors || !f) return mentors;
    return mentors.filter((m) =>
      [m.name, m.headline, m.industry, m.city, ...m.skills.map((s) => s.name)].some((v) => v.toLowerCase().includes(f)),
    );
  }, [mentors, filter]);

  return (
    <div>
      <PageHeader
        icon={Users}
        title="Mentors"
        subtitle="Dataset B, loaded from Supabase Postgres (mentors joined with mentor_skills and skills)."
        action={
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
            <input
              className="input pl-10"
              placeholder="Filter by name, skill, city…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              aria-label="Filter mentors"
            />
          </div>
        }
      />
      {mentors && visible && (
        <p className="-mt-4 mb-5 text-sm text-muted">
          Showing {visible.length} of {mentors.length} mentors
        </p>
      )}
      {error ? (
        <ErrorBanner message={error} onRetry={retry} />
      ) : !visible ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-64" />)}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState icon={Search} title="No mentors match that filter">Try a skill like “React” or a city.</EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((m) => (
            <article key={m.id} className="card flex flex-col transition hover:-translate-y-0.5 hover:border-accent/30">
              <div className="flex items-center gap-3">
                <Avatar name={m.name} />
                <div className="min-w-0">
                  <h3 className="truncate font-semibold text-fg">{m.name}</h3>
                  <p className="truncate text-xs text-muted">{m.headline}</p>
                </div>
              </div>
              <p className="mt-3 line-clamp-2 text-sm text-muted">{m.bio}</p>
              <ul className="mt-4 space-y-1.5">
                {m.skills.slice(0, 4).map((s) => (
                  <li key={s.name} className="flex items-center justify-between text-xs">
                    <span className="text-fg">{s.name}</span>
                    <Dots n={s.proficiency} />
                  </li>
                ))}
              </ul>
              <div className="mt-auto grid grid-cols-2 gap-2 border-t border-line pt-3 text-xs text-muted [&>span]:flex [&>span]:items-center [&>span]:gap-1.5" style={{ marginTop: "1rem" }}>
                <span><Briefcase className="h-3.5 w-3.5" />{m.years_experience} yrs · {m.industry}</span>
                <span><MapPin className="h-3.5 w-3.5" />{m.city}</span>
                <span><Globe className="h-3.5 w-3.5" />{formatTz(m.timezone_offset)} · <span className="capitalize">{m.format.replace("_", "-")}</span></span>
                <span className="col-span-2"><CalendarClock className="h-3.5 w-3.5 shrink-0" />{m.availability.map((s) => SLOT_LABELS[s] ?? s).join(", ")}</span>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
