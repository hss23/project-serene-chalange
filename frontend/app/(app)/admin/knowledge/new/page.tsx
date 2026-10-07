"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, FilePlus2 } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { KbEditor } from "@/components/admin/KbEditor";
import { PageHeader } from "@/components/ui";
import type { KbSaveResult } from "@/lib/types";

export default function NewKnowledgeDocPage() {
  const { api } = useAuth();
  const router = useRouter();

  return (
    <div className="space-y-6">
      <Link href="/admin/knowledge" className="inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
        <ArrowLeft className="h-4 w-4" /> Knowledge base
      </Link>
      <PageHeader icon={FilePlus2} title="New document" subtitle="Write in Markdown or upload a .md/.txt file. It's chunked, embedded and searchable as soon as you save." />
      <KbEditor
        submitLabel="Save and index"
        onSave={async (v) => {
          const r = await api<KbSaveResult>("/api/admin/kb", { method: "POST", body: JSON.stringify(v) });
          router.replace(`/admin/knowledge/${r.id}?saved=${encodeURIComponent(r.message)}`);
        }}
      />
    </div>
  );
}
