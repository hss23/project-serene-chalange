"use client";

import { useRef, useState, type FormEvent } from "react";
import ReactMarkdown from "react-markdown";
import { Columns2, Eye, FileUp, PencilLine } from "lucide-react";
import { ErrorBanner, Spinner } from "@/components/ui";

const MAX_BYTES = 200 * 1024;
const MAX_CHARS = 100_000;
const MIN_CHARS = 50;
type View = "write" | "preview" | "split";

export function KbEditor({
  initialTitle = "",
  initialContent = "",
  submitLabel,
  onSave,
}: {
  initialTitle?: string;
  initialContent?: string;
  submitLabel: string;
  onSave: (v: { title: string; content: string }) => Promise<void>;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [view, setView] = useState<View>("split");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onFile(file: File | undefined) {
    setError(null);
    if (!file) return;
    if (!/\.(md|markdown|txt)$/i.test(file.name)) return setError("Upload a .md or .txt file.");
    if (file.size > MAX_BYTES) return setError("Files must be 200 KB or smaller.");
    const text = (await file.text()).replace(/\r\n/g, "\n");
    if (text.includes("\u0000")) return setError("That file doesn't look like plain text.");
    setContent(text);
    // Use the first "# Heading" as the title when the title is still empty.
    if (!title.trim()) {
      const h1 = /^#\s+(.+)$/m.exec(text)?.[1]?.trim();
      setTitle(h1 || file.name.replace(/\.(md|markdown|txt)$/i, ""));
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (title.trim().length < 3) return setError("Give the document a title (3+ characters).");
    if (content.trim().length < MIN_CHARS) return setError(`Add at least ${MIN_CHARS} characters of content.`);
    if (content.length > MAX_CHARS) return setError(`Documents can be at most ${MAX_CHARS.toLocaleString()} characters.`);
    setBusy(true);
    try {
      await onSave({ title: title.trim(), content });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const tab = (v: View, label: string, Icon: typeof Eye) => (
    <button
      type="button"
      onClick={() => setView(v)}
      aria-pressed={view === v}
      className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs transition ${view === v ? "bg-accent-soft font-medium text-accent-ink" : "text-muted hover:text-fg"}`}
    >
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
  );

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="card space-y-4">
        <div>
          <label className="label" htmlFor="kb-title">Title</label>
          <input id="kb-title" className="input" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Mentor onboarding guide" />
          <p className="mt-1 text-xs text-subtle">Shown as the source title in chatbot citations.</p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-1 rounded-xl border border-line p-1">
            {tab("write", "Write", PencilLine)}
            {tab("split", "Split", Columns2)}
            {tab("preview", "Preview", Eye)}
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-xs tabular-nums ${content.length > MAX_CHARS ? "text-danger" : "text-subtle"}`}>
              {content.length.toLocaleString()} / {MAX_CHARS.toLocaleString()}
            </span>
            <input ref={fileRef} type="file" accept=".md,.markdown,.txt,text/markdown,text/plain" className="hidden" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
            <button type="button" className="btn-secondary px-3 py-1.5 text-xs" onClick={() => fileRef.current?.click()}>
              <FileUp className="h-3.5 w-3.5" /> Upload .md / .txt
            </button>
          </div>
        </div>

        <div className={`grid gap-4 ${view === "split" ? "lg:grid-cols-2" : ""}`}>
          {view !== "preview" && (
            <textarea
              aria-label="Document content (Markdown)"
              className="input min-h-[460px] font-mono text-[13px] leading-relaxed"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={"# Document title\n\n## A section heading\nWrite the content in Markdown. Each ## section becomes a searchable chunk."}
            />
          )}
          {view !== "write" && (
            <div className="kb-preview min-h-[460px] overflow-auto rounded-xl border border-line bg-surface-2 p-5 text-sm">
              {content.trim() ? <ReactMarkdown>{content}</ReactMarkdown> : <p className="text-subtle">Nothing to preview yet.</p>}
            </div>
          )}
        </div>
        <p className="text-xs text-subtle">
          Tip: use <code>## headings</code> for sections. Each section (split further if long) becomes one search chunk with its heading shown in citations.
        </p>
      </div>

      {error && <ErrorBanner message={error} />}
      <div className="flex justify-end">
        <button className="btn-primary px-6 py-3" disabled={busy}>
          {busy && <Spinner />} {busy ? "Saving and indexing…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
