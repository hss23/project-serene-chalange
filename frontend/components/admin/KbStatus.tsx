import { AlertCircle, CheckCircle2 } from "lucide-react";
import type { KbDocumentSummary } from "@/lib/types";

export function KbStatus({ doc }: { doc: Pick<KbDocumentSummary, "ingest_error" | "ingested_at"> }) {
  if (doc.ingest_error) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-danger-soft px-2.5 py-0.5 text-xs font-medium text-danger" title={doc.ingest_error}>
        <AlertCircle className="h-3 w-3" /> Index error
      </span>
    );
  }
  if (!doc.ingested_at) return <span className="inline-flex rounded-full bg-warn-soft px-2.5 py-0.5 text-xs font-medium text-warn">Not indexed</span>;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-medium text-success">
      <CheckCircle2 className="h-3 w-3" /> Indexed
    </span>
  );
}
