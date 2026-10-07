"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { BookOpenText, Plus, RotateCw, Trash2 } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { KbStatus } from "@/components/admin/KbStatus";
import { EmptyState, ErrorBanner, PageHeader, Skeleton } from "@/components/ui";
import type { KbDocumentSummary, KbSaveResult } from "@/lib/types";

export default function KnowledgeListPage() {
  const { api } = useAuth();
  const [docs, setDocs] = useState<KbDocumentSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [toDelete, setToDelete] = useState<KbDocumentSummary | null>(null);

  const load = useCallback(async () => {
    try {
      setDocs((await api<{ documents: KbDocumentSummary[] }>("/api/admin/kb")).documents);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [api]);

  useEffect(() => {
    let cancelled = false;
    api<{ documents: KbDocumentSummary[] }>("/api/admin/kb")
      .then((r) => !cancelled && setDocs(r.documents))
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [api]);

  async function reindex(doc: KbDocumentSummary) {
    setBusyId(doc.id);
    setNotice(null);
    try {
      const r = await api<KbSaveResult>(`/api/admin/kb/${doc.id}/reindex`, { method: "POST" });
      setNotice(`${doc.title}: ${r.message}`);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function remove(doc: KbDocumentSummary) {
    setBusyId(doc.id);
    try {
      const r = await api<{ note?: string }>(`/api/admin/kb/${doc.id}`, { method: "DELETE" });
      setNotice(`Deleted “${doc.title}”.${r.note ? ` ${r.note}` : ""}`);
      setToDelete(null);
      await load();
    } catch (e) {
      setError((e as Error).message);
      setToDelete(null);
    } finally {
      setBusyId(null);
    }
  }

  const totalChunks = docs?.reduce((n, d) => n + d.chunk_count, 0) ?? 0;

  return (
    <div>
      <PageHeader
        icon={BookOpenText}
        title="Knowledge base"
        subtitle="Documents the assistant answers from. Saving a document re-indexes only that document; the assistant uses it immediately."
        action={
          <Link href="/admin/knowledge/new" className="btn-primary">
            <Plus className="h-4 w-4" /> New document
          </Link>
        }
      />
      {notice && <div className="mb-4 rounded-2xl border border-success/20 bg-success-soft p-4 text-sm text-success">{notice}</div>}
      {error && <div className="mb-4"><ErrorBanner message={error} onRetry={load} /></div>}

      {!docs ? (
        <Skeleton className="h-80" />
      ) : docs.length === 0 ? (
        <EmptyState icon={BookOpenText} title="No documents yet">
          <Link href="/admin/knowledge/new" className="font-medium text-accent-ink hover:underline">Add the first document</Link>, or run <code>npm run ingest</code> for the repo documents.
        </EmptyState>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-line text-xs text-subtle">
              <tr>
                <th className="px-5 py-3 font-medium">Document</th>
                <th className="px-3 py-3 font-medium">Sections</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-3 py-3 font-medium">Managed by</th>
                <th className="px-3 py-3 font-medium">Last indexed</th>
                <th className="px-5 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {docs.map((d) => (
                <tr key={d.id} className="hover:bg-surface-2/60">
                  <td className="px-5 py-3">
                    <Link href={`/admin/knowledge/${d.id}`} className="font-medium text-fg hover:underline">{d.title}</Link>
                    <p className="text-xs text-subtle">{d.slug}</p>
                  </td>
                  <td className="px-3 py-3 tabular-nums text-muted">{d.chunk_count}</td>
                  <td className="px-3 py-3"><KbStatus doc={d} /></td>
                  <td className="px-3 py-3 text-xs text-muted">{d.managed_by === "admin" ? "Admin UI" : "Repo file"}</td>
                  <td className="px-3 py-3 text-xs text-muted">{d.ingested_at ? new Date(d.ingested_at).toLocaleString() : "—"}</td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-1">
                      <button className="btn-ghost px-2 py-1 text-xs" disabled={busyId === d.id} onClick={() => reindex(d)} title="Re-index">
                        <RotateCw className={`h-4 w-4 ${busyId === d.id ? "animate-spin" : ""}`} />
                      </button>
                      <button className="btn-ghost px-2 py-1 text-xs text-danger" disabled={busyId === d.id} onClick={() => setToDelete(d)} title="Delete">
                        <Trash2 className="h-4 w-4" />
                      </button>
                      <Link href={`/admin/knowledge/${d.id}`} className="btn-secondary px-3 py-1 text-xs">Edit</Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-line px-5 py-3 text-xs text-muted">{docs.length} documents · {totalChunks} searchable sections</p>
        </div>
      )}

      <ConfirmDialog
        open={!!toDelete}
        danger
        busy={busyId === toDelete?.id}
        title="Delete this document?"
        confirmLabel="Delete document"
        onCancel={() => setToDelete(null)}
        onConfirm={() => toDelete && remove(toDelete)}
      >
        <b>{toDelete?.title}</b> and its {toDelete?.chunk_count} sections will be removed, and the assistant will stop citing it.
        {toDelete?.managed_by === "repo" && " It's a repo document, so it comes back the next time `npm run ingest` runs."}
      </ConfirmDialog>
    </div>
  );
}
