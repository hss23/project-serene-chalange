"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { collection, deleteDoc, doc, onSnapshot, orderBy, query, type Timestamp } from "firebase/firestore";
import { Bookmark, Check, Trash2, UserRound } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { Avatar, EmptyState, ErrorBanner, PageHeader, ScoreRing, Skeleton } from "@/components/ui";
import { clientDb } from "@/lib/firebase/client";

interface SavedMatch {
  mentorId: string;
  mentorName: string;
  headline?: string;
  score: number;
  reasons?: string[];
  menteeName?: string;
  savedAt?: Timestamp | null;
}

export default function SavedPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<SavedMatch[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(clientDb(), `users/${user.uid}/savedMatches`), orderBy("savedAt", "desc"));
    return onSnapshot(
      q,
      (snap) => setItems(snap.docs.map((d) => d.data() as SavedMatch)),
      () => setError("Couldn't load your saved matches."),
    );
  }, [user]);

  async function remove(id: string) {
    if (!user) return;
    try {
      await deleteDoc(doc(clientDb(), `users/${user.uid}/savedMatches/${id}`));
    } catch {
      setError("Couldn't remove that match. Please try again.");
    }
  }

  return (
    <div>
      <PageHeader
        icon={Bookmark}
        title="Saved matches"
        subtitle="Stored in your private Firestore space. Each one is a snapshot of the score at the time you saved it."
      />
      {error && <div className="mb-4"><ErrorBanner message={error} /></div>}
      {items === null && !error ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      ) : items && items.length === 0 ? (
        <EmptyState icon={Bookmark} title="No saved matches yet">
          <Link href="/match" className="font-medium text-accent-ink hover:underline">Find a mentor</Link> and tap the
          bookmark on a match to keep it here.
        </EmptyState>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {items?.map((m) => (
            <article key={m.mentorId} className="card flex flex-col animate-fade-up">
              <div className="flex items-center gap-3">
                <Avatar name={m.mentorName} />
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-semibold text-fg">{m.mentorName}</h3>
                  {m.headline && <p className="truncate text-sm text-muted">{m.headline}</p>}
                </div>
                <ScoreRing score={m.score} size={52} />
              </div>
              <ul className="mt-4 flex-1 space-y-1.5 text-sm text-fg">
                {m.reasons?.slice(0, 3).map((r) => (
                  <li key={r} className="flex gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                    {r}
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-xs text-subtle">
                <span className="flex items-center gap-1.5">
                  {m.menteeName && (
                    <>
                      <UserRound className="h-3.5 w-3.5" /> For {m.menteeName}
                    </>
                  )}
                  {m.savedAt ? ` · ${m.savedAt.toDate().toLocaleDateString()}` : ""}
                </span>
                <button
                  onClick={() => remove(m.mentorId)}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 font-medium text-danger transition hover:bg-danger-soft"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Remove
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
