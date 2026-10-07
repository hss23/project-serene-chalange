import { Router } from "express";
import { z } from "zod";
import { HttpError } from "../errors";
import { writeAudit } from "../lib/audit";
import { dbError, supabaseAdmin } from "../lib/supabase";
import { currentAppUser, requireRole } from "../middleware/auth";
import { ingestDocument } from "../rag/ingest";
import { KbDocumentInput, previewChunks, slugify, uniqueSlug } from "../rag/kbRules";

const IdParam = z.object({ id: z.coerce.number().int().positive("Invalid document id") });
const LIST_COLS = "id, slug, title, source, managed_by, chunk_count, ingested_at, ingest_error, updated_at";

export const adminKbRouter = Router();
adminKbRouter.use(requireRole("admin"));

async function loadDoc(id: number) {
  const { data, error } = await supabaseAdmin().from("kb_documents").select(`${LIST_COLS}, content`).eq("id", id).maybeSingle();
  if (error) dbError("load kb document", error);
  if (!data) throw new HttpError(404, "Document not found.", "not_found");
  return data;
}

const auditTarget = (d: { id: number; title: string; slug: string }) => ({ id: String(d.id), email: null, name: d.title });

/** Map an ingest result to the response; an embedding failure is reported, not thrown (the content is saved). */
function ingestResponse(result: Awaited<ReturnType<typeof ingestDocument>>) {
  return {
    ...result,
    status: result.error ? "error" : "indexed",
    message: result.error
      ? "Saved, but indexing failed. The previous version stays searchable. Try Re-index in a minute."
      : `Indexed ${result.chunkCount} sections (${result.embedded} new, ${result.unchanged} unchanged, ${result.removed} removed).`,
  };
}

adminKbRouter.get("/", async (_req, res) => {
  const { data, error } = await supabaseAdmin().from("kb_documents").select(LIST_COLS).order("title");
  if (error) dbError("list kb documents", error);
  res.json({ documents: data ?? [] });
});

adminKbRouter.get("/:id", async (req, res) => {
  const { id } = IdParam.parse(req.params);
  const doc = await loadDoc(id);
  const { data: chunks, error } = await supabaseAdmin()
    .from("kb_chunks")
    .select("chunk_index, heading, content")
    .eq("document_id", id)
    .order("chunk_index");
  if (error) dbError("list kb chunks", error);
  res.json({
    document: doc,
    chunks: (chunks ?? []).map((c) => ({ index: c.chunk_index, heading: c.heading, preview: String(c.content).slice(0, 200) })),
  });
});

adminKbRouter.post("/", async (req, res) => {
  const actor = currentAppUser(req);
  const input = KbDocumentInput.parse(req.body ?? {});
  if (previewChunks(input.content).length === 0) throw new HttpError(400, "The document has no text sections to index.", "invalid_input");

  const { data: slugs, error } = await supabaseAdmin().from("kb_documents").select("slug");
  if (error) dbError("read slugs", error);
  const slug = uniqueSlug(slugify(input.title), new Set((slugs ?? []).map((s) => s.slug as string)));

  const result = await ingestDocument(supabaseAdmin(), {
    slug,
    title: input.title,
    content: input.content,
    source: "admin",
    managedBy: "admin",
    updatedBy: actor.id,
  });
  await writeAudit(actor, "kb_create", auditTarget({ id: result.id, title: input.title, slug }), { chunks: result.chunkCount });
  res.status(201).json(ingestResponse(result));
});

adminKbRouter.put("/:id", async (req, res) => {
  const actor = currentAppUser(req);
  const { id } = IdParam.parse(req.params);
  const input = KbDocumentInput.parse(req.body ?? {});
  if (previewChunks(input.content).length === 0) throw new HttpError(400, "The document has no text sections to index.", "invalid_input");
  const doc = await loadDoc(id);

  // Editing a repo document hands it over to the admin UI, so `npm run ingest` won't overwrite the edit.
  const result = await ingestDocument(supabaseAdmin(), {
    id,
    slug: doc.slug,
    title: input.title,
    content: input.content,
    source: doc.managed_by === "repo" ? `${doc.source} (edited in admin)` : doc.source,
    managedBy: "admin",
    updatedBy: actor.id,
  });
  await writeAudit(actor, "kb_update", auditTarget({ id, title: input.title, slug: doc.slug }), {
    chunks: result.chunkCount,
    embedded: result.embedded,
  });
  res.json(ingestResponse(result));
});

adminKbRouter.post("/:id/reindex", async (req, res) => {
  const actor = currentAppUser(req);
  const { id } = IdParam.parse(req.params);
  const doc = await loadDoc(id);
  if (!doc.content) throw new HttpError(409, "This document has no stored content yet. Run `npm run ingest` once.", "no_content");
  const result = await ingestDocument(supabaseAdmin(), {
    id,
    slug: doc.slug,
    title: doc.title,
    content: doc.content,
    source: doc.source,
    managedBy: doc.managed_by,
    updatedBy: actor.id,
  });
  await writeAudit(actor, "kb_reindex", auditTarget(doc), { ok: !result.error });
  res.json(ingestResponse(result));
});

adminKbRouter.delete("/:id", async (req, res) => {
  const actor = currentAppUser(req);
  const { id } = IdParam.parse(req.params);
  const doc = await loadDoc(id);
  const { error } = await supabaseAdmin().from("kb_documents").delete().eq("id", id); // chunks cascade
  if (error) dbError("delete kb document", error);
  await writeAudit(actor, "kb_delete", auditTarget(doc), { managedBy: doc.managed_by });
  res.json({
    deleted: true,
    note: doc.managed_by === "repo" ? "This was a repo document; it will come back if `npm run ingest` runs again." : undefined,
  });
});
