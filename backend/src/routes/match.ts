import { Router } from "express";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { getMentee, listMentors } from "../data/profiles";
import { HttpError } from "../errors";
import { adminDb } from "../lib/firebaseAdmin";
import { COMPONENT_LABELS, rankMentors, WEAK_MATCH_THRESHOLD, WEIGHTS } from "../matching/score";
import { currentUser } from "../middleware/auth";

const Query = z.object({
  menteeId: z.string({ error: "menteeId is required" }).regex(/^[a-z0-9-]{1,40}$/, "menteeId is invalid"),
  limit: z.coerce.number().int().min(3).max(5).default(5),
});

export const matchRouter = Router();

// Rank mentors (Dataset B) for one mentee (Dataset A) with the deterministic scorer.
matchRouter.get("/", async (req, res) => {
  const user = currentUser(req);
  const { menteeId, limit } = Query.parse(req.query);

  const [mentee, mentors] = await Promise.all([getMentee(menteeId), listMentors()]);
  if (!mentee) throw new HttpError(404, "That mentee profile doesn't exist.", "not_found");

  const results = rankMentors(mentee, mentors, limit);

  // Recommendation interaction history (Firestore, private to the user). Best effort:
  // a logging failure must not break the response.
  let historySaved = true;
  try {
    await adminDb()
      .collection(`users/${user.uid}/matchHistory`)
      .add({
        menteeId: mentee.id,
        menteeName: mentee.name,
        top: results.map((r) => ({ mentorId: r.mentorId, mentorName: r.mentorName, score: r.score })),
        createdAt: FieldValue.serverTimestamp(),
      });
  } catch (err) {
    historySaved = false;
    console.error("[match] failed to write history", err);
  }

  res.json({
    mentee,
    results,
    candidatesConsidered: mentors.length,
    historySaved,
    method: scoringMethod(),
  });
});

export const scoringMethod = () => ({ weights: WEIGHTS, labels: COMPONENT_LABELS, weakThreshold: WEAK_MATCH_THRESHOLD });
