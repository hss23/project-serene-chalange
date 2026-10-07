import { FieldValue } from "firebase-admin/firestore";
import type { AppUser } from "../data/users";
import { adminDb } from "./firebaseAdmin";

export type AuditAction =
  | "status_change"
  | "role_change"
  | "profile_edit"
  | "user_delete"
  | "kb_create"
  | "kb_update"
  | "kb_delete"
  | "kb_reindex"
  | "setting_change";

/**
 * Append an admin action to Firestore `auditLog` (server-only; rules deny all client access).
 * Best effort: an audit failure is logged but never blocks the admin action itself.
 */
export async function writeAudit(
  actor: AppUser,
  action: AuditAction,
  target: { id: string; email: string | null; name: string | null },
  details: Record<string, unknown> = {},
): Promise<void> {
  try {
    await adminDb()
      .collection("auditLog")
      .add({
        action,
        actorId: actor.id,
        actorEmail: actor.email,
        targetId: target.id,
        targetEmail: target.email,
        targetName: target.name,
        details,
        at: FieldValue.serverTimestamp(),
      });
  } catch (err) {
    console.error("[audit] failed to write", action, err);
  }
}

export async function readAudit(opts: { targetId?: string; limit: number }) {
  let q = adminDb().collection("auditLog").orderBy("at", "desc").limit(opts.limit);
  if (opts.targetId) q = adminDb().collection("auditLog").where("targetId", "==", opts.targetId).limit(opts.limit);
  const snap = await q.get();
  const rows = snap.docs.map((d) => {
    const v = d.data();
    return { id: d.id, ...v, at: v.at?.toDate?.().toISOString() ?? null };
  });
  // Single-field filter + in-memory sort avoids needing a composite Firestore index.
  return rows.sort((a, b) => String(b.at).localeCompare(String(a.at)));
}
