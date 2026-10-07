import cors from "cors";
import express from "express";
import helmet from "helmet";
import { errorHandler, notFound } from "./errors";
import { loadAppUser, requireActive, requireUser } from "./middleware/auth";
import { adminRouter } from "./routes/admin";
import { adminKbRouter } from "./routes/adminKb";
import { mentorshipRouter } from "./routes/mentorships";
import { settingsRouter } from "./routes/settings";
import { chatRouter } from "./routes/chat";
import { publicRouter } from "./routes/health";
import { matchRouter } from "./routes/match";
import { meRouter, profileRouter } from "./routes/me";
import { directoryRouter } from "./routes/profiles";

/** Comma-separated list of allowed browser origins, e.g. "http://localhost:3000,https://serene.vercel.app". */
const allowedOrigins = () =>
  (process.env.CORS_ORIGINS ?? "http://localhost:3000")
    .split(",")
    .map((o) => o.trim().replace(/\/$/, ""))
    .filter(Boolean);

export function createApp() {
  const app = express();
  const origins = allowedOrigins();

  app.disable("x-powered-by");
  app.set("trust proxy", 1); // behind Render's proxy
  app.use(helmet());
  app.use(
    cors({
      // Requests without an Origin header (curl, health checks, server-to-server) are allowed;
      // browsers are restricted to the frontend's origin(s). Auth is still enforced per route.
      origin: (origin, cb) =>
        !origin || origins.includes(origin) ? cb(null, true) : cb(new Error(`Not allowed by CORS: ${origin}`)),
      allowedHeaders: ["Authorization", "Content-Type"],
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      maxAge: 600,
    }),
  );
  // Knowledge-base documents can be up to ~100k characters; everything else stays small.
  app.use("/api/admin/kb", express.json({ limit: "256kb" }));
  app.use(express.json({ limit: "16kb" }));
  app.use("/api", (_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });

  app.get("/", (_req, res) => {
    res.json({ name: "serene-mentors-api", health: "/api/health" });
  });

  // Public routes
  app.use("/api", publicRouter);

  // Everything below requires a verified Firebase ID token and a loaded account (role + status).
  app.use("/api", requireUser, loadAppUser);
  app.use("/api", meRouter); // /me and /me/role work even before a role is chosen or when suspended (to show status)

  // Everything below also requires an account that isn't suspended; routes add role checks.
  app.use("/api", requireActive);
  app.use("/api", profileRouter);
  app.use("/api", directoryRouter);
  app.use("/api/match", matchRouter);
  app.use("/api/chat", chatRouter);
  app.use("/api", settingsRouter);
  app.use("/api/mentorships", mentorshipRouter);
  app.use("/api/admin/kb", adminKbRouter);
  app.use("/api/admin", adminRouter);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
