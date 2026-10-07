import { Router } from "express";
import { listMentees, listMentors } from "../data/profiles";
import { requireRole } from "../middleware/auth";

export const directoryRouter = Router();

// Dataset B: teachers who can be matched (active, complete profiles).
directoryRouter.get("/mentors", requireRole("student", "teacher", "admin"), async (_req, res) => {
  res.json({ mentors: await listMentors({ eligibleOnly: true }) });
});

// Dataset A: students, for the admin's "run matching for any student" picker.
directoryRouter.get("/mentees", requireRole("admin"), async (_req, res) => {
  res.json({ mentees: await listMentees({ eligibleOnly: true }) });
});
