// API contract with the Express backend (backend/src). Keep in sync with
// backend/src/matching/score.ts and backend/src/rag/prompt.ts.

export type Format = "remote" | "in_person" | "hybrid";
export type ComponentKey = "skills" | "availability" | "experience" | "timezone" | "industry" | "format";

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

export interface ComponentScore {
  key: ComponentKey;
  label: string;
  weight: number;
  score: number;
  contribution: number;
  detail: string;
  specified: boolean;
}

export interface MatchResult {
  mentorId: string;
  mentorName: string;
  headline: string;
  score: number;
  weak: boolean;
  breakdown: ComponentScore[];
  reasons: string[];
  caveats: string[];
}

export interface Source {
  n: number;
  title: string;
  heading: string;
  slug: string;
  similarity: number;
}

export interface ScoringMethod {
  weights: Record<ComponentKey, number>;
  labels: Record<ComponentKey, string>;
  weakThreshold: number;
}

export interface MenteesResponse {
  mentees: MenteeProfile[];
}

export interface MentorsResponse {
  mentors: MentorProfile[];
}

export interface MatchResponse {
  mentee: MenteeProfile;
  results: MatchResult[];
  candidatesConsidered: number;
  historySaved: boolean;
  method: ScoringMethod;
}

export interface ChatResponse {
  answer: string;
  sources: Source[];
  supported: boolean;
  saved: boolean;
  retrieved: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  sources?: Source[];
  supported?: boolean;
  pending?: boolean;
  error?: boolean;
}

export const SLOT_LABELS: Record<string, string> = {
  weekday_morning: "Weekday mornings",
  weekday_afternoon: "Weekday afternoons",
  weekday_evening: "Weekday evenings",
  weekend_morning: "Weekend mornings",
  weekend_afternoon: "Weekend afternoons",
};

export const formatTz = (offset: number) => {
  const sign = offset >= 0 ? "+" : "-";
  const abs = Math.abs(offset);
  const h = Math.floor(abs);
  const m = Math.round((abs - h) * 60);
  return `UTC${sign}${h}${m ? `:${String(m).padStart(2, "0")}` : ""}`;
};
