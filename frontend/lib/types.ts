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
  /** Present only when mentorship requests are enabled. */
  spotsLeft?: number;
  requestStatus?: MentorshipStatus | null;
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

// ---- Accounts and roles ----
export type Role = "student" | "teacher" | "admin";
export type Status = "active" | "pending" | "suspended";

export interface AccountSummary {
  id: string;
  email: string | null;
  displayName: string | null;
  role: Role | null;
  status: Status;
  isDemo: boolean;
  createdAt: string;
}

export type OwnedMentee = MenteeProfile & { user_id: string | null };
export type OwnedMentor = MentorProfile & { user_id: string | null; max_mentees: number };

/** Response of POST /api/me, /api/me/role, GET/PUT /api/profile. */
export interface Me {
  user: AccountSummary;
  profile: OwnedMentee | OwnedMentor | null;
  profileComplete: boolean;
}

export interface Skill {
  name: string;
  category: string;
}

export interface StudentMatch {
  menteeId: string;
  menteeName: string;
  careerStage: string;
  goalSummary: string;
  score: number;
  weak: boolean;
  breakdown: ComponentScore[];
  reasons: string[];
  caveats: string[];
}

export interface StudentMatchesResponse {
  mentor: OwnedMentor;
  results: StudentMatch[];
  candidatesConsidered: number;
  method: ScoringMethod;
}

/** Admin list rows (snake_case straight from Postgres). */
export interface AdminUser {
  id: string;
  firebase_uid: string;
  email: string | null;
  display_name: string | null;
  role: Role | null;
  status: Status;
  is_demo: boolean;
  created_at: string;
  last_seen_at: string;
  profile: { kind: "mentee" | "mentor"; id: string; name: string } | null;
}

export interface AuditEntry {
  id: string;
  action:
    | "status_change"
    | "role_change"
    | "profile_edit"
    | "user_delete"
    | "kb_create"
    | "kb_update"
    | "kb_delete"
    | "kb_reindex"
    | "setting_change";
  actorEmail: string | null;
  targetEmail: string | null;
  targetName: string | null;
  details: Record<string, unknown>;
  at: string | null;
}

export interface AdminStats {
  students: Record<Status, number>;
  teachers: Record<Status, number>;
  admins: Record<Status, number>;
  noRole: number;
  pendingTeachers: AdminUser[];
  mentorships: Record<MentorshipStatus, number>;
  features: Features;
}

export interface AdminUserDetail {
  user: AdminUser;
  profile: OwnedMentee | OwnedMentor | null;
  profileComplete: boolean;
  audit: AuditEntry[];
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
  mentorshipRequests?: boolean;
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

// ---- Feature flags ----
export interface Features {
  mentorshipRequests: boolean;
}

// ---- Knowledge base (admin) ----
export interface KbDocumentSummary {
  id: number;
  slug: string;
  title: string;
  source: string;
  managed_by: "repo" | "admin";
  chunk_count: number;
  ingested_at: string | null;
  ingest_error: string | null;
  updated_at: string;
}

export interface KbDocumentDetail {
  document: KbDocumentSummary & { content: string | null };
  chunks: { index: number; heading: string; preview: string }[];
}

export interface KbSaveResult {
  id: number;
  slug: string;
  chunkCount: number;
  embedded: number;
  unchanged: number;
  removed: number;
  error: string | null;
  status: "indexed" | "error";
  message: string;
}

// ---- Mentorship requests ----
export type MentorshipStatus = "pending" | "accepted" | "declined" | "cancelled" | "expired" | "ended";

export interface MentorshipRequest {
  id: string;
  mentee_id: string;
  mentor_id: string;
  status: MentorshipStatus;
  message: string | null;
  score: number | null;
  created_at: string;
  responded_at: string | null;
  ended_at: string | null;
}

export interface StudentMentorshipRequest extends MentorshipRequest {
  mentor: { id: string; name: string; headline: string; industry: string } | null;
  mentorEmail: string | null;
}

export interface TeacherMentorshipRequest extends MentorshipRequest {
  mentee: { id: string; name: string; careerStage: string; goalSummary: string } | null;
  menteeEmail: string | null;
  daysLeft: number | null;
}

export type MentorshipList =
  | { role: "student"; requests: StudentMentorshipRequest[] }
  | { role: "teacher"; requests: TeacherMentorshipRequest[]; capacity: { used: number; max: number } };
