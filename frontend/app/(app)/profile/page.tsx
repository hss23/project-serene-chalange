"use client";

import { useState } from "react";
import { CheckCircle2, UserRoundCog } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { StudentProfileForm, TeacherProfileForm } from "@/components/ProfileForm";
import { ErrorBanner, PageHeader, Skeleton } from "@/components/ui";
import { useSkills } from "@/lib/hooks/useSkills";
import { ROLE_HINT, ROLE_LABEL } from "@/lib/roles";
import type { Me, OwnedMentee, OwnedMentor } from "@/lib/types";

export default function ProfilePage() {
  const { me, api, refreshMe } = useAuth();
  const { skills, error } = useSkills();
  const [saved, setSaved] = useState(false);

  if (!me?.user.role) return null;
  const role = me.user.role;

  async function save(values: unknown) {
    setSaved(false);
    await api<Me>("/api/profile", { method: "PUT", body: JSON.stringify(values) });
    await refreshMe();
    setSaved(true);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        icon={UserRoundCog}
        title="Your profile"
        subtitle={`${ROLE_LABEL[role]} (${ROLE_HINT[role]}) · ${me.user.email ?? ""}. Changes apply to matching straight away.`}
      />
      {saved && (
        <div className="mb-5 flex items-center gap-2 rounded-2xl border border-success/20 bg-success-soft p-4 text-sm text-success">
          <CheckCircle2 className="h-4 w-4" /> Profile saved.
        </div>
      )}
      {error ? (
        <ErrorBanner message={error} />
      ) : !skills ? (
        <Skeleton className="h-96" />
      ) : role === "student" ? (
        <StudentProfileForm initial={me.profile as OwnedMentee | null} defaultName={me.user.displayName ?? ""} skills={skills} onSave={save} />
      ) : (
        <TeacherProfileForm initial={me.profile as OwnedMentor | null} defaultName={me.user.displayName ?? ""} skills={skills} onSave={save} />
      )}
    </div>
  );
}
