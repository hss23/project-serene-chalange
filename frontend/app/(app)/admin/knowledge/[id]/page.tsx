"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { ArrowLeft, FileText, Layers, RotateCw } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { KbEditor } from "@/components/admin/KbEditor";
import { ErrorBanner, InfoBanner, PageHeader, Skeleton } from "@/components/ui";
import type { KbDocumentDetail, KbSaveResult } from "@/lib/types";
import { KbStatus } from "@/components/admin/KbStatus";

export default function KnowledgeDocPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <DocInner />
    </Suspense>
  );
}

function DocInner() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const { api } = useAuth();
  const [data, setData] = useState<KbDocumentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(
    params.get("saved") ? { ok: true, message: params.get("saved")! } : null,
  );
  const [version, setVersion] = useState(0);
  const [reindexing, setReindexing] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await api<KbDocumentDetail>(`/api/admin/kb/${id}`));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [api, id]);

  useEffect(() => {
    let cancelled = false;
    api<KbDocumentDetail>(`/api/admin/kb/${id}`)
      .then((d) => !cancelled && setData(d))
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [api, id]);

  const report = (r: KbSaveResult) => setResult({ ok: r.status === "indexed", message: r.message });

  async function reindex() {
    setReindexing(true);
    try {
      report(await api<KbSaveResult>(`/api/admin/kb/${id}/reindex`, { method: "POST" }));
      await load();
    } catch (e) {
      setResult({ ok: false, message: (e as Error).message });
    } finally {
      setReindexing(false);
    }
  }

  if (error && !data) return <ErrorBanner message={error} onRetry={load} />;
  if (!data) return <Skeleton className="h-96" />;
  const { document: doc, chunks } = data;

  return (
    <div className="space-y-6">
      <Link href="/admin/knowledge" className="inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
        <ArrowLeft className="h-4 w-4" /> Knowledge base
      </Link>
      <PageHeader
        icon={FileText}
        title={doc.title}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <KbStatus doc={doc} />
            <span>{doc.chunk_count} sections · {doc.managed_by === "admin" ? "managed in the admin UI" : `repo file ${doc.source}`}</span>
          </span>
        }
        action={
          <button className="btn-secondary" onClick={reindex} disabled={reindexing}>
            <RotateCw className={`h-4 w-4 ${reindexing ? "animate-spin" : ""}`} /> Re-index
          </button>
        }
      />

      {result && (
        <div className={`rounded-2xl border p-4 text-sm ${result.ok ? "border-success/20 bg-success-soft text-success" : "border-danger/20 bg-danger-soft text-danger"}`}>
          {result.message}
        </div>
      )}
      {doc.ingest_error && !result && <ErrorBanner message={`Last indexing failed: ${doc.ingest_error}`} onRetry={reindex} />}
      {doc.managed_by === "repo" && (
        <InfoBanner>This document comes from a repo file. Saving here moves it to the admin UI, so later <code>npm run ingest</code> runs won&apos;t overwrite your edits.</InfoBanner>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
        {doc.content === null ? (
          <InfoBanner>No stored content yet. Run <code>npm run ingest</code> once to load the repo documents.</InfoBanner>
        ) : (
          <KbEditor
            key={version}
            initialTitle={doc.title}
            initialContent={doc.content}
            submitLabel="Save and re-index"
            onSave={async (v) => {
              const r = await api<KbSaveResult>(`/api/admin/kb/${id}`, { method: "PUT", body: JSON.stringify(v) });
              report(r);
              await load();
              setVersion((n) => n + 1);
            }}
          />
        )}

        <aside className="card h-fit xl:sticky xl:top-24">
          <p className="eyebrow mb-3 flex items-center gap-1.5"><Layers className="h-3.5 w-3.5" /> Indexed sections</p>
          {chunks.length === 0 ? (
            <p className="text-sm text-subtle">Nothing indexed yet.</p>
          ) : (
            <ol className="space-y-3 text-sm">
              {chunks.map((c) => (
                <li key={c.index} className="rounded-xl border border-line bg-surface-2 p-3">
                  <p className="font-medium text-fg">{c.index + 1}. {c.heading}</p>
                  <p className="mt-1 line-clamp-3 text-xs text-muted">{c.preview}</p>
                </li>
              ))}
            </ol>
          )}
        </aside>
      </div>
    </div>
  );
}
