import { Router } from "express";
import { z } from "zod";
import { getMenteeByUser, getMentorByUser, listSkillNames, saveMenteeProfile, saveMentorProfile } from "../data/profiles";
import { setInitialRole, upsertOnLogin, type AppUser } from "../data/users";
import { HttpError } from "../errors";
import { cacheUser, currentAppUser, currentUser, invalidateUser, requireActive, requireRole } from "../middleware/auth";
import { duplicateSkill, MenteeProfileInput, MentorProfileInput } from "../users/profileSchemas";
import { initialStatus, menteeComplete, mentorComplete, SELF_SERVICE_ROLES } from "../users/roles";

/** The account summary the frontend uses for routing (role, status, profile completeness). */
export async function buildMe(user: AppUser) {
  const profile =
    user.role === "student" ? await getMenteeByUser(user.id) : user.role === "teacher" ? await getMentorByUser(user.id) : null;
  const profileComplete =
    user.role === "admin" ? true : user.role === "student" ? menteeComplete(profile as never) : user.role === "teacher" ? mentorComplete(profile as never) : false;
  return {
    user: {
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      role: user.role,
      status: user.status,
      isDemo: user.is_demo,
      createdAt: user.created_at,
    },
    profile,
    profileComplete,
  };
}

const RoleBody = z.object({
  role: z.enum(SELF_SERVICE_ROLES, { error: "Role must be 'student' or 'teacher'." }),
});

export const meRouter = Router();

// Sync on every sign-in: refresh email/name/last seen (role and status are never changed here).
meRouter.post("/me", async (req, res) => {
  const u = currentUser(req);
  const prev = currentAppUser(req);
  const fresh = await upsertOnLogin(u.uid, u.email ?? prev.email, prev.display_name ?? u.name ?? u.email?.split("@")[0] ?? null);
  const user = { ...fresh, role: prev.role, status: prev.status }; // keep the admin promotion applied by loadAppUser
  cacheUser(user);
  res.json(await buildMe(user));
});

// Choose student or teacher, exactly once. Admin is never self-selectable.
meRouter.post("/me/role", async (req, res) => {
  const user = currentAppUser(req);
  const { role } = RoleBody.parse(req.body ?? {});
  if (user.role) throw new HttpError(409, "Your role is already set. Ask an admin to change it.", "role_locked");
  const updated = await setInitialRole(user.id, role, initialStatus(role, process.env.TEACHER_AUTO_APPROVE === "true"));
  if (!updated) throw new HttpError(409, "Your role is already set. Ask an admin to change it.", "role_locked");
  invalidateUser(updated.firebase_uid);
  res.json(await buildMe(updated));
});

// Everything below: suspended accounts are blocked.
export const profileRouter = Router();
profileRouter.use(requireActive);

profileRouter.get("/skills", async (_req, res) => {
  res.json({ skills: await listSkillNames() });
});

profileRouter.get("/profile", requireRole("student", "teacher"), async (req, res) => {
  res.json(await buildMe(currentAppUser(req)));
});

profileRouter.put("/profile", requireRole("student", "teacher"), async (req, res) => {
  const user = currentAppUser(req);
  await saveProfileFor(user, req.body);
  res.json(await buildMe(user));
});

/** Validate and save the profile for a user's role (shared with the admin editor). */
export async function saveProfileFor(user: AppUser, body: unknown) {
  if (user.role === "student") {
    const input = MenteeProfileInput.parse(body ?? {});
    const dup = duplicateSkill(input.goals.map((g) => g.name));
    if (dup) throw new HttpError(400, `"${dup}" is listed twice.`, "invalid_input");
    return saveMenteeProfile(user.id, input);
  }
  if (user.role === "teacher") {
    const input = MentorProfileInput.parse(body ?? {});
    const dup = duplicateSkill(input.skills.map((s) => s.name));
    if (dup) throw new HttpError(400, `"${dup}" is listed twice.`, "invalid_input");
    return saveMentorProfile(user.id, input);
  }
  throw new HttpError(400, "Only students and teachers have a matching profile.", "no_profile");
}
