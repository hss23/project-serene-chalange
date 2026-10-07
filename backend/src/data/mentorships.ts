import { HttpError } from "../errors";
import { dbError, supabaseAdmin } from "../lib/supabase";

export type MentorshipStatus = "pending" | "accepted" | "declined" | "cancelled" | "expired" | "ended";
export const OPEN_STATUSES: MentorshipStatus[] = ["pending", "accepted"];

export interface MentorshipRow {
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

const one = <T>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

/** Lazily expire pending requests older than seven days (called before reads and writes). */
export async function expireStale(): Promise<void> {
  const { error } = await supabaseAdmin().rpc("expire_stale_mentorship_requests");
  if (error) dbError("expire mentorship requests", error);
}

export async function getRequest(id: string): Promise<MentorshipRow | null> {
  const { data, error } = await supabaseAdmin().from("mentorship_requests").select("*").eq("id", id).maybeSingle();
  if (error) dbError("get mentorship request", error);
  return data as MentorshipRow | null;
}

/** A student's requests with the teacher's details (email only once accepted). */
export async function listForMentee(menteeId: string) {
  const { data, error } = await supabaseAdmin()
    .from("mentorship_requests")
    .select("*, mentors(id, name, headline, industry, app_users(email))")
    .eq("mentee_id", menteeId)
    .order("created_at", { ascending: false });
  if (error) dbError("list mentee requests", error);
  return (data ?? []).map((r) => {
    const m = one(r.mentors as unknown) as { id: string; name: string; headline: string; industry: string; app_users: unknown } | null;
    const owner = one(m?.app_users as { email: string | null } | null);
    const { mentors: _m, ...rest } = r;
    void _m;
    return {
      ...(rest as MentorshipRow),
      mentor: m ? { id: m.id, name: m.name, headline: m.headline, industry: m.industry } : null,
      mentorEmail: r.status === "accepted" ? (owner?.email ?? null) : null,
    };
  });
}

/** A teacher's incoming and active requests with the student's details (email only once accepted). */
export async function listForMentor(mentorId: string) {
  const { data, error } = await supabaseAdmin()
    .from("mentorship_requests")
    .select("*, mentees(id, name, career_stage, goal_summary, app_users(email))")
    .eq("mentor_id", mentorId)
    .in("status", ["pending", "accepted"])
    .order("created_at", { ascending: true });
  if (error) dbError("list mentor requests", error);
  return (data ?? []).map((r) => {
    const m = one(r.mentees as unknown) as { id: string; name: string; career_stage: string; goal_summary: string; app_users: unknown } | null;
    const owner = one(m?.app_users as { email: string | null } | null);
    const { mentees: _m, ...rest } = r;
    void _m;
    return {
      ...(rest as MentorshipRow),
      mentee: m ? { id: m.id, name: m.name, careerStage: m.career_stage, goalSummary: m.goal_summary } : null,
      menteeEmail: r.status === "accepted" ? (owner?.email ?? null) : null,
    };
  });
}

/** Accepted-mentorship count per teacher (for capacity). */
export async function acceptedCounts(): Promise<Map<string, number>> {
  const { data, error } = await supabaseAdmin().from("mentorship_requests").select("mentor_id").eq("status", "accepted");
  if (error) dbError("count mentorships", error);
  const counts = new Map<string, number>();
  for (const r of data ?? []) counts.set(r.mentor_id as string, (counts.get(r.mentor_id as string) ?? 0) + 1);
  return counts;
}

export async function statusCounts(): Promise<Record<MentorshipStatus, number>> {
  const { data, error } = await supabaseAdmin().from("mentorship_requests").select("status");
  if (error) dbError("mentorship status counts", error);
  const out = { pending: 0, accepted: 0, declined: 0, cancelled: 0, expired: 0, ended: 0 };
  for (const r of data ?? []) out[r.status as MentorshipStatus]++;
  return out;
}

export async function createRequest(input: { menteeId: string; mentorId: string; message: string | null; score: number }) {
  const { data, error } = await supabaseAdmin()
    .from("mentorship_requests")
    .insert({ mentee_id: input.menteeId, mentor_id: input.mentorId, message: input.message, score: input.score })
    .select("*")
    .single();
  if (error) {
    // Unique partial indexes are the final guard against races.
    if (error.code === "23505") throw new HttpError(409, "You already have an open request with this teacher.", "duplicate_request");
    dbError("create mentorship request", error);
  }
  return data as MentorshipRow;
}

/** Move a request from one status to another; fails if it was changed concurrently. */
export async function transition(id: string, from: MentorshipStatus, to: MentorshipStatus): Promise<MentorshipRow> {
  const patch: Record<string, string> = { status: to };
  if (to === "ended") patch.ended_at = new Date().toISOString();
  else patch.responded_at = new Date().toISOString();
  const { data, error } = await supabaseAdmin()
    .from("mentorship_requests")
    .update(patch)
    .eq("id", id)
    .eq("status", from)
    .select("*")
    .maybeSingle();
  if (error) dbError("update mentorship request", error);
  if (!data) throw new HttpError(409, "This request has already changed. Refresh and try again.", "stale_request");
  return data as MentorshipRow;
}

const ACCEPT_ERRORS: Record<string, [number, string]> = {
  not_found: [404, "Request not found."],
  expired: [409, "This request expired after seven days."],
  not_pending: [409, "This request is no longer pending."],
  already_has_mentor: [409, "This student already has an active mentor."],
  at_capacity: [409, "You're at capacity. Increase your limit or end a mentorship first."],
};

export async function acceptRequest(id: string, mentorId: string): Promise<{ accepted: string; autoCancelled: string[] }> {
  const { data, error } = await supabaseAdmin().rpc("accept_mentorship", { p_request_id: id, p_mentor_id: mentorId });
  if (error) {
    const known = ACCEPT_ERRORS[error.message];
    if (known) throw new HttpError(known[0], known[1], error.message);
    if (error.code === "23505") throw new HttpError(409, ACCEPT_ERRORS.already_has_mentor[1], "already_has_mentor");
    dbError("accept mentorship", error);
  }
  return data as { accepted: string; autoCancelled: string[] };
}
