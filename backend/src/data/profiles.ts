import { HttpError } from "../errors";
import { dbError, supabaseAdmin } from "../lib/supabase";
import type { Format, MenteeProfile, MentorProfile } from "../matching/score";
import { menteeComplete, mentorComplete, type Status } from "../users/roles";
import type { MenteeProfileInput, MentorProfileInput } from "../users/profileSchemas";

type SkillJoin = { skills: { name: string } | { name: string }[] | null };
const skillName = (j: SkillJoin) => (Array.isArray(j.skills) ? j.skills[0]?.name : j.skills?.name) ?? "";
type OwnerJoin = { status: Status } | { status: Status }[] | null;
const ownerStatus = (o: OwnerJoin): Status | null => (Array.isArray(o) ? (o[0]?.status ?? null) : (o?.status ?? null));

interface MenteeRow {
  id: string;
  user_id: string | null;
  name: string;
  goal_summary: string;
  career_stage: string;
  industry: string;
  desired_min_years: number;
  timezone_offset: number | string;
  languages: string[] | null;
  format: Format;
  city: string;
  availability: string[] | null;
  mentee_goal_skills: (SkillJoin & { priority: number })[];
  app_users?: OwnerJoin;
}

interface MentorRow {
  id: string;
  user_id: string | null;
  name: string;
  headline: string;
  bio: string;
  industry: string;
  years_experience: number;
  timezone_offset: number | string;
  languages: string[] | null;
  format: Format;
  city: string;
  availability: string[] | null;
  max_mentees: number;
  mentor_skills: (SkillJoin & { proficiency: number })[];
  app_users?: OwnerJoin;
}

/** Profiles carry their owner id so routes can check ownership. */
export type OwnedMentee = MenteeProfile & { user_id: string | null };
export type OwnedMentor = MentorProfile & { user_id: string | null; max_mentees: number };

const MENTEE_SELECT = "*, mentee_goal_skills(priority, skills(name)), app_users(status)";
const MENTOR_SELECT = "*, mentor_skills(proficiency, skills(name)), app_users(status)";

const toMentee = (r: MenteeRow): OwnedMentee => ({
  id: r.id,
  user_id: r.user_id,
  name: r.name,
  goal_summary: r.goal_summary,
  career_stage: r.career_stage,
  industry: r.industry,
  desired_min_years: r.desired_min_years,
  timezone_offset: Number(r.timezone_offset), // Postgres numeric may arrive as a string
  languages: r.languages ?? [],
  format: r.format,
  city: r.city,
  availability: r.availability ?? [],
  goals: r.mentee_goal_skills
    .map((g) => ({ name: skillName(g), priority: g.priority }))
    .filter((g) => g.name)
    .sort((a, b) => b.priority - a.priority || a.name.localeCompare(b.name)),
});

const toMentor = (r: MentorRow): OwnedMentor => ({
  id: r.id,
  user_id: r.user_id,
  name: r.name,
  headline: r.headline,
  bio: r.bio,
  industry: r.industry,
  years_experience: r.years_experience,
  timezone_offset: Number(r.timezone_offset),
  languages: r.languages ?? [],
  format: r.format,
  city: r.city,
  availability: r.availability ?? [],
  max_mentees: r.max_mentees,
  skills: r.mentor_skills
    .map((s) => ({ name: skillName(s), proficiency: s.proficiency }))
    .filter((s) => s.name)
    .sort((a, b) => b.proficiency - a.proficiency || a.name.localeCompare(b.name)),
});

// A profile takes part in matching when its owner is active (or it has no linked account yet,
// e.g. seed rows before `npm run seed:users`) and the profile is complete.
const eligible = (status: Status | null) => status === null || status === "active";

