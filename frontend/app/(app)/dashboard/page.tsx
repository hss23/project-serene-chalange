"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query, type Timestamp } from "firebase/firestore";
import { ArrowRight, Bookmark, History, MessageSquareText, Sparkles, Users, type LucideIcon } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { Avatar, EmptyState, Skeleton } from "@/components/ui";
import { clientDb } from "@/lib/firebase/client";

interface HistoryEntry {
  id: string;
  menteeName: string;
  top: { mentorName: string; score: number }[];
  createdAt?: Timestamp | null;
}

function StatCard({ href, icon: Icon, label, value, hint }: { href: string; icon: LucideIcon; label: string; value: string; hint: string }) {
  return (
    <Link href={href} className="card group flex items-center gap-4 transition hover:-translate-y-0.5 hover:border-accent/30">
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-accent-soft text-accent-ink">
        <Icon className="h-5 w-5" />
      </span>
      <div className="flex-1">
        <p className="text-2xl font-semibold tabular-nums text-fg">{value}</p>
        <p className="text-sm text-muted">{label}</p>
      </div>
      <span className="text-xs text-subtle transition group-hover:text-accent-ink">{hint} →</span>
    </Link>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [history, setHistory] = useState<HistoryEntry[] | null>(null);
  const [savedCount, setSavedCount] = useState<number | null>(null);
  const [chatCount, setChatCount] = useState<number | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!user) return;
    const base = `users/${user.uid}`;
    const db = clientDb();
    const onErr = () => setError(true);
    const unsubs = [
      onSnapshot(
        query(collection(db, `${base}/matchHistory`), orderBy("createdAt", "desc"), limit(5)),
        (s) => setHistory(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<HistoryEntry, "id">) }))),
        onErr,
      ),
      onSnapshot(collection(db, `${base}/savedMatches`), (s) => setSavedCount(s.size), onErr),
      onSnapshot(collection(db, `${base}/chatSessions`), (s) => setChatCount(s.size), onErr),
    ];
    return () => unsubs.forEach((u) => u());
  }, [user]);

  const name = user?.displayName || user?.email?.split("@")[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl brand-gradient p-7 text-white sm:p-9">
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/15 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-24 right-40 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
        <p className="relative text-sm text-white/80">{greeting}</p>
        <h1 className="relative mt-1 text-3xl font-semibold tracking-tight">{name ? `Welcome back, ${name}` : "Welcome back"}</h1>
        <p className="relative mt-2 max-w-lg text-sm text-white/85">
          Rank mentors for a mentee profile, keep the ones you like, and ask the assistant how the programme works.
        </p>
        <div className="relative mt-6 flex flex-wrap gap-3">
          <Link href="/match" className="btn bg-white text-[#3f3fd1] shadow-sm hover:bg-white/90">
            <Sparkles className="h-4 w-4" /> Find a mentor
          </Link>
          <Link href="/chat" className="btn border border-white/30 bg-white/10 text-white hover:bg-white/20">
            <MessageSquareText className="h-4 w-4" /> Ask the assistant
          </Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard href="/mentors" icon={Users} label="Mentors available" value="30" hint="Browse" />
        <StatCard href="/saved" icon={Bookmark} label="Saved matches" value={savedCount === null ? "–" : String(savedCount)} hint="View" />
        <StatCard href="/chat" icon={MessageSquareText} label="Assistant chats" value={chatCount === null ? "–" : String(chatCount)} hint="Open" />
      </section>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <History className="h-4 w-4 text-subtle" />
          <h2 className="font-semibold text-fg">Recent match searches</h2>
          <span className="text-xs text-subtle">· stored in Firestore</span>
        </div>
        {error ? (
          <p className="text-sm text-danger">Couldn&apos;t load your activity. Check your connection and refresh.</p>
        ) : history === null ? (
          <Skeleton className="h-40" />
        ) : history.length === 0 ? (
          <EmptyState icon={History} title="No searches yet">
            Your match searches will appear here. <Link href="/match" className="font-medium text-accent-ink hover:underline">Run one now</Link>.
          </EmptyState>
        ) : (
          <ul className="card divide-y divide-line p-0">
            {history.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center gap-4 px-5 py-4 text-sm">
                <Avatar name={h.menteeName} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-fg">{h.menteeName}</p>
                  <p className="text-xs text-subtle">{h.createdAt ? h.createdAt.toDate().toLocaleString() : "just now"}</p>
                </div>
                {h.top?.[0] && (
                  <span className="flex items-center gap-2 text-muted">
                    <ArrowRight className="h-3.5 w-3.5 text-subtle" />
                    <span className="font-medium text-fg">{h.top[0].mentorName}</span>
                    <span className="rounded-full bg-success-soft px-2 py-0.5 text-xs font-semibold text-success">{h.top[0].score}</span>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
