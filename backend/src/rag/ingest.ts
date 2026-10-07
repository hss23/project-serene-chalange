// Shared ingestion core used by the CLI (`npm run ingest`) and the admin knowledge-base API.
// Content is stored first; embedding happens after, so a Gemini failure never loses the edit —
// the document keeps `ingest_error` and can be re-indexed.
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { embedDocuments, embeddingModel, QuotaError } from "../lib/gemini";
import { chunkMarkdown } from "./chunk";

export interface IngestInput {
  /** Existing document id when editing; omitted when creating. */
  id?: number;
  slug: string;
  title: string;
  content: string;
  source: string;
  managedBy: "repo" | "admin";
  updatedBy?: string | null;
}

export interface IngestResult {
  id: number;
  slug: string;
  chunkCount: number;
  embedded: number;
  unchanged: number;
  removed: number;
  error: string | null;
}

const BATCH = 20;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function embedWithRetry(items: { title: string; text: string }[], retries: number): Promise<number[][]> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await embedDocuments(items);
    } catch (err) {
      if (err instanceof QuotaError && attempt <= retries) {
        await sleep(2 ** attempt * 1000);
        continue;
      }
      throw err;
    }
  }
}

/** Save a document's content, then (re-)embed only the chunks that changed. */
export async function ingestDocument(db: SupabaseClient, input: IngestInput, opts: { retries?: number } = {}): Promise<IngestResult> {
  const now = new Date().toISOString();
  const row = {
    slug: input.slug,
    title: input.title,
    source: input.source,
    content: input.content,
    managed_by: input.managedBy,
    updated_by: input.updatedBy ?? null,
    updated_at: now,
  };
  const saved = input.id
    ? await db.from("kb_documents").update(row).eq("id", input.id).select("id").single()
    : await db.from("kb_documents").upsert(row, { onConflict: "slug" }).select("id").single();
  if (saved.error || !saved.data) throw new Error(`Save document ${input.slug}: ${saved.error?.message}`);
  const docId = saved.data.id as number;

  const model = embeddingModel();
  const chunks = chunkMarkdown(input.content).chunks.map((c) => ({
    ...c,
    hash: createHash("sha256").update(`${model}\n${input.slug}\n${c.heading}\n${c.content}`).digest("hex"),
  }));

  const existing = await db.from("kb_chunks").select("id, content_hash").eq("document_id", docId);
  if (existing.error) throw new Error(`Read chunks ${input.slug}: ${existing.error.message}`);
  const existingHashes = new Set((existing.data ?? []).map((r) => r.content_hash as string));
  const wanted = new Set(chunks.map((c) => c.hash));
  const fresh = chunks.filter((c) => !existingHashes.has(c.hash));

  let embedded = 0;
  try {
    // 1) Embed and insert new chunks first, so a failure leaves the previous version searchable.
    for (let i = 0; i < fresh.length; i += BATCH) {
      const batch = fresh.slice(i, i + BATCH);
      const vectors = await embedWithRetry(
        batch.map((c) => ({ title: `${input.title} — ${c.heading}`, text: c.content })),
        opts.retries ?? 2,
      );
      const rows = batch.map((c, j) => ({
        document_id: docId,
        chunk_index: c.index,
        heading: c.heading,
        content: c.content,
        content_hash: c.hash,
        embedding_model: model,
        embedding: `[${vectors[j].join(",")}]`,
      }));
      const ins = await db.from("kb_chunks").upsert(rows, { onConflict: "content_hash" });
      if (ins.error) throw new Error(`Insert chunks: ${ins.error.message}`);
      embedded += rows.length;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .from("kb_documents")
      .update({ ingest_error: message, chunk_count: existingHashes.size + embedded })
      .eq("id", docId);
    return { id: docId, slug: input.slug, chunkCount: existingHashes.size + embedded, embedded, unchanged: 0, removed: 0, error: message };
  }

  // 2) Then remove chunks that no longer exist and keep chunk order in sync.
  const stale = (existing.data ?? []).filter((r) => !wanted.has(r.content_hash as string)).map((r) => r.id as number);
  if (stale.length) {
    const del = await db.from("kb_chunks").delete().in("id", stale);
    if (del.error) throw new Error(`Delete stale chunks: ${del.error.message}`);
  }
  for (const c of chunks.filter((c) => existingHashes.has(c.hash))) {
    await db.from("kb_chunks").update({ chunk_index: c.index }).eq("content_hash", c.hash);
  }

  await db
    .from("kb_documents")
    .update({ chunk_count: chunks.length, ingested_at: new Date().toISOString(), ingest_error: null })
    .eq("id", docId);

  return {
    id: docId,
    slug: input.slug,
    chunkCount: chunks.length,
    embedded,
    unchanged: chunks.length - fresh.length,
    removed: stale.length,
    error: null,
  };
}
