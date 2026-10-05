import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import { AiError, QuotaError } from "./lib/gemini";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = "error",
  ) {
    super(message);
  }
}

export const notFound: RequestHandler = (_req, res) => {
  res.status(404).json({ error: "Not found.", code: "not_found" });
};

/** Turn every failure into a consistent JSON error; never leak stack traces or internals. */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, code: err.code });
  } else if (err instanceof ZodError) {
    res.status(400).json({ error: err.issues.map((i) => i.message).join("; "), code: "invalid_input" });
  } else if (err instanceof QuotaError) {
    res.status(503).json({ error: err.message, code: "ai_quota" });
  } else if (err instanceof AiError) {
    res.status(503).json({ error: err.message, code: "ai_unavailable" });
  } else if (err?.type === "entity.parse.failed") {
    res.status(400).json({ error: "Request body must be valid JSON.", code: "invalid_input" });
  } else if (err?.type === "entity.too.large") {
    res.status(413).json({ error: "Request body is too large.", code: "too_large" });
  } else if (err instanceof Error && err.message.startsWith("Not allowed by CORS")) {
    res.status(403).json({ error: "Origin not allowed.", code: "cors" });
  } else {
    console.error("[api] unhandled error", err);
    res.status(500).json({ error: "Something went wrong on our side. Please try again.", code: "internal" });
  }
};
