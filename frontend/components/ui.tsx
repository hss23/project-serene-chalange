import type { LucideIcon } from "lucide-react";
import { AlertCircle, Info, RotateCw } from "lucide-react";
import type { ReactNode } from "react";

export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
    />
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-surface-2 ${className}`} />;
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-2xl border border-danger/20 bg-danger-soft p-4 text-sm text-danger"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span className="flex-1">{message}</span>
      {onRetry && (
        <button onClick={onRetry} className="inline-flex shrink-0 items-center gap-1 font-medium hover:underline">
          <RotateCw className="h-3.5 w-3.5" /> Retry
        </button>
      )}
    </div>
  );
}

export function InfoBanner({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-warn/20 bg-warn-soft p-4 text-sm text-warn">
      <Info className="mt-0.5 h-4 w-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, children }: { icon?: LucideIcon; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-line bg-surface/60 px-6 py-14 text-center">
      {Icon && (
        <span className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-accent-soft text-accent-ink">
          <Icon className="h-6 w-6" />
        </span>
      )}
      <p className="font-semibold text-fg">{title}</p>
      {children && <div className="mt-1.5 max-w-sm text-sm text-muted">{children}</div>}
    </div>
  );
}

export function PageHeader({
  icon: Icon,
  title,
  subtitle,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="flex items-start gap-4">
        {Icon && (
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl brand-gradient text-white shadow-sm">
            <Icon className="h-5 w-5" />
          </span>
        )}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-fg sm:text-[1.65rem]">{title}</h1>
          {subtitle && <p className="mt-1 max-w-2xl text-sm text-muted">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

/** Deterministic gradient avatar with initials (no external images). */
const GRADIENTS = [
  "from-indigo-500 to-violet-500",
  "from-sky-500 to-indigo-500",
  "from-emerald-500 to-teal-500",
  "from-amber-500 to-orange-500",
  "from-rose-500 to-pink-500",
  "from-fuchsia-500 to-purple-500",
  "from-cyan-500 to-blue-500",
];

export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const clean = name.replace(/^(Dr|Mr|Ms|Mrs)\.?\s+/i, "");
  const initials = clean
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
  const hash = [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  const sizes = { sm: "h-8 w-8 text-xs", md: "h-11 w-11 text-sm", lg: "h-14 w-14 text-base" };
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-full bg-gradient-to-br font-semibold text-white ${GRADIENTS[hash % GRADIENTS.length]} ${sizes[size]}`}
    >
      {initials}
    </span>
  );
}

/** Circular score indicator, 0–100. */
export function ScoreRing({ score, weak, size = 64 }: { score: number; weak?: boolean; size?: number }) {
  const stroke = size >= 56 ? 6 : 4;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score)) / 100;
  const color = weak ? "var(--warn)" : score >= 75 ? "var(--success)" : "var(--accent)";
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`Score ${score} out of 100`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          style={{ transition: "stroke-dashoffset 0.8s ease-out" }}
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center">
        <span className={`font-semibold tabular-nums text-fg ${size >= 56 ? "text-lg" : "text-xs"}`}>{score}</span>
      </span>
    </div>
  );
}

/** Thin horizontal bar, 0–1. */
export function Bar({ value, tone = "accent" }: { value: number; tone?: "accent" | "success" | "warn" }) {
  const bg = { accent: "bg-accent", success: "bg-success", warn: "bg-warn" }[tone];
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2" aria-hidden>
      <div className={`h-full rounded-full ${bg} transition-[width] duration-700`} style={{ width: `${Math.max(2, value * 100)}%` }} />
    </div>
  );
}
