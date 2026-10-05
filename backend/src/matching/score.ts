// Transparent, deterministic mentor-matching scorer.
// Pure functions only: no I/O, no randomness, no LLM. Same input gives the same ranking.

export type Format = "remote" | "in_person" | "hybrid";

export interface MentorProfile {
  id: string;
  name: string;
  headline: string;
  bio: string;
  industry: string;
  years_experience: number;
  timezone_offset: number;
  languages: string[];
  format: Format;
  city: string;
  availability: string[];
  skills: { name: string; proficiency: number }[];
}

export interface MenteeProfile {
  id: string;
  name: string;
  goal_summary: string;
  career_stage: string;
  industry: string;
  desired_min_years: number;
  timezone_offset: number;
  languages: string[];
  format: Format;
  city: string;
  availability: string[];
  goals: { name: string; priority: number }[];
}

export type ComponentKey = "skills" | "availability" | "experience" | "timezone" | "industry" | "format";

export const WEIGHTS: Record<ComponentKey, number> = {
  skills: 0.4,
  availability: 0.15,
  experience: 0.15,
  timezone: 0.1,
  industry: 0.1,
  format: 0.1,
};

export const COMPONENT_LABELS: Record<ComponentKey, string> = {
  skills: "Skill fit",
  availability: "Availability overlap",
  experience: "Experience",
  timezone: "Timezone",
  industry: "Industry",
  format: "Format & language",
};

export const WEAK_MATCH_THRESHOLD = 40;

export interface ComponentScore {
  key: ComponentKey;
  label: string;
  weight: number;
  score: number; // 0..1
  contribution: number; // weight * score, 0..weight
  detail: string; // human readable explanation of this component
  specified: boolean; // false when the mentee gave no constraint (neutral score)
}

export interface MatchResult {
  mentorId: string;
  mentorName: string;
  headline: string;
  score: number; // 0..100, integer
  weak: boolean;
  breakdown: ComponentScore[];
  reasons: string[]; // at least 2
  caveats: string[];
}

const SLOT_LABELS: Record<string, string> = {
  weekday_morning: "weekday mornings",
  weekday_afternoon: "weekday afternoons",
  weekday_evening: "weekday evenings",
  weekend_morning: "weekend mornings",
  weekend_afternoon: "weekend afternoons",
};

const slotLabel = (s: string) => SLOT_LABELS[s] ?? s.replace(/_/g, " ");
const listJoin = (xs: string[]) =>
  xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;
const fmtHours = (h: number) => `${Number.isInteger(h) ? h : h.toFixed(1)}h`;

/** Circular timezone difference in hours (0..12). Handles half-hour offsets such as +5.5. */
export function timezoneDiff(a: number, b: number): number {
  const d = Math.abs(a - b) % 24;
  return Math.min(d, 24 - d);
}

export function formatCompatibility(mentee: MenteeProfile, mentor: MentorProfile): number {
  const sameCity = mentee.city.trim().toLowerCase() === mentor.city.trim().toLowerCase();
  if (mentee.format === "in_person" || mentor.format === "in_person") {
    // In-person needs the same city and neither side remote-only.
    return sameCity && mentee.format !== "remote" && mentor.format !== "remote" ? 1 : 0;
  }
  if (mentee.format === mentor.format) return 1; // remote+remote or hybrid+hybrid
  return 0.75; // hybrid + remote: workable, remote sessions only
}

