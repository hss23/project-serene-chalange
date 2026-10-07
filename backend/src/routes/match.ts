import { Router } from "express";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { acceptedCounts, expireStale, listForMentee } from "../data/mentorships";
import { getMentee, getMenteeByUser, getMentorByUser, listMentees, listMentors } from "../data/profiles";
import { getFeatures } from "../data/settings";
import { availableMentors, spotsLeft } from "../mentorships/rules";
import { HttpError } from "../errors";
import { adminDb } from "../lib/firebaseAdmin";
import { COMPONENT_LABELS, rankMenteesForMentor, rankMentors, WEAK_MATCH_THRESHOLD, WEIGHTS } from "../matching/score";
import { currentAppUser, currentUser, requireRole } from "../middleware/auth";
import { menteeComplete, mentorComplete } from "../users/roles";

const Query = z.object({
  menteeId: z.string().regex(/^[a-z0-9-]{1,40}$/, "menteeId is invalid").optional(),
  limit: z.coerce.number().int().min(3).max(5).default(5),
});

export const matchRouter = Router();

/**
 * Rank teachers (Dataset B) for one student (Dataset A) with the deterministic scorer.
 * - student: always their own profile (no menteeId accepted)
 * - admin: any student via ?menteeId=
 */
matchRouter.get("/", requireRole("student", "admin"), async (req, res) => {
  const user = currentAppUser(req);
  const { menteeId, limit } = Query.parse(req.query);

  let mentee;
  if (user.role === "student") {
    mentee = await getMenteeByUser(user.id);
    if (!menteeComplete(mentee)) {
      throw new HttpError(409, "Complete your profile to see your matches.", "profile_incomplete");
    }
  } else {
    if (!menteeId) throw new HttpError(400, "menteeId is required", "invalid_input");
    mentee = await getMentee(menteeId);
    if (!mentee) throw new HttpError(404, "That student profile doesn't exist.", "not_found");
  }

  // Only active teachers with complete profiles are candidates.
  let mentors = await listMentors({ eligibleOnly: true });

  // With mentorship requests on, full teachers drop out and each result shows spots + request state.
  const { mentorshipRequests } = await getFeatures();
  let counts = new Map<string, number>();
  const requestStatus = new Map<string, string>();
  if (mentorshipRequests) {
    await expireStale();
    const [c, mine] = await Promise.all([acceptedCounts(), listForMentee(mentee!.id)]);
    counts = c;
    for (const r of mine) if (!requestStatus.has(r.mentor_id)) requestStatus.set(r.mentor_id, r.status); // newest first
    const keep = new Set(mine.filter((r) => r.status === "pending" || r.status === "accepted").map((r) => r.mentor_id));
    mentors = availableMentors(mentors, counts, keep);
  }

  const results = rankMentors(mentee!, mentors, limit).map((r) => {
    if (!mentorshipRequests) return r;
    const m = mentors.find((x) => x.id === r.mentorId)!;
    return { ...r, spotsLeft: spotsLeft(m.max_mentees, counts.get(m.id) ?? 0), requestStatus: requestStatus.get(m.id) ?? null };
  });

  // Recommendation interaction history (Firestore, private to the requesting user). Best effort.
  let historySaved = true;
  try {
    await adminDb()
      .collection(`users/${currentUser(req).uid}/matchHistory`)
      .add({
        menteeId: mentee!.id,
        menteeName: mentee!.name,
        top: results.map((r) => ({ mentorId: r.mentorId, mentorName: r.mentorName, score: r.score })),
        createdAt: FieldValue.serverTimestamp(),
      });
  } catch (err) {
    historySaved = false;
    console.error("[match] failed to write history", err);
  }

  res.json({ mentee, results, candidatesConsidered: mentors.length, historySaved, mentorshipRequests, method: scoringMethod() });
});

/** Teacher view: the students this teacher fits best (same scorer, reverse direction). */
matchRouter.get("/students", requireRole("teacher"), async (req, res) => {
  const user = currentAppUser(req);
  const mentor = await getMentorByUser(user.id);
  if (!mentorComplete(mentor)) {
    throw new HttpError(409, "Complete your profile to see matching students.", "profile_incomplete");
  }
  const mentees = await listMentees({ eligibleOnly: true });
  res.json({
    mentor,
    results: rankMenteesForMentor(mentor!, mentees, 5),
    candidatesConsidered: mentees.length,
    method: scoringMethod(),
  });
});

export const scoringMethod = () => ({ weights: WEIGHTS, labels: COMPONENT_LABELS, weakThreshold: WEAK_MATCH_THRESHOLD });
