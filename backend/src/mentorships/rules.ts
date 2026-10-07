// Pure mentorship rules (unit tested). Sources: kb/matching-guide.md (7 days to respond),
// kb/faq.md (one active mentor per student), kb/programme-handbook.md (max four mentees).

export const EXPIRY_DAYS = 7;
export const MAX_PENDING_PER_STUDENT = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

export function isExpired(createdAt: string | Date, now: Date = new Date()): boolean {
  return now.getTime() - new Date(createdAt).getTime() >= EXPIRY_DAYS * DAY_MS;
}

/** Days left to respond, rounded up: 7 right after sending, 1 on the last day, 0 once expired. */
export function daysLeft(createdAt: string | Date, now: Date = new Date()): number {
  const left = EXPIRY_DAYS * DAY_MS - (now.getTime() - new Date(createdAt).getTime());
  return Math.max(0, Math.ceil(left / DAY_MS));
}

export function spotsLeft(max: number, used: number): number {
  return Math.max(0, max - used);
}

export interface RequestContext {
  menteeComplete: boolean;
  mentorEligible: boolean;
  mentorSpotsLeft: number;
  hasOpenRequestToMentor: boolean;
  hasActiveMentor: boolean;
  pendingCount: number;
}

/** Why a student can't request this mentor right now, or null if they can. */
export function requestBlocker(ctx: RequestContext): { code: string; message: string } | null {
  if (!ctx.menteeComplete) return { code: "profile_incomplete", message: "Complete your profile before requesting a mentor." };
  if (ctx.hasActiveMentor) return { code: "already_has_mentor", message: "You already have an active mentor. End that mentorship first." };
  if (!ctx.mentorEligible) return { code: "mentor_unavailable", message: "This teacher isn't available for requests." };
  if (ctx.hasOpenRequestToMentor) return { code: "duplicate_request", message: "You've already sent this teacher a request." };
  if (ctx.mentorSpotsLeft <= 0) return { code: "at_capacity", message: "This teacher has no free spots right now." };
  if (ctx.pendingCount >= MAX_PENDING_PER_STUDENT) {
    return { code: "too_many_pending", message: `You can have at most ${MAX_PENDING_PER_STUDENT} pending requests. Cancel one first.` };
  }
  return null;
}

/**
 * Candidates for a student when mentorship requests are on: drop teachers with no free spots,
 * but always keep teachers the student already has an open request or mentorship with.
 */
export function availableMentors<T extends { id: string; max_mentees: number }>(
  mentors: T[],
  acceptedByMentor: Map<string, number>,
  keepIds: Set<string>,
): T[] {
  return mentors.filter((m) => keepIds.has(m.id) || spotsLeft(m.max_mentees, acceptedByMentor.get(m.id) ?? 0) > 0);
}
