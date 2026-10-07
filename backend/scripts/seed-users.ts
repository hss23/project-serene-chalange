// Turn the seed profiles into real login accounts (idempotent; safe to re-run).
//   - 12 students (mentees) and 30 teachers (mentors) from data/seed-data.ts
//   - one demo admin (SEED_ADMIN_EMAIL, default admin@serene-demo.test)
// Each gets a Firebase Auth account (password = SEED_USER_PASSWORD), an app_users row with its
// role, and a link from the profile to the account. Re-running restores any demo profile or
// account that was edited away or deleted.
//
//   SEED_USER_PASSWORD=... npm run seed:users
import { config } from "dotenv";
config({ quiet: true });

import { MENTEES, MENTORS, type SeedMentee, type SeedMentor } from "../data/seed-data";
import { adminAuth } from "../src/lib/firebaseAdmin";
import { createServerSupabase, supabaseSecretKey } from "../src/lib/supabase";

const DOMAIN = "serene-demo.test";
const password = process.env.SEED_USER_PASSWORD ?? "";
const adminEmail = (process.env.SEED_ADMIN_EMAIL || `admin@${DOMAIN}`).toLowerCase();

/** "Dr. Priya Raman" → "priya.raman@serene-demo.test"; "Diego Fernández" → "diego.fernandez@…" */
export function demoEmail(name: string): string {
  const local = name
    .replace(/^(dr|mr|ms|mrs)\.?\s+/i, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z\s-]/g, "")
    .trim()
    .split(/\s+/)
    .join(".");
  return `${local}@${DOMAIN}`;
}

async function main() {
  if (password.length < 8) throw new Error("Set SEED_USER_PASSWORD (8+ characters) in backend/.env");
  const url = process.env.SUPABASE_URL;
  const key = supabaseSecretKey();
  if (!url || !key) throw new Error("Set SUPABASE_URL and SUPABASE_SECRET_KEY in backend/.env");
  const db = createServerSupabase(url, key);
  const auth = adminAuth();

  const { data: skillRows, error: skillErr } = await db.from("skills").select("id, name");
  if (skillErr) throw new Error(`Read skills: ${skillErr.message}. Did you run setup.sql?`);
  const skillId = new Map((skillRows ?? []).map((s) => [s.name as string, s.id as number]));

  async function ensureFirebaseUser(email: string, displayName: string): Promise<string> {
    try {
      const existing = await auth.getUserByEmail(email);
      await auth.updateUser(existing.uid, { password, displayName, disabled: false, emailVerified: true });
      return existing.uid;
    } catch (err) {
      if ((err as { code?: string }).code !== "auth/user-not-found") throw err;
      const created = await auth.createUser({ email, password, displayName, emailVerified: true });
      return created.uid;
    }
  }

  async function ensureAppUser(uid: string, email: string, name: string, role: "student" | "teacher" | "admin") {
    const { data, error } = await db
      .from("app_users")
      .upsert(
        { firebase_uid: uid, email, display_name: name, role, status: "active", is_demo: true },
        { onConflict: "firebase_uid" },
      )
      .select("id")
      .single();
    if (error) throw new Error(`Upsert app_user ${email}: ${error.message}`);
    return data.id as string;
  }

  async function ensureMentee(m: SeedMentee, userId: string) {
    const { goals, ...profile } = m;
    const { error } = await db.from("mentees").upsert({ ...profile, user_id: userId }, { onConflict: "id" });
    if (error) throw new Error(`Upsert mentee ${m.id}: ${error.message}`);
    await db.from("mentee_goal_skills").delete().eq("mentee_id", m.id);
    const rows = Object.entries(goals).map(([name, priority]) => ({ mentee_id: m.id, skill_id: skillId.get(name), priority }));
    const ins = await db.from("mentee_goal_skills").insert(rows);
    if (ins.error) throw new Error(`Goal skills ${m.id}: ${ins.error.message}`);
  }

  async function ensureMentor(m: SeedMentor, userId: string) {
    const { skills, ...profile } = m;
    const { error } = await db.from("mentors").upsert({ ...profile, user_id: userId }, { onConflict: "id" });
    if (error) throw new Error(`Upsert mentor ${m.id}: ${error.message}`);
    await db.from("mentor_skills").delete().eq("mentor_id", m.id);
    const rows = Object.entries(skills).map(([name, proficiency]) => ({ mentor_id: m.id, skill_id: skillId.get(name), proficiency }));
    const ins = await db.from("mentor_skills").insert(rows);
    if (ins.error) throw new Error(`Skills ${m.id}: ${ins.error.message}`);
  }

  for (const m of MENTEES) {
    const email = demoEmail(m.name);
    const uid = await ensureFirebaseUser(email, m.name);
    const userId = await ensureAppUser(uid, email, m.name, "student");
    await ensureMentee(m, userId);
    console.log(`  student  ${email}`);
  }
  for (const m of MENTORS) {
    const email = demoEmail(m.name);
    const uid = await ensureFirebaseUser(email, m.name);
    const userId = await ensureAppUser(uid, email, m.name, "teacher");
    await ensureMentor(m, userId);
    console.log(`  teacher  ${email}`);
  }
  const adminUid = await ensureFirebaseUser(adminEmail, "Demo Admin");
  await ensureAppUser(adminUid, adminEmail, "Demo Admin", "admin");
  console.log(`  admin    ${adminEmail}`);

  console.log(`\nDone: ${MENTEES.length} students, ${MENTORS.length} teachers, 1 admin. All use SEED_USER_PASSWORD.`);
}

if (require.main === module) {
  main().then(
    () => process.exit(0),
    (err) => {
      console.error("seed:users failed:", err instanceof Error ? err.message : err);
      process.exit(1);
    },
  );
}
