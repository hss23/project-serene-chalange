import { ROLE_LABEL } from "@/lib/roles";
import type { Role, Status } from "@/lib/types";

export function RoleBadge({ role }: { role: Role | null }) {
  if (!role) return <span className="chip">No role</span>;
  const cls = { student: "bg-sky-500/10 text-sky-600 dark:text-sky-400", teacher: "bg-violet-500/10 text-violet-600 dark:text-violet-400", admin: "bg-amber-500/10 text-amber-700 dark:text-amber-400" }[role];
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>{ROLE_LABEL[role]}</span>;
}

export function StatusBadge({ status }: { status: Status }) {
  const cls = { active: "bg-success-soft text-success", pending: "bg-warn-soft text-warn", suspended: "bg-danger-soft text-danger" }[status];
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${cls}`}>{status}</span>;
}
