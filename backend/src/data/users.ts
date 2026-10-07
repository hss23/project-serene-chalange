import { dbError, supabaseAdmin } from "../lib/supabase";
import type { Role, Status } from "../users/roles";

export interface AppUser {
  id: string;
  firebase_uid: string;
  email: string | null;
  display_name: string | null;
  role: Role | null;
  status: Status;
  is_demo: boolean;
  created_at: string;
  last_seen_at: string;
}

export interface AppUserWithProfile extends AppUser {
  profile: { kind: "mentee" | "mentor"; id: string; name: string } | null;
}

const USER_COLS = "id, firebase_uid, email, display_name, role, status, is_demo, created_at, last_seen_at";

export async function getUserByUid(uid: string): Promise<AppUser | null> {
  const { data, error } = await supabaseAdmin().from("app_users").select(USER_COLS).eq("firebase_uid", uid).maybeSingle();
  if (error) dbError("getUserByUid", error);
  return data as AppUser | null;
}

export async function getUserById(id: string): Promise<AppUser | null> {
  const { data, error } = await supabaseAdmin().from("app_users").select(USER_COLS).eq("id", id).maybeSingle();
  if (error) dbError("getUserById", error);
  return data as AppUser | null;
}

/** Create the row on first sign-in, otherwise refresh email/name/last_seen. Never touches role or status. */
export async function upsertOnLogin(uid: string, email: string | null, displayName: string | null): Promise<AppUser> {
  const { data, error } = await supabaseAdmin()
    .from("app_users")
    .upsert(
      { firebase_uid: uid, email, display_name: displayName, last_seen_at: new Date().toISOString() },
      { onConflict: "firebase_uid" },
    )
    .select(USER_COLS)
    .single();
  if (error) dbError("upsertOnLogin", error);
  return data as AppUser;
}

export async function updateUser(
  id: string,
  patch: Partial<Pick<AppUser, "role" | "status" | "display_name" | "is_demo">>,
): Promise<AppUser> {
  const { data, error } = await supabaseAdmin().from("app_users").update(patch).eq("id", id).select(USER_COLS).single();
  if (error) dbError("updateUser", error);
  return data as AppUser;
}

/** Set the role only if none is set yet (prevents a client from changing its own role later). */
export async function setInitialRole(id: string, role: Role, status: Status): Promise<AppUser | null> {
  const { data, error } = await supabaseAdmin()
    .from("app_users")
    .update({ role, status })
    .eq("id", id)
    .is("role", null)
    .select(USER_COLS)
    .maybeSingle();
  if (error) dbError("setInitialRole", error);
  return data as AppUser | null;
}

const embedProfile = (row: Record<string, unknown>): AppUserWithProfile => {
  const one = (v: unknown) => (Array.isArray(v) ? v[0] : v) as { id: string; name: string } | undefined | null;
  const mentee = one(row.mentees);
  const mentor = one(row.mentors);
  const { mentees: _a, mentors: _b, ...user } = row;
  void _a;
  void _b;
  return {
    ...(user as unknown as AppUser),
    profile: mentee ? { kind: "mentee", ...mentee } : mentor ? { kind: "mentor", ...mentor } : null,
  };
};

export async function listUsers(opts: { role?: Role; status?: Status; q?: string; page: number; pageSize: number }) {
  let query = supabaseAdmin()
    .from("app_users")
    .select(`${USER_COLS}, mentees(id, name), mentors(id, name)`, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(opts.page * opts.pageSize, opts.page * opts.pageSize + opts.pageSize - 1);
  if (opts.role) query = query.eq("role", opts.role);
  if (opts.status) query = query.eq("status", opts.status);
  if (opts.q) {
    const q = opts.q.replace(/[%,()]/g, " ").trim();
    if (q) query = query.or(`email.ilike.%${q}%,display_name.ilike.%${q}%`);
  }
  const { data, error, count } = await query;
  if (error) dbError("listUsers", error);
  return { users: (data ?? []).map((r) => embedProfile(r as Record<string, unknown>)), total: count ?? 0 };
}

export async function getUserWithProfile(id: string): Promise<AppUserWithProfile | null> {
  const { data, error } = await supabaseAdmin()
    .from("app_users")
    .select(`${USER_COLS}, mentees(id, name), mentors(id, name)`)
    .eq("id", id)
    .maybeSingle();
  if (error) dbError("getUserWithProfile", error);
  return data ? embedProfile(data as Record<string, unknown>) : null;
}

export async function deleteUserRow(id: string): Promise<void> {
  const { error } = await supabaseAdmin().from("app_users").delete().eq("id", id);
  if (error) dbError("deleteUserRow", error);
}

export async function countActiveAdmins(): Promise<number> {
  const { count, error } = await supabaseAdmin()
    .from("app_users")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin")
    .eq("status", "active");
  if (error) dbError("countActiveAdmins", error);
  return count ?? 0;
}

export async function roleStatusCounts(): Promise<Record<string, number>> {
  const { data, error } = await supabaseAdmin().from("app_users").select("role, status");
  if (error) dbError("roleStatusCounts", error);
  const out: Record<string, number> = {};
  for (const r of data ?? []) {
    const k = `${r.role ?? "none"}:${r.status}`;
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}
