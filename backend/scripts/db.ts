// SQL runner for Supabase Postgres (needs DATABASE_URL: Supabase → Connect → Session pooler URI).
//
//   npm run db:migrate              apply pending migrations in order (each in its own transaction)
//   npm run db:migrate -- --status  show applied / pending / changed migrations
//   npm run db:migrate -- --seed    also reload demo data from supabase/seed.sql (truncates profile tables!)
//   npm run db:sql -- path/to.sql   run any SQL file in a single transaction
//
// Applied migrations are recorded in public.schema_migrations (filename + sha256). All migrations
// in this repo are idempotent, so a database that was set up by hand can safely be brought up to date.
import { config } from "dotenv";
config({ quiet: true });

import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { Client } from "pg";

const SUPABASE_DIR = join(__dirname, "..", "supabase");
const MIGRATIONS_DIR = join(SUPABASE_DIR, "migrations");

const sha = (sql: string) => createHash("sha256").update(sql.replace(/\r\n/g, "\n")).digest("hex");

function connect(): Client {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "Set DATABASE_URL in backend/.env.\n" +
        "  Supabase dashboard → Connect → Session pooler → URI (works over IPv4), e.g.\n" +
        "  postgresql://postgres.<project-ref>:<db-password>@aws-0-<region>.pooler.supabase.com:5432/postgres",
    );
  }
  // Supabase requires TLS; its pooler certificate isn't in Node's default CA store.
  return new Client({ connectionString: url, ssl: { rejectUnauthorized: false }, statement_timeout: 120_000 });
}

/** Run a SQL file inside one transaction; roll back everything on any error. */
async function runInTransaction(client: Client, sql: string, label: string) {
  await client.query("begin");
  try {
    await client.query(sql);
    await client.query("commit");
  } catch (err) {
    await client.query("rollback");
    const e = err as { message: string; position?: string; where?: string };
    const where = e.position ? ` (at character ${e.position})` : "";
    throw new Error(`${label} failed and was rolled back${where}: ${e.message}`);
  }
}

async function migrate(opts: { statusOnly: boolean; seed: boolean }) {
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => /^\d+_.+\.sql$/.test(f)).sort();
  const client = connect();
  await client.connect();
  try {
    await client.query(`
      create table if not exists public.schema_migrations (
        filename   text primary key,
        checksum   text not null,
        applied_at timestamptz not null default now()
      );
      alter table public.schema_migrations enable row level security;
    `);
    const { rows } = await client.query<{ filename: string; checksum: string; applied_at: Date }>(
      "select filename, checksum, applied_at from public.schema_migrations",
    );
    const applied = new Map(rows.map((r) => [r.filename, r]));

    const plan = files.map((f) => {
      const sql = readFileSync(join(MIGRATIONS_DIR, f), "utf8");
      const done = applied.get(f);
      const state = !done ? "pending" : done.checksum === sha(sql) ? "applied" : "changed";
      return { file: f, sql, state, appliedAt: done?.applied_at };
    });

    console.log("Migrations:");
    for (const p of plan) {
      const mark = p.state === "applied" ? "✓" : p.state === "changed" ? "!" : "·";
      const note =
        p.state === "applied"
          ? `applied ${p.appliedAt?.toISOString().slice(0, 16).replace("T", " ")}`
          : p.state === "changed"
            ? "applied, but the file changed since (re-run manually with db:sql if needed)"
            : "pending";
      console.log(`  ${mark} ${p.file.padEnd(28)} ${note}`);
    }
    if (opts.statusOnly) return;

    const pending = plan.filter((p) => p.state === "pending");
    for (const p of pending) {
      process.stdout.write(`Applying ${p.file} … `);
      await runInTransaction(client, p.sql, p.file);
      await client.query("insert into public.schema_migrations (filename, checksum) values ($1, $2)", [p.file, sha(p.sql)]);
      console.log("done");
    }
    if (!pending.length) console.log("Nothing to apply; the database is up to date.");

    if (opts.seed) {
      process.stdout.write("Reloading demo data from supabase/seed.sql (truncates skills/mentors/mentees) … ");
      await runInTransaction(client, readFileSync(join(SUPABASE_DIR, "seed.sql"), "utf8"), "seed.sql");
      console.log("done. Run `npm run seed:users` next to re-link the demo accounts.");
    }

    // Let Supabase's REST API (PostgREST) see new tables/columns/functions immediately.
    await client.query("notify pgrst, 'reload schema'");
    if (pending.length || opts.seed) console.log("Reloaded the API schema cache.");
  } finally {
    await client.end();
  }
}

async function runFile(path: string) {
  const full = resolve(process.cwd(), path);
  if (!existsSync(full) || !full.endsWith(".sql")) throw new Error(`Not a .sql file: ${path}`);
  const client = connect();
  await client.connect();
  try {
    process.stdout.write(`Running ${path} … `);
    await runInTransaction(client, readFileSync(full, "utf8"), path);
    await client.query("notify pgrst, 'reload schema'");
    console.log("done");
  } finally {
    await client.end();
  }
}

const args = process.argv.slice(2);
const task =
  args[0] === "sql"
    ? args[1]
      ? runFile(args[1])
      : Promise.reject(new Error("Usage: npm run db:sql -- path/to/file.sql"))
    : migrate({ statusOnly: args.includes("--status"), seed: args.includes("--seed") });

task.catch((err) => {
  console.error(`\n${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