export function scoreComponents(mentee: MenteeProfile, mentor: MentorProfile): ComponentScore[] {
  const make = (key: ComponentKey, score: number, detail: string, specified = true): ComponentScore => {
    const s = Math.max(0, Math.min(1, score));
    return { key, label: COMPONENT_LABELS[key], weight: WEIGHTS[key], score: s, contribution: WEIGHTS[key] * s, detail, specified };
  };

  // 1. Skill fit: priority-weighted coverage of the mentee's goal skills, scaled by mentor proficiency.
  const mentorSkills = new Map(mentor.skills.map((s) => [s.name.toLowerCase(), s.proficiency]));
  const goals = [...mentee.goals].sort((a, b) => b.priority - a.priority || a.name.localeCompare(b.name));
  const totalPriority = goals.reduce((sum, g) => sum + g.priority, 0);
  let skills: ComponentScore;
  if (totalPriority === 0) {
    skills = make("skills", 1, "No goal skills specified", false);
  } else {
    const covered = goals.filter((g) => mentorSkills.has(g.name.toLowerCase()));
    const earned = covered.reduce((sum, g) => sum + g.priority * (mentorSkills.get(g.name.toLowerCase())! / 5), 0);
    skills = make(
      "skills",
      earned / totalPriority,
      covered.length
        ? `Covers ${covered.length} of ${goals.length} goal skills: ${listJoin(covered.map((g) => g.name))}`
        : `Covers none of the ${goals.length} goal skills`,
    );
  }

  // 2. Availability: share of the mentee's time slots the mentor also offers.
  let availability: ComponentScore;
  if (mentee.availability.length === 0) {
    availability = make("availability", 1, "No availability preference specified", false);
  } else {
    const shared = mentee.availability.filter((s) => mentor.availability.includes(s));
    availability = make(
      "availability",
      shared.length / mentee.availability.length,
      shared.length ? `Both available ${listJoin(shared.map(slotLabel))}` : "No overlapping time slots",
    );
  }

  // 3. Experience: full marks at or above the desired minimum, linear below it.
  let experience: ComponentScore;
  if (mentee.desired_min_years <= 0) {
    experience = make("experience", 1, `${mentor.years_experience} years of experience`, false);
  } else {
    const ok = mentor.years_experience >= mentee.desired_min_years;
    experience = make(
      "experience",
      ok ? 1 : mentor.years_experience / mentee.desired_min_years,
      ok
        ? `${mentor.years_experience} years of experience (wanted ${mentee.desired_min_years}+)`
        : `${mentor.years_experience} years of experience (you wanted ${mentee.desired_min_years}+)`,
    );
  }

  // 4. Timezone: linear decay, zero at 8h or more apart.
  const tz = timezoneDiff(mentee.timezone_offset, mentor.timezone_offset);
  const timezone = make(
    "timezone",
    1 - tz / 8,
    tz === 0 ? "Same timezone" : `${fmtHours(tz)} timezone difference`,
  );

  // 5. Industry: exact match.
  const sameIndustry = mentee.industry.toLowerCase() === mentor.industry.toLowerCase();
  const industry = make(
    "industry",
    sameIndustry ? 1 : 0,
    sameIndustry ? `Both work in ${mentor.industry}` : `Works in ${mentor.industry} (you: ${mentee.industry})`,
  );

  // 6. Format + language: half for a compatible session format, half for a shared language.
  const fmt = formatCompatibility(mentee, mentor);
  const menteeLangs = new Set(mentee.languages.map((l) => l.toLowerCase()));
  const sharedLangs = mentor.languages.filter((l) => menteeLangs.has(l.toLowerCase()));
  const langSpecified = mentee.languages.length > 0;
  const lang = !langSpecified || sharedLangs.length > 0 ? 1 : 0;
  const fmtLabel = mentor.format.replace("_", "-");
  const fmtText = fmt === 1 ? `${fmtLabel[0].toUpperCase()}${fmtLabel.slice(1)} sessions suit you` : fmt > 0 ? "Remote sessions possible" : "Session format doesn't match";
  const langText = !langSpecified ? "" : sharedLangs.length ? `you both speak ${listJoin(sharedLangs)}` : "no shared language";
  const format = make("format", 0.5 * fmt + 0.5 * lang, langText ? `${fmtText}; ${langText}` : fmtText);

  return [skills, availability, experience, timezone, industry, format];
}

export function scoreMatch(mentee: MenteeProfile, mentor: MentorProfile): MatchResult {
  const breakdown = scoreComponents(mentee, mentor);
  const raw = breakdown.reduce((sum, c) => sum + c.contribution, 0);
  const score = Math.round(raw * 100);

  // Reasons: strongest specified components first (by weighted contribution, then fixed order).
  const order: ComponentKey[] = ["skills", "availability", "experience", "timezone", "industry", "format"];
  const ranked = [...breakdown].sort(
    (a, b) => b.contribution - a.contribution || order.indexOf(a.key) - order.indexOf(b.key),
  );
  const reasons = ranked.filter((c) => c.specified && c.score >= 0.5).slice(0, 3).map((c) => c.detail);
  // Guarantee at least two reasons: fill with factual details from the remaining components.
  for (const c of ranked) {
    if (reasons.length >= 2) break;
    if (!reasons.includes(c.detail)) reasons.push(c.detail);
  }
  const caveats = breakdown.filter((c) => c.specified && c.score < 0.5).map((c) => c.detail);

  return {
    mentorId: mentor.id,
    mentorName: mentor.name,
    headline: mentor.headline,
    score,
    weak: score < WEAK_MATCH_THRESHOLD,
    breakdown,
    reasons,
    caveats,
  };
}

/** Rank all mentors for a mentee. Ties are broken by mentor id so the order is stable. */
export function rankMentors(mentee: MenteeProfile, mentors: MentorProfile[], limit = 5): MatchResult[] {
  const n = Math.max(1, Math.min(limit, 10));
  return mentors
    .map((m) => scoreMatch(mentee, m))
    .sort((a, b) => b.score - a.score || a.mentorId.localeCompare(b.mentorId))
    .slice(0, n);
}
