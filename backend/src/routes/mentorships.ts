import { Router } from "express";
import { z } from "zod";
import {
  acceptedCounts,
  acceptRequest,
  createRequest,
  expireStale,
  getRequest,
  listForMentee,
  listForMentor,
  transition,
} from "../data/mentorships";
import { getMenteeByUser, getMentorByUser, listMentors } from "../data/profiles";
import { assertFeature } from "../data/settings";
import { HttpError } from "../errors";
import { scoreMatch } from "../matching/score";
import { daysLeft, requestBlocker, spotsLeft } from "../mentorships/rules";
import { currentAppUser, requireRole } from "../middleware/auth";
import { menteeComplete } from "../users/roles";

const CreateBody = z.object({
  mentorId: z.string().regex(/^[a-z0-9-]{1,40}$/, "Invalid teacher id"),
  message: z.string().trim().max(500, "Message must be at most 500 characters").optional(),
});
const IdParam = z.object({ id: z.string().uuid("Invalid request id") });

export const mentorshipRouter = Router();

// The whole feature is hidden unless an admin has switched it on.
mentorshipRouter.use(async (_req, _res, next) => {
  try {
    await assertFeature("mentorshipRequests");
    await expireStale();
    next();
  } catch (err) {
    next(err);
  }
});

/** Student: request a teacher. */
mentorshipRouter.post("/", requireRole("student"), async (req, res) => {
  const user = currentAppUser(req);
  const { mentorId, message } = CreateBody.parse(req.body ?? {});
  const mentee = await getMenteeByUser(user.id);
  if (!mentee) throw new HttpError(409, "Complete your profile before requesting a mentor.", "profile_incomplete");

  const [mentors, counts, mine] = await Promise.all([listMentors({ eligibleOnly: true }), acceptedCounts(), listForMentee(mentee.id)]);
  const mentor = mentors.find((m) => m.id === mentorId);
  const blocker = requestBlocker({
    menteeComplete: menteeComplete(mentee),
    mentorEligible: !!mentor,
    mentorSpotsLeft: mentor ? spotsLeft(mentor.max_mentees, counts.get(mentor.id) ?? 0) : 0,
    hasOpenRequestToMentor: mine.some((r) => r.mentor_id === mentorId && (r.status === "pending" || r.status === "accepted")),
    hasActiveMentor: mine.some((r) => r.status === "accepted"),
    pendingCount: mine.filter((r) => r.status === "pending").length,
  });
  if (blocker) throw new HttpError(409, blocker.message, blocker.code);

  const created = await createRequest({
    menteeId: mentee.id,
    mentorId,
    message: message || null,
    score: scoreMatch(mentee, mentor!).score,
  });
  res.status(201).json({ request: created });
});

/** Student: own requests. Teacher: incoming + active, with capacity. */
mentorshipRouter.get("/", requireRole("student", "teacher"), async (req, res) => {
  const user = currentAppUser(req);
  if (user.role === "student") {
    const mentee = await getMenteeByUser(user.id);
    res.json({ role: "student", requests: mentee ? await listForMentee(mentee.id) : [] });
    return;
  }
  const mentor = await getMentorByUser(user.id);
  if (!mentor) {
    res.json({ role: "teacher", requests: [], capacity: { used: 0, max: 0 } });
    return;
  }
  const requests = (await listForMentor(mentor.id)).map((r) => ({
    ...r,
    daysLeft: r.status === "pending" ? daysLeft(r.created_at) : null,
  }));
  const used = requests.filter((r) => r.status === "accepted").length;
  res.json({ role: "teacher", requests, capacity: { used, max: mentor.max_mentees } });
});

async function ownRequestAsTeacher(userId: string, id: string) {
  const [mentor, request] = await Promise.all([getMentorByUser(userId), getRequest(id)]);
  if (!mentor || !request || request.mentor_id !== mentor.id) throw new HttpError(404, "Request not found.", "not_found");
  return { mentor, request };
}

async function ownRequestAsStudent(userId: string, id: string) {
  const [mentee, request] = await Promise.all([getMenteeByUser(userId), getRequest(id)]);
  if (!mentee || !request || request.mentee_id !== mentee.id) throw new HttpError(404, "Request not found.", "not_found");
  return { mentee, request };
}

mentorshipRouter.post("/:id/accept", requireRole("teacher"), async (req, res) => {
  const { id } = IdParam.parse(req.params);
  const { mentor } = await ownRequestAsTeacher(currentAppUser(req).id, id);
  res.json(await acceptRequest(id, mentor.id)); // row-locked capacity check in SQL
});

mentorshipRouter.post("/:id/decline", requireRole("teacher"), async (req, res) => {
  const { id } = IdParam.parse(req.params);
  await ownRequestAsTeacher(currentAppUser(req).id, id);
  res.json({ request: await transition(id, "pending", "declined") });
});

mentorshipRouter.post("/:id/cancel", requireRole("student"), async (req, res) => {
  const { id } = IdParam.parse(req.params);
  await ownRequestAsStudent(currentAppUser(req).id, id);
  res.json({ request: await transition(id, "pending", "cancelled") });
});

mentorshipRouter.post("/:id/end", requireRole("student", "teacher"), async (req, res) => {
  const user = currentAppUser(req);
  const { id } = IdParam.parse(req.params);
  if (user.role === "teacher") await ownRequestAsTeacher(user.id, id);
  else await ownRequestAsStudent(user.id, id);
  res.json({ request: await transition(id, "accepted", "ended") });
});
