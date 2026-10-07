import type { NextFunction, Request, Response } from "express";
import { getUserByUid, updateUser, upsertOnLogin, type AppUser } from "../data/users";
import { HttpError } from "../errors";
import { adminAuth } from "../lib/firebaseAdmin";
import { parseAdminEmails, resolveRole, type Role } from "../users/roles";

export interface AuthedUser {
  uid: string;
  email?: string;
  name?: string;
}

declare module "express-serve-static-core" {
  interface Request {
    user?: AuthedUser;
    appUser?: AppUser;
  }
}

/**
 * 1) Verify the Firebase ID token from `Authorization: Bearer <token>` and attach `req.user`.
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

// Short per-instance cache so every request doesn't hit Postgres; invalidated on any change.
const CACHE_MS = 30_000;
const cache = new Map<string, { user: AppUser; at: number }>();
export const invalidateUser = (uid: string) => cache.delete(uid);
export const cacheUser = (user: AppUser) => cache.set(user.firebase_uid, { user, at: Date.now() });

/**
 * 2) Load (or create) the account row for the verified uid and attach `req.appUser`.
 * Emails in ADMIN_EMAILS are promoted to admin here; admin can't be chosen by the client.
 */
export async function loadAppUser(req: Request, _res: Response, next: NextFunction) {
  try {
    const u = currentUser(req);
    const hit = cache.get(u.uid);
    let user = hit && Date.now() - hit.at < CACHE_MS ? hit.user : await getUserByUid(u.uid);
    if (!user) user = await upsertOnLogin(u.uid, u.email ?? null, u.name ?? u.email?.split("@")[0] ?? null);
    const role = resolveRole(user.email ?? u.email, parseAdminEmails(process.env.ADMIN_EMAILS), user.role);
    if (role !== user.role) user = await updateUser(user.id, { role, status: "active" });
    cacheUser(user);
    req.appUser = user;
    next();
  } catch (err) {
    next(err);
  }
}

/** 3) Block suspended accounts (still valid Firebase tokens are rejected here). */
export function requireActive(req: Request, _res: Response, next: NextFunction) {
  const user = req.appUser;
  if (!user) return next(new HttpError(401, "Sign in required.", "unauthenticated"));
  if (user.status === "suspended") {
    return next(new HttpError(403, "Your account has been suspended. Contact an administrator.", "suspended"));
  }
  next();
}

/** 4) Allow only the given roles. */
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const role = req.appUser?.role;
    if (!role) return next(new HttpError(403, "Choose whether you're a student or a teacher first.", "role_required"));
    if (!roles.includes(role)) return next(new HttpError(403, "You don't have access to this.", "forbidden"));
    next();
  };
}

/** Typed accessors for handlers mounted behind the middleware above. */
export function currentUser(req: Request): AuthedUser {
  if (!req.user) throw new HttpError(401, "Sign in required.", "unauthenticated");
  return req.user;
}

export function currentAppUser(req: Request): AppUser {
  if (!req.appUser) throw new HttpError(401, "Sign in required.", "unauthenticated");
  return req.appUser;
}
