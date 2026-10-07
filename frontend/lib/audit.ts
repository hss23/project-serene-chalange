import type { AuditEntry } from "./types";

/** Human-readable line for an audit log entry. */
export function describeAudit(a: AuditEntry): string {
  const who = a.targetName || a.targetEmail || "a user";
  const d = a.details ?? {};
  switch (a.action) {
    case "status_change":
      return d.to === "active" && d.from === "pending"
        ? `Approved ${who}`
        : d.to === "suspended"
          ? `Suspended ${who}`
          : d.to === "active"
            ? `Reactivated ${who}`
            : `Set ${who} to ${String(d.to)}`;
    case "role_change":
      return `Changed ${who} from ${String(d.from ?? "no role")} to ${String(d.to)}`;
    case "profile_edit":
      return `Edited ${who}'s profile`;
    case "user_delete":
      return `Deleted ${who}${d.role ? ` (${String(d.role)})` : ""}`;
    case "kb_create":
      return `Added knowledge document “${who}” (${String(d.chunks ?? "?")} sections)`;
    case "kb_update":
      return `Edited knowledge document “${who}”`;
    case "kb_delete":
      return `Deleted knowledge document “${who}”`;
    case "kb_reindex":
      return `Re-indexed knowledge document “${who}”${d.ok === false ? " (failed)" : ""}`;
    case "setting_change":
      return `${d.to ? "Enabled" : "Disabled"} ${who === "mentorshipRequests" ? "mentorship requests" : who}`;
    default:
      return `${a.action} on ${who}`;
  }
}
