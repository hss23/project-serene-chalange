import { z } from "zod";

export const SLOTS = ["weekday_morning", "weekday_afternoon", "weekday_evening", "weekend_morning", "weekend_afternoon"] as const;
export const FORMATS = ["remote", "in_person", "hybrid"] as const;

const text = (label: string, max: number, min = 1) =>
  z
    .string({ error: `${label} is required` })
    .trim()
    .min(min, `${label} is required`)
    .max(max, `${label} must be at most ${max} characters`);

const common = {
  name: text("Name", 80),
  industry: text("Industry", 60),
  city: text("City", 60),
  timezone_offset: z.coerce.number().min(-12, "Timezone must be between -12 and +14").max(14, "Timezone must be between -12 and +14"),
  languages: z.array(text("Language", 30)).min(1, "Add at least one language").max(8, "At most 8 languages"),
  format: z.enum(FORMATS, { error: "Choose a session format" }),
  availability: z.array(z.enum(SLOTS)).min(1, "Choose at least one availability slot").max(SLOTS.length),
};

export const MenteeProfileInput = z.object({
  ...common,
  goal_summary: text("Goal summary", 400, 10),
  career_stage: text("Career stage", 40),
  desired_min_years: z.coerce.number().int().min(0).max(40),
  goals: z
    .array(z.object({ name: text("Skill", 60), priority: z.coerce.number().int().min(1).max(3) }))
    .min(1, "Add at least one goal skill")
    .max(8, "At most 8 goal skills"),
});

export const MentorProfileInput = z.object({
  ...common,
  headline: text("Headline", 120),
  bio: text("Bio", 600, 10),
  years_experience: z.coerce.number().int().min(0).max(60),
  max_mentees: z.coerce.number().int().min(1).max(4, "At most 4 students at once").default(3),
  skills: z
    .array(z.object({ name: text("Skill", 60), proficiency: z.coerce.number().int().min(1).max(5) }))
    .min(1, "Add at least one skill")
    .max(12, "At most 12 skills"),
});

export type MenteeProfileInput = z.infer<typeof MenteeProfileInput>;
export type MentorProfileInput = z.infer<typeof MentorProfileInput>;

/** Reject duplicate skill names (case-insensitive). */
export function duplicateSkill(names: string[]): string | null {
  const seen = new Set<string>();
  for (const n of names) {
    const k = n.toLowerCase();
    if (seen.has(k)) return n;
    seen.add(k);
  }
  return null;
}
