// RAG ingestion: kb/*.md -> chunks -> Gemini embeddings -> Supabase pgvector.
// Idempotent: chunks are keyed by a content hash, so re-runs only embed new/changed chunks
// and remove chunks/documents that no longer exist.
//
//   npm run ingest            # ingest into Supabase
//   npm run ingest -- --dry   # just print the chunking stats (no keys needed)
import { config } from "dotenv";
config({ quiet: true });

import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { createServerSupabase, supabaseSecretKey } from "../src/lib/supabase";
import { chunkMarkdown } from "../src/rag/chunk";
import { embedDocuments, embeddingModel, QuotaError } from "../src/lib/gemini";

const KB_DIR = join(__dirname, "..", "kb");
const BATCH = 20;
const dry = process.argv.includes("--dry");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function embedWithRetry(items: { title: string; text: string }[]): Promise<number[][]> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await embedDocuments(items);
    } catch (err) {
      if (err instanceof QuotaError && attempt < 6) {
        const wait = 2 ** attempt * 1000;
        console.warn(`  rate limited, retrying in ${wait / 1000}s...`);
        await sleep(wait);
        continue;
      }
      throw err;
    }
  }
}

async function main() {
  const files = readdirSync(KB_DIR).filter((f) => f.endsWith(".md")).sort();
  const docs = files.map((f) => {
    const slug = basename(f, ".md");
    const parsed = chunkMarkdown(readFileSync(join(KB_DIR, f), "utf8"));
    return { slug, source: `kb/${f}`, ...parsed };
  });

  const total = docs.reduce((n, d) => n + d.chunks.length, 0);
  console.log(`Parsed ${docs.length} documents into ${total} chunks:`);
  for (const d of docs) console.log(`  - ${d.title} (${d.slug}): ${d.chunks.length} chunks`);
  if (dry) return;

  const url = process.env.SUPABASE_URL;
  const key = supabaseSecretKey();
  if (!url || !key) throw new Error("Set SUPABASE_URL and SUPABASE_SECRET_KEY in backend/.env");
  const db = createServerSupabase(url, key);
  const model = embeddingModel();

  let embedded = 0;
  let removed = 0;
  for (const d of docs) {
    const { data: docRow, error: docErr } = await db
      .from("kb_documents")
      .upsert({ slug: d.slug, title: d.title, source: d.source, updated_at: new Date().toISOString() }, { onConflict: "slug" })
      .select("id")
      .single();
    if (docErr || !docRow) throw new Error(`Upsert document ${d.slug}: ${docErr?.message}`);

    const withHash = d.chunks.map((c) => ({
      ...c,
      hash: createHash("sha256").update(`${model}\n${d.slug}\n${c.heading}\n${c.content}`).digest("hex"),
    }));

    const { data: existing, error: exErr } = await db.from("kb_chunks").select("id, content_hash").eq("document_id", docRow.id);
    if (exErr) throw new Error(`Read chunks ${d.slug}: ${exErr.message}`);
    const existingHashes = new Set((existing ?? []).map((r) => r.content_hash));
    const wanted = new Set(withHash.map((c) => c.hash));

    // Remove stale chunks (edited or deleted text, or a different embedding model).
    const stale = (existing ?? []).filter((r) => !wanted.has(r.content_hash)).map((r) => r.id);
    if (stale.length) {
      const { error } = await db.from("kb_chunks").delete().in("id", stale);
      if (error) throw new Error(`Delete stale chunks: ${error.message}`);
      removed += stale.length;
    }

    // Keep chunk_index in sync for unchanged chunks.
    for (const c of withHash.filter((c) => existingHashes.has(c.hash))) {
      await db.from("kb_chunks").update({ chunk_index: c.index }).eq("content_hash", c.hash);
    }

    const fresh = withHash.filter((c) => !existingHashes.has(c.hash));
    for (let i = 0; i < fresh.length; i += BATCH) {
      const batch = fresh.slice(i, i + BATCH);
      const vectors = await embedWithRetry(batch.map((c) => ({ title: `${d.title} — ${c.heading}`, text: c.content })));
      const rows = batch.map((c, j) => ({
        document_id: docRow.id,
        chunk_index: c.index,
        heading: c.heading,
        content: c.content,
        content_hash: c.hash,
        embedding_model: model,
        embedding: `[${vectors[j].join(",")}]`,
      }));
      const { error } = await db.from("kb_chunks").upsert(rows, { onConflict: "content_hash" });
      if (error) throw new Error(`Insert chunks ${d.slug}: ${error.message}`);
      embedded += rows.length;
    }
    console.log(`  ✓ ${d.slug}: ${fresh.length} embedded, ${withHash.length - fresh.length} unchanged, ${stale.length} removed`);
  }

  // Remove documents whose source file was deleted (chunks cascade).
  const { data: allDocs } = await db.from("kb_documents").select("id, slug");
  const slugs = new Set(docs.map((d) => d.slug));
  const orphan = (allDocs ?? []).filter((r) => !slugs.has(r.slug)).map((r) => r.id);
  if (orphan.length) await db.from("kb_documents").delete().in("id", orphan);

  console.log(`Done. Embedded ${embedded} chunks with ${model}; removed ${removed} stale chunks, ${orphan.length} orphan docs.`);
}

main().catch((err) => {
  console.error("Ingest failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