export async function listMentees(opts: { eligibleOnly?: boolean } = {}): Promise<OwnedMentee[]> {
  const { data, error } = await supabaseAdmin().from("mentees").select(MENTEE_SELECT).order("id");
  if (error) dbError("listMentees", error);
  const rows = data as MenteeRow[];
  const list = opts.eligibleOnly ? rows.filter((r) => eligible(ownerStatus(r.app_users ?? null))) : rows;
  return list.map(toMentee).filter((m) => !opts.eligibleOnly || menteeComplete(m));
}

export async function listMentors(opts: { eligibleOnly?: boolean } = {}): Promise<OwnedMentor[]> {
  const { data, error } = await supabaseAdmin().from("mentors").select(MENTOR_SELECT).order("id");
  if (error) dbError("listMentors", error);
  const rows = data as MentorRow[];
  const list = opts.eligibleOnly ? rows.filter((r) => eligible(ownerStatus(r.app_users ?? null))) : rows;
  return list.map(toMentor).filter((m) => !opts.eligibleOnly || mentorComplete(m));
}

export async function getMentee(id: string): Promise<OwnedMentee | null> {
  const { data, error } = await supabaseAdmin().from("mentees").select(MENTEE_SELECT).eq("id", id).maybeSingle();
  if (error) dbError("getMentee", error);
  return data ? toMentee(data as MenteeRow) : null;
}

export async function getMenteeByUser(userId: string): Promise<OwnedMentee | null> {
  const { data, error } = await supabaseAdmin().from("mentees").select(MENTEE_SELECT).eq("user_id", userId).maybeSingle();
  if (error) dbError("getMenteeByUser", error);
  return data ? toMentee(data as MenteeRow) : null;
}

export async function getMentorByUser(userId: string): Promise<OwnedMentor | null> {
  const { data, error } = await supabaseAdmin().from("mentors").select(MENTOR_SELECT).eq("user_id", userId).maybeSingle();
  if (error) dbError("getMentorByUser", error);
  return data ? toMentor(data as MentorRow) : null;
}

export async function listSkillNames(): Promise<{ name: string; category: string }[]> {
  const { data, error } = await supabaseAdmin().from("skills").select("name, category").order("category").order("name");
  if (error) dbError("listSkillNames", error);
  return data ?? [];
}

async function assertKnownSkills(names: string[]) {
  const known = new Set((await listSkillNames()).map((s) => s.name));
  const unknown = names.filter((n) => !known.has(n));
  if (unknown.length) throw new HttpError(400, `Unknown skill: ${unknown.join(", ")}`, "invalid_input");
}

/** Insert or update a student's profile and goal skills in one database transaction. */
export async function saveMenteeProfile(userId: string, input: MenteeProfileInput): Promise<string> {
  await assertKnownSkills(input.goals.map((g) => g.name));
  const { goals, ...profile } = input;
  const { data, error } = await supabaseAdmin().rpc("save_mentee_profile", {
    p_user_id: userId,
    p_profile: profile,
    p_goals: goals,
  });
  if (error) dbError("save_mentee_profile", error);
  return data as string;
}

/** Insert or update a teacher's profile and skills in one database transaction. */
export async function saveMentorProfile(userId: string, input: MentorProfileInput): Promise<string> {
  await assertKnownSkills(input.skills.map((s) => s.name));
  const { skills, ...profile } = input;
  const { data, error } = await supabaseAdmin().rpc("save_mentor_profile", {
    p_user_id: userId,
    p_profile: profile,
    p_skills: skills,
  });
  if (error) dbError("save_mentor_profile", error);
  return data as string;
}

/** Remove any student/teacher profile owned by a user (used when an admin changes their role). */
export async function deleteProfilesForUser(userId: string): Promise<void> {
  const db = supabaseAdmin();
  const [a, b] = await Promise.all([
    db.from("mentees").delete().eq("user_id", userId),
    db.from("mentors").delete().eq("user_id", userId),
  ]);
  if (a.error) dbError("delete mentee profile", a.error);
  if (b.error) dbError("delete mentor profile", b.error);
}
