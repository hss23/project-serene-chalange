// RAG ingestion for repo-managed documents: backend/kb/*.md → Postgres (content) → chunks →
// Gemini embeddings → pgvector. Idempotent: only new/changed chunks are embedded.
// Documents created or edited in the admin UI (managed_by = 'admin') are never touched here.
//
//   npm run ingest            # ingest into Supabase
//   npm run ingest -- --dry   # just print the chunking stats (no keys needed)
import { config } from "dotenv";
config({ quiet: true });

import { readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { embeddingModel } from "../src/lib/gemini";
import { createServerSupabase, supabaseSecretKey } from "../src/lib/supabase";
import { chunkMarkdown } from "../src/rag/chunk";
import { ingestDocument } from "../src/rag/ingest";

const KB_DIR = join(__dirname, "..", "kb");
const dry = process.argv.includes("--dry");

async function main() {
  const files = readdirSync(KB_DIR).filter((f) => f.endsWith(".md")).sort();
  const docs = files.map((f) => {
    const content = readFileSync(join(KB_DIR, f), "utf8").replace(/\r\n/g, "\n");
    const parsed = chunkMarkdown(content);
    return { slug: basename(f, ".md"), source: `kb/${f}`, title: parsed.title, content, chunks: parsed.chunks.length };
  });

  console.log(`Parsed ${docs.length} documents into ${docs.reduce((n, d) => n + d.chunks, 0)} chunks:`);
  for (const d of docs) console.log(`  - ${d.title} (${d.slug}): ${d.chunks} chunks`);
  if (dry) return;

  const url = process.env.SUPABASE_URL;
  const key = supabaseSecretKey();
  if (!url || !key) throw new Error("Set SUPABASE_URL and SUPABASE_SECRET_KEY in backend/.env");
  const db = createServerSupabase(url, key);

  const { data: current, error } = await db.from("kb_documents").select("id, slug, managed_by");
  if (error) throw new Error(`Read documents: ${error.message}`);
  const bySlug = new Map((current ?? []).map((d) => [d.slug as string, d]));

  let failures = 0;
  for (const d of docs) {
    const existing = bySlug.get(d.slug);
    if (existing?.managed_by === "admin") {
      console.log(`  - ${d.slug}: managed in the admin UI, skipped`);
      continue;
    }
    const r = await ingestDocument(
      db,
      { id: existing?.id as number | undefined, slug: d.slug, title: d.title, content: d.content, source: d.source, managedBy: "repo" },
      { retries: 5 },
    );
    if (r.error) {
      failures++;
      console.error(`  ✗ ${d.slug}: ${r.error}`);
    } else {
      console.log(`  ✓ ${d.slug}: ${r.embedded} embedded, ${r.unchanged} unchanged, ${r.removed} removed`);
    }
  }

  // Remove repo documents whose file was deleted (admin documents are kept).
  const slugs = new Set(docs.map((d) => d.slug));
  const orphans = (current ?? []).filter((d) => d.managed_by === "repo" && !slugs.has(d.slug as string)).map((d) => d.id);
  if (orphans.length) await db.from("kb_documents").delete().in("id", orphans);

  console.log(`Done with ${embeddingModel()}. Removed ${orphans.length} orphan repo docs.${failures ? ` ${failures} failed.` : ""}`);
  if (failures) process.exit(1);
}

main().catch((err) => {
  console.error("Ingest failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
