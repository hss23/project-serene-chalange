import { adminDb } from "./firebaseAdmin";
import { HttpError } from "../errors";

/**
 * Fixed-window per-user rate limit stored in Firestore, so it holds across serverless instances
 * (an in-memory counter would reset on every cold start). Protects the free-tier LLM quota.
 */
export async function enforceRateLimit(uid: string, bucket: string, limit: number, windowMs: number) {
  const ref = adminDb().doc(`users/${uid}/meta/rate_${bucket}`);
  const now = Date.now();
  const allowed = await adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const d = snap.data() as { windowStart?: number; count?: number } | undefined;
    if (!d?.windowStart || now - d.windowStart >= windowMs) {
      tx.set(ref, { windowStart: now, count: 1 });
      return true;
    }
    if ((d.count ?? 0) >= limit) return false;
    tx.update(ref, { count: (d.count ?? 0) + 1 });
    return true;
  });
  if (!allowed) {
    throw new HttpError(429, `You've reached the limit of ${limit} questions per hour. Please try again later.`, "rate_limited");
  }
}
