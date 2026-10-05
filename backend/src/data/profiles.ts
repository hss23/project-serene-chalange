import { dbError, supabaseAdmin } from "../lib/supabase";
import type { Format, MenteeProfile, MentorProfile } from "../matching/score";

type SkillJoin = { skills: { name: string } | { name: string }[] | null };
const skillName = (j: SkillJoin) => (Array.isArray(j.skills) ? j.skills[0]?.name : j.skills?.name) ?? "";

interface MenteeRow {
  id: string;
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
}

interface MentorRow {
  id: string;
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
  mentor_skills: (SkillJoin & { proficiency: number })[];
}

const MENTEE_SELECT = "*, mentee_goal_skills(priority, skills(name))";
const MENTOR_SELECT = "*, mentor_skills(proficiency, skills(name))";

const toMentee = (r: MenteeRow): MenteeProfile => ({
  id: r.id,
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

const toMentor = (r: MentorRow): MentorProfile => ({
  id: r.id,
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
  skills: r.mentor_skills
    .map((s) => ({ name: skillName(s), proficiency: s.proficiency }))
    .filter((s) => s.name)
    .sort((a, b) => b.proficiency - a.proficiency || a.name.localeCompare(b.name)),
});

export async function listMentees(): Promise<MenteeProfile[]> {
  const { data, error } = await supabaseAdmin().from("mentees").select(MENTEE_SELECT).order("id");
  if (error) dbError("listMentees", error);
  return (data as MenteeRow[]).map(toMentee);
}

export async function getMentee(id: string): Promise<MenteeProfile | null> {
  const { data, error } = await supabaseAdmin().from("mentees").select(MENTEE_SELECT).eq("id", id).maybeSingle();
  if (error) dbError("getMentee", error);
  return data ? toMentee(data as MenteeRow) : null;
}

export async function listMentors(): Promise<MentorProfile[]> {
  const { data, error } = await supabaseAdmin().from("mentors").select(MENTOR_SELECT).order("id");
  if (error) dbError("listMentors", error);
  return (data as MentorRow[]).map(toMentor);
}
