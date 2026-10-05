import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../errors";
import { adminAuth } from "../lib/firebaseAdmin";

export interface AuthedUser {
  uid: string;
  email?: string;
  name?: string;
}

declare module "express-serve-static-core" {
  interface Request {
    user?: AuthedUser;
  }
}

/**
 * Verify the Firebase ID token from `Authorization: Bearer <token>` and attach `req.user`.
 * The uid set here is the ONLY identity the server trusts; never read a uid from the body.
 */
export async function requireUser(req: Request, _res: Response, next: NextFunction) {
  const match = /^Bearer\s+(.+)$/i.exec(req.headers.authorization ?? "");
  if (!match) return next(new HttpError(401, "Sign in required.", "unauthenticated"));
  const auth = adminAuth(); // outside the try: a server misconfiguration must not look like a bad token
  try {
    const decoded = await auth.verifyIdToken(match[1]);
    req.user = { uid: decoded.uid, email: decoded.email, name: decoded.name as string | undefined };
    next();
  } catch {
    next(new HttpError(401, "Your session has expired. Please sign in again.", "invalid_token"));
  }
}

/** Typed accessor for handlers mounted behind requireUser. */
export function currentUser(req: Request): AuthedUser {
  if (!req.user) throw new HttpError(401, "Sign in required.", "unauthenticated");
  return req.user;
}
