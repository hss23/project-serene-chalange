import { Router } from "express";
import { listMentees, listMentors } from "../data/profiles";
import { currentUser } from "../middleware/auth";
import { dbError, supabaseAdmin } from "../lib/supabase";

export const profilesRouter = Router();

// Upsert the signed-in user's row in Postgres (idempotent; safe if two tabs call it at once).
profilesRouter.post("/me", async (req, res) => {
  const user = currentUser(req);
  const { data, error } = await supabaseAdmin()
    .from("app_users")
    .upsert(
      {
        firebase_uid: user.uid,
        email: user.email ?? null,
        display_name: user.name ?? user.email?.split("@")[0] ?? null,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "firebase_uid" },
    )
    .select("id, email, display_name, created_at")
    .single();
  if (error) dbError("upsert app_user", error);
  res.json({ user: data });
});

// Dataset A: mentee profiles a user can pick from.
profilesRouter.get("/mentees", async (_req, res) => {
  res.json({ mentees: await listMentees() });
});

// Dataset B: all mentors (browse view).
profilesRouter.get("/mentors", async (_req, res) => {
  res.json({ mentors: await listMentors() });
});
