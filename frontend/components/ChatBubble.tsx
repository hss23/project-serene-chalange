import { AlertCircle, FileText, SearchX, Sparkles } from "lucide-react";
import type { ChatMessage } from "@/lib/types";

function withCitations(text: string) {
  return text.split(/(\[\d+\])/g).map((part, i) =>
    /^\[\d+\]$/.test(part) ? (
      <span
        key={i}
        className="relative -top-px ml-0.5 inline-block rounded-md bg-accent-soft px-1.5 text-[10px] font-semibold leading-4 text-accent-ink"
        aria-label={`source ${part.slice(1, -1)}`}
      >
        {part.slice(1, -1)}
      </span>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

function BotAvatar({ tone = "accent" }: { tone?: "accent" | "danger" | "warn" }) {
  const cls = {
    accent: "brand-gradient text-white",
    danger: "bg-danger-soft text-danger",
    warn: "bg-warn-soft text-warn",
  }[tone];
  const Icon = tone === "danger" ? AlertCircle : tone === "warn" ? SearchX : Sparkles;
  return (
    <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${cls}`}>
      <Icon className="h-4 w-4" />
    </span>
  );
}

export function ChatBubble({ message }: { message: ChatMessage }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end animate-fade-up">
        <p className="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-br-md brand-gradient px-4 py-2.5 text-sm text-white shadow-sm">
          {message.text}
        </p>
      </div>
    );
  }

  if (message.pending) {
    return (
      <div className="flex items-center gap-3 animate-fade-up">
        <BotAvatar />
        <div className="flex items-center gap-2 rounded-2xl rounded-tl-md border border-line bg-surface px-4 py-3 text-sm text-muted">
          <span className="flex gap-1">
            {[0, 150, 300].map((d) => (
              <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent" style={{ animationDelay: `${d}ms` }} />
            ))}
          </span>
          Searching the knowledge base…
        </div>
      </div>
    );
  }

  const unsupported = !message.error && message.supported === false;
  return (
    <div className="flex gap-3 animate-fade-up">
      <BotAvatar tone={message.error ? "danger" : unsupported ? "warn" : "accent"} />
      <div className="min-w-0 max-w-[85%]">
        <div
          className={`whitespace-pre-wrap rounded-2xl rounded-tl-md px-4 py-3 text-sm leading-relaxed ${
            message.error
              ? "border border-danger/20 bg-danger-soft text-danger"
              : unsupported
                ? "border border-warn/20 bg-warn-soft text-fg"
                : "border border-line bg-surface text-fg"
          }`}
        >
          {withCitations(message.text)}
        </div>
        {message.sources && message.sources.length > 0 && (
          <div className="mt-2.5">
            <p className="eyebrow mb-1.5">Sources</p>
            <ul className="grid gap-1.5 sm:grid-cols-2">
              {message.sources.map((s) => (
                <li
                  key={s.n}
                  className="flex items-start gap-2 rounded-xl border border-line bg-surface-2 px-3 py-2 text-xs"
                  title={`Similarity ${s.similarity}`}
                >
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md bg-accent-soft font-semibold text-accent-ink">
                    {s.n}
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-1 font-medium text-fg">
                      <FileText className="h-3 w-3 shrink-0 text-subtle" />
                      <span className="truncate">{s.title}</span>
                    </span>
                    <span className="block truncate text-muted">{s.heading}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {unsupported && <p className="mt-1.5 text-xs text-warn">Not covered by the knowledge base.</p>}
      </div>
    </div>
  );
}
