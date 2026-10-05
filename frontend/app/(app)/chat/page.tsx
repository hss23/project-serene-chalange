"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { useAuth, ApiError } from "@/components/AuthProvider";
import { ChatBubble } from "@/components/ChatBubble";
import { ArrowUpRight, MessageSquare, MessageSquareText, Plus, SendHorizontal, Sparkles } from "lucide-react";
import { ErrorBanner, InfoBanner, PageHeader, Skeleton, Spinner } from "@/components/ui";
import { clientDb } from "@/lib/firebase/client";
import type { ChatMessage, ChatResponse } from "@/lib/types";

const SUGGESTIONS = [
  "How long does a mentorship cycle last?",
  "How is the match score calculated?",
  "What should I do if my mentor stops responding?",
  "Can I meet my mentor in person?",
];
const MAX_LEN = 1000;

interface SessionItem {
  id: string;
  title: string;
}

const newSessionId = () => crypto.randomUUID().replace(/-/g, "").slice(0, 24);

export default function ChatPage() {
  const { user, api } = useAuth();
  const [sessions, setSessions] = useState<SessionItem[] | null>(null);
  const [sessionId, setSessionId] = useState<string>(() => newSessionId());
  const [storedFor, setStoredFor] = useState<{ sessionId: string; messages: ChatMessage[] }>({ sessionId: "", messages: [] });
  const [local, setLocal] = useState<ChatMessage[]>([]); // pending/unsaved messages not yet in Firestore
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const seq = useRef(0);
  // Messages belong to the session they were loaded for; avoids flashing the previous chat.
  const stored = storedFor.sessionId === sessionId ? storedFor.messages : [];

  // Session list (Firestore, private to this user).
  useEffect(() => {
    if (!user) return;
    const q = query(collection(clientDb(), `users/${user.uid}/chatSessions`), orderBy("updatedAt", "desc"), limit(20));
    return onSnapshot(
      q,
      (snap) => setSessions(snap.docs.map((d) => ({ id: d.id, title: (d.data().title as string) || "Untitled chat" }))),
      () => setHistoryError("Couldn't load your chat history."),
    );
  }, [user]);

  // Messages of the active session.
  useEffect(() => {
    if (!user) return;
    const q = query(collection(clientDb(), `users/${user.uid}/chatSessions/${sessionId}/messages`), orderBy("order", "asc"));
    return onSnapshot(
      q,
      (snap) =>
        setStoredFor({
          sessionId,
          messages: snap.docs.map((d) => {
            const m = d.data();
            return { id: d.id, role: m.role, text: m.text, sources: m.sources ?? [], supported: m.supported };
          }),
        }),
      () => setHistoryError("Couldn't load messages for this chat."),
    );
  }, [user, sessionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [stored.length, local.length]);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    if (q.length > MAX_LEN) {
      setNotice(`Questions are limited to ${MAX_LEN} characters.`);
      return;
    }
    setNotice(null);
    setBusy(true);
    setInput("");
    const tempId = `local-${++seq.current}`;
    setLocal([
      { id: `${tempId}-q`, role: "user", text: q },
      { id: `${tempId}-a`, role: "assistant", text: "", pending: true },
    ]);
    try {
      const res = await api<ChatResponse>("/api/chat", {
        method: "POST",
        body: JSON.stringify({ sessionId, question: q }),
      });
      if (res.saved) {
        setLocal([]); // Firestore snapshot will deliver both messages
      } else {
        setNotice("Answer shown, but it couldn't be saved to your history.");
        setLocal([
          { id: `${tempId}-q`, role: "user", text: q },
          { id: `${tempId}-a`, role: "assistant", text: res.answer, sources: res.sources, supported: res.supported },
        ]);
      }
    } catch (err) {
      const e = err as ApiError;
      const prefix = e.code === "ai_quota" ? "AI quota reached: " : e.code === "rate_limited" ? "Slow down: " : "";
      setLocal([
        { id: `${tempId}-q`, role: "user", text: q },
        { id: `${tempId}-a`, role: "assistant", text: prefix + e.message, error: true },
      ]);
      setInput(q); // keep the question so the user can retry
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    ask(input);
  }

  function startNewChat() {
    setSessionId(newSessionId());
    setLocal([]);
    setNotice(null);
  }

  // Hide local copies once the same text has arrived from Firestore.
  const storedTexts = new Set(stored.map((m) => `${m.role}:${m.text}`));
  const messages = [...stored, ...local.filter((m) => m.pending || m.error || !storedTexts.has(`${m.role}:${m.text}`))];


  return (
    <div>
      <PageHeader
        icon={MessageSquareText}
        title="Programme assistant"
        subtitle="Answers come only from the Serene Mentorship knowledge base, with cited sources."
        action={
          <button className="btn-secondary" onClick={startNewChat}>
            <Plus className="h-4 w-4" /> New chat
          </button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <aside className="card h-fit p-3 lg:sticky lg:top-24">
          <p className="eyebrow px-2 pb-2 pt-1">Your chats</p>
          {historyError ? (
            <p className="px-2 text-sm text-danger">{historyError}</p>
          ) : sessions === null ? (
            <div className="space-y-2 p-1">
              <Skeleton className="h-8" />
              <Skeleton className="h-8" />
            </div>
          ) : sessions.length === 0 ? (
            <p className="px-2 pb-2 text-sm text-muted">No saved chats yet.</p>
          ) : (
            <ul className="space-y-0.5">
              {sessions.map((s) => (
                <li key={s.id}>
                  <button
                    onClick={() => {
                      setSessionId(s.id);
                      setLocal([]);
                    }}
                    className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-sm transition ${
                      s.id === sessionId ? "bg-accent-soft font-medium text-accent-ink" : "text-muted hover:bg-surface-2 hover:text-fg"
                    }`}
                  >
                    <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                    <span className="min-w-0 truncate">{s.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <section className="card flex h-[calc(100vh-15rem)] min-h-[520px] flex-col p-0">
          <div className="flex-1 space-y-5 overflow-y-auto p-5 sm:p-6">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center py-8 text-center">
                <span className="grid h-14 w-14 place-items-center rounded-2xl brand-gradient text-white shadow-sm">
                  <Sparkles className="h-6 w-6" />
                </span>
                <p className="mt-4 text-lg font-semibold text-fg">Ask anything about the programme</p>
                <p className="mt-1 text-sm text-muted">Answers are grounded in the knowledge base and cite their sources.</p>
                <div className="mt-6 grid w-full max-w-xl gap-2 sm:grid-cols-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      className="group flex items-center justify-between gap-2 rounded-xl border border-line bg-surface px-4 py-3 text-left text-sm text-fg transition hover:border-accent/40 hover:bg-accent-soft"
                      onClick={() => ask(s)}
                      disabled={busy}
                    >
                      {s}
                      <ArrowUpRight className="h-4 w-4 shrink-0 text-subtle transition group-hover:text-accent-ink" />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m) => <ChatBubble key={m.id} message={m} />)
            )}
            <div ref={bottomRef} />
          </div>

          <form onSubmit={onSubmit} className="border-t border-line p-4">
            {notice && <div className="mb-3"><InfoBanner>{notice}</InfoBanner></div>}
            <div className="flex items-center gap-2 rounded-2xl border border-line bg-surface-2 p-1.5 pl-4 transition focus-within:border-accent focus-within:shadow-[0_0_0_4px_var(--ring)]">
              <input
                className="flex-1 bg-transparent py-2 text-sm text-fg outline-none placeholder:text-subtle"
                placeholder="Ask about sessions, matching, goals, guidelines…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                maxLength={MAX_LEN + 50}
                disabled={busy}
                aria-label="Your question"
              />
              <button className="btn-primary h-10 w-10 rounded-xl p-0" disabled={busy || !input.trim()} aria-label="Send">
                {busy ? <Spinner /> : <SendHorizontal className="h-4 w-4" />}
              </button>
            </div>
            <p className="mt-1.5 text-right text-xs text-subtle">
              {input.length > MAX_LEN ? <span className="text-danger">{input.length}/{MAX_LEN}</span> : `${input.length}/${MAX_LEN}`}
            </p>
          </form>
        </section>
      </div>
      {historyError && <div className="mt-4"><ErrorBanner message="Chat history is unavailable, but you can still ask questions." /></div>}
    </div>
  );
}
