import { Router } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { scoringMethod } from "./match";

export const publicRouter = Router();

// Public liveness check. Render uses it as the health check, and a scheduled GitHub Action pings it
// daily so the free-tier Supabase project sees activity and isn't paused during the review window.
publicRouter.get("/health", async (_req, res) => {
  try {
    // Not a HEAD request: HEAD responses have no body, so a missing table would not surface as an error.
    const { error, count } = await supabaseAdmin().from("skills").select("id", { count: "exact" }).limit(1);
    if (error) throw error;
    if (!count) {
      res.status(503).json({ ok: false, db: "up", seeded: false, error: "Database has no seed data." });
      return;
    }
    res.json({ ok: true, db: "up", skills: count, time: new Date().toISOString() });
  } catch (err) {
    console.error("[health]", err);
    res.status(503).json({ ok: false, db: "down" });
  }
});

// Public: the scoring formula, so the UI can explain it without hard-coding the weights.
publicRouter.get("/scoring-method", (_req, res) => {
  res.set("Cache-Control", "public, max-age=3600").json(scoringMethod());
});
