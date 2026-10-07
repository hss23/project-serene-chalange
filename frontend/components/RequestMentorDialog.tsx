"use client";

import { useEffect, useState } from "react";
import { Send } from "lucide-react";
import { ErrorBanner, Spinner } from "./ui";

/** Ask for an introduction to a teacher, with an optional note (max 500 characters). */
export function RequestMentorDialog({
  mentorName,
  open,
  onCancel,
  onSend,
}: {
  mentorName: string;
  open: boolean;
  onCancel: () => void;
  onSend: (message: string) => Promise<void>;
}) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  async function send() {
    setBusy(true);
    setError(null);
    try {
      await onSend(message.trim());
      setMessage("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-sm" onClick={() => !busy && onCancel()}>
      <div role="dialog" aria-modal="true" aria-labelledby="req-title" className="card w-full max-w-lg animate-fade-up" onClick={(e) => e.stopPropagation()}>
        <h2 id="req-title" className="font-semibold text-fg">Request {mentorName} as your mentor</h2>
        <p className="mt-1 text-sm text-muted">
          They have 7 days to accept or decline. You can have up to 3 pending requests and one active mentor.
        </p>
        <label className="label mt-4" htmlFor="req-msg">Note to the teacher (optional)</label>
        <textarea
          id="req-msg"
          autoFocus
          className="input min-h-28"
          maxLength={500}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="What would you like help with? When are you usually free?"
        />
        <p className="mt-1 text-right text-xs text-subtle">{message.length}/500</p>
        {error && <div className="mt-3"><ErrorBanner message={error} /></div>}
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-secondary" onClick={onCancel} disabled={busy}>Cancel</button>
          <button className="btn-primary" onClick={send} disabled={busy}>
            {busy ? <Spinner /> : <Send className="h-4 w-4" />} Send request
          </button>
        </div>
      </div>
    </div>
  );
}
