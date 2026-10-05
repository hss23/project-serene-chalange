import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import ws from "ws";
import { HttpError } from "../errors";

// New-style secret key (sb_secret_...) preferred; legacy service_role JWT accepted as a fallback.
export const supabaseSecretKey = () => process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Supabase client using the secret key (bypasses RLS).
 * Node < 22 has no native WebSocket, which supabase-js needs to construct its realtime client,
 * so we pass `ws` explicitly (we don't use realtime, but construction would otherwise throw).
 */
export function createServerSupabase(url: string, secretKey: string): SupabaseClient {
  return createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: ws as unknown as typeof WebSocket },
  });
}

let client: SupabaseClient | undefined;

/** Shared secret-key client. Only use it after requireUser() has verified the caller. */
export function supabaseAdmin(): SupabaseClient {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = supabaseSecretKey();
  if (!url || !key) throw new Error("Supabase is not configured (SUPABASE_URL / SUPABASE_SECRET_KEY).");
  client = createServerSupabase(url, key);
  return client;
}

/** Throw a user-facing 503 for database failures instead of leaking internals. */
export function dbError(context: string, error: { message: string } | null): never {
  console.error(`[db] ${context}:`, error?.message);
  throw new HttpError(503, "The database is temporarily unavailable. Please try again shortly.", "db_unavailable");
}
