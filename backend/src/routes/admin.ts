import { Router } from "express";
import { z } from "zod";
import { deleteProfilesForUser, getMenteeByUser, getMentorByUser } from "../data/profiles";
import {
  countActiveAdmins,
  deleteUserRow,
  getUserById,
  getUserWithProfile,
  listUsers,
  roleStatusCounts,
  updateUser,
  type AppUser,
} from "../data/users";
import { statusCounts } from "../data/mentorships";
import { getFeatures } from "../data/settings";
import { HttpError } from "../errors";
import { readAudit, writeAudit } from "../lib/audit";
import { adminAuth, adminDb } from "../lib/firebaseAdmin";
import { currentAppUser, invalidateUser, requireRole } from "../middleware/auth";
import { checkAdminChange, menteeComplete, mentorComplete } from "../users/roles";
import { buildMe, saveProfileFor } from "./me";

const ROLES = ["student", "teacher", "admin"] as const;
const STATUSES = ["active", "pending", "suspended"] as const;

const ListQuery = z.object({
  role: z.enum(ROLES).optional(),
  status: z.enum(STATUSES).optional(),
  q: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(0).max(1000).default(0),
});
const IdParam = z.object({ id: z.string().uuid("Invalid user id") });
const Patch = z
  .object({ status: z.enum(STATUSES).optional(), role: z.enum(ROLES).optional() })
  .refine((b) => (b.status ? 1 : 0) + (b.role ? 1 : 0) === 1, "Send exactly one of status or role.");

export const adminRouter = Router();
adminRouter.use(requireRole("admin"));

async function loadTarget(id: string): Promise<AppUser> {
  const user = await getUserById(id);
  if (!user) throw new HttpError(404, "User not found.", "not_found");
  return user;
}

const auditTarget = (u: AppUser) => ({ id: u.id, email: u.email, name: u.display_name });

/** Keep Firebase sign-in in line with the account status (best effort for accounts without a Firebase user). */
async function syncFirebaseStatus(user: AppUser) {
  try {
    await adminAuth().updateUser(user.firebase_uid, { disabled: user.status === "suspended" });
    if (user.status === "suspended") await adminAuth().revokeRefreshTokens(user.firebase_uid);
  } catch (err) {
    if ((err as { code?: string }).code !== "auth/user-not-found") throw err;
  }
}

adminRouter.get("/stats", async (_req, res) => {
  const counts = await roleStatusCounts();
  const by = (role: string) => ({
    active: counts[`${role}:active`] ?? 0,
    pending: counts[`${role}:pending`] ?? 0,
    suspended: counts[`${role}:suspended`] ?? 0,
  });
  const [pendingTeachers, mentorships, features] = await Promise.all([
    listUsers({ role: "teacher", status: "pending", page: 0, pageSize: 10 }),
    statusCounts(),
    getFeatures(),
  ]);
  res.json({
    students: by("student"),
    teachers: by("teacher"),
    admins: by("admin"),
    noRole: (counts["none:active"] ?? 0) + (counts["none:pending"] ?? 0) + (counts["none:suspended"] ?? 0),
    pendingTeachers: pendingTeachers.users,
    mentorships,
    features,
  });
});

adminRouter.get("/users", async (req, res) => {
  const { role, status, q, page } = ListQuery.parse(req.query);
  const pageSize = 20;
  const { users, total } = await listUsers({ role, status, q, page, pageSize });
  res.json({ users, total, page, pageSize });
});

adminRouter.get("/users/:id", async (req, res) => {
  const { id } = IdParam.parse(req.params);
  const user = await getUserWithProfile(id);
  if (!user) throw new HttpError(404, "User not found.", "not_found");
  const profile =
    user.role === "student" ? await getMenteeByUser(id) : user.role === "teacher" ? await getMentorByUser(id) : null;
  const profileComplete =
    user.role === "student" ? menteeComplete(profile as never) : user.role === "teacher" ? mentorComplete(profile as never) : true;
  const audit = await readAudit({ targetId: id, limit: 20 }).catch(() => []);
  res.json({ user, profile, profileComplete, audit });
});

adminRouter.patch("/users/:id", async (req, res) => {
  const actor = currentAppUser(req);
  const { id } = IdParam.parse(req.params);
  const body = Patch.parse(req.body ?? {});
  const target = await loadTarget(id);
  const problem = checkAdminChange({
    actorId: actor.id,
    targetId: target.id,
    targetRole: target.role,
    newRole: body.role,
    newStatus: body.status,
    adminCount: await countActiveAdmins(),
  });
  if (problem) throw new HttpError(400, problem, "not_allowed");

  let updated: AppUser;
  if (body.status) {
    updated = await updateUser(id, { status: body.status });
    await syncFirebaseStatus(updated);
    await writeAudit(actor, "status_change", auditTarget(target), { from: target.status, to: body.status });
  } else {
    // Role change: the old student/teacher profile no longer applies, so the user re-onboards.
    if (body.role !== target.role) await deleteProfilesForUser(id);
    updated = await updateUser(id, { role: body.role!, status: target.status === "suspended" ? "suspended" : "active" });
    await writeAudit(actor, "role_change", auditTarget(target), { from: target.role, to: body.role });
  }
  invalidateUser(target.firebase_uid);
  res.json(await buildMe(updated));
});

adminRouter.put("/users/:id/profile", async (req, res) => {
  const actor = currentAppUser(req);
  const { id } = IdParam.parse(req.params);
  const target = await loadTarget(id);
  await saveProfileFor(target, req.body);
  await writeAudit(actor, "profile_edit", auditTarget(target));
  res.json(await buildMe(target));
});

adminRouter.delete("/users/:id", async (req, res) => {
  const actor = currentAppUser(req);
  const { id } = IdParam.parse(req.params);
  const target = await loadTarget(id);
  const problem = checkAdminChange({
    actorId: actor.id,
    targetId: target.id,
    targetRole: target.role,
    adminCount: await countActiveAdmins(),
    deleting: true,
  });
  if (problem) throw new HttpError(400, problem, "not_allowed");

  // 1) Firebase account, 2) private Firestore data, 3) Postgres row (profile + skills cascade).
  try {
    await adminAuth().deleteUser(target.firebase_uid);
  } catch (err) {
    if ((err as { code?: string }).code !== "auth/user-not-found") throw err;
  }
  await adminDb().recursiveDelete(adminDb().doc(`users/${target.firebase_uid}`));
  await deleteUserRow(id);
  invalidateUser(target.firebase_uid);
  await writeAudit(actor, "user_delete", auditTarget(target), { role: target.role });
  res.json({ deleted: true });
});

adminRouter.get("/audit", async (req, res) => {
  const limit = z.coerce.number().int().min(1).max(100).default(30).parse(req.query.limit);
  res.json({ entries: await readAudit({ limit }) });
});
