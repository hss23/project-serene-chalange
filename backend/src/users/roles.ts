// Pure role/profile rules (no I/O) so they can be unit tested.
import type { MenteeProfile, MentorProfile } from "../matching/score";

export type Role = "student" | "teacher" | "admin";
export type Status = "active" | "pending" | "suspended";
export const SELF_SERVICE_ROLES = ["student", "teacher"] as const; // admin is never self-selected

/** ADMIN_EMAILS="a@x.com, B@y.com" → Set of lower-cased emails. */
export function parseAdminEmails(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

/** Admin comes only from the server-side allow-list; everyone else keeps their stored role. */
export function resolveRole(email: string | undefined | null, adminEmails: Set<string>, current: Role | null): Role | null {
  if (email && adminEmails.has(email.trim().toLowerCase())) return "admin";
  return current;
}

/** Teachers wait for admin approval before appearing in matching (unless auto-approve is configured). */
export function initialStatus(role: Role, autoApproveTeachers = false): Status {
  return role === "teacher" && !autoApproveTeachers ? "pending" : "active";
}

/** A profile is complete when the scorer has enough to work with. */
export function menteeComplete(p: MenteeProfile | null | undefined): boolean {
  return Boolean(
    p && p.name.trim() && p.industry.trim() && p.goals.length > 0 && p.availability.length > 0 && p.languages.length > 0,
  );
}

export function mentorComplete(p: MentorProfile | null | undefined): boolean {
  return Boolean(
    p && p.name.trim() && p.industry.trim() && p.skills.length > 0 && p.availability.length > 0 && p.languages.length > 0,
  );
}

/** Validation for admin role/status changes. Returns an error message, or null if allowed. */
export function checkAdminChange(opts: {
  actorId: string;
  targetId: string;
  targetRole: Role | null;
  newRole?: Role;
  newStatus?: Status;
  adminCount: number;
  deleting?: boolean;
}): string | null {
  const { actorId, targetId, targetRole, newRole, newStatus, adminCount, deleting } = opts;
  const self = actorId === targetId;
  if (self && (deleting || newStatus === "suspended" || (newRole && newRole !== "admin"))) {
    return "You can't suspend, demote or delete your own admin account.";
  }
  const removesAdmin = targetRole === "admin" && (deleting || newStatus === "suspended" || (newRole && newRole !== "admin"));
  if (removesAdmin && adminCount <= 1) return "There must always be at least one active admin.";
  return null;
}
