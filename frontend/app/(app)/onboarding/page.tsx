"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, Presentation, UserRoundPlus } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { StudentProfileForm, TeacherProfileForm } from "@/components/ProfileForm";
import { ErrorBanner, InfoBanner, PageHeader, Skeleton, Spinner } from "@/components/ui";
import { useSkills } from "@/lib/hooks/useSkills";
import { homePath } from "@/lib/roles";
import type { Me, OwnedMentee, OwnedMentor } from "@/lib/types";

export default function OnboardingPage() {
  const { me, api, refreshMe, user } = useAuth();
  const router = useRouter();
  const { skills, error: skillsError } = useSkills();
  const [choosing, setChoosing] = useState<"student" | "teacher" | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!me) return null;
  const role = me.user.role;
  const defaultName = me.user.displayName || user?.displayName || "";

  async function chooseRole(r: "student" | "teacher") {
    setChoosing(r);
    setError(null);
    try {
      await api<Me>("/api/me/role", { method: "POST", body: JSON.stringify({ role: r }) });
      await refreshMe();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setChoosing(null);
    }
  }

  async function save(values: unknown) {
    await api<Me>("/api/profile", { method: "PUT", body: JSON.stringify(values) });
    const next = await refreshMe();
    if (next) router.replace(homePath(next));
  }

  // Step 1: no role yet (e.g. first Google sign-in, or an existing account from before roles).
  if (!role) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader icon={UserRoundPlus} title="How will you use Serene Mentors?" subtitle="Pick one. An admin can change it later if needed." />
        {error && <div className="mb-4"><ErrorBanner message={error} /></div>}
        <div className="grid gap-4 sm:grid-cols-2">
          {(
            [
              { value: "student", title: "I'm a student", body: "Build a profile with your goals and get ranked mentor matches.", icon: GraduationCap },
              { value: "teacher", title: "I'm a teacher", body: "Share your skills and availability, and see the students you fit best.", icon: Presentation },
            ] as const
          ).map(({ value, title, body, icon: Icon }) => (
            <button key={value} onClick={() => chooseRole(value)} disabled={!!choosing} className="card text-left transition hover:-translate-y-0.5 hover:border-accent/40 disabled:opacity-60">
              <span className="grid h-11 w-11 place-items-center rounded-xl brand-gradient text-white">
                {choosing === value ? <Spinner /> : <Icon className="h-5 w-5" />}
              </span>
              <p className="mt-4 font-semibold text-fg">{title}</p>
              <p className="mt-1 text-sm text-muted">{body}</p>
            </button>
          ))}
        </div>
        <p className="mt-4 text-xs text-subtle">Teacher accounts are reviewed by an admin before they appear in students&apos; matches.</p>
      </div>
    );
  }

  // Step 2: complete the matching profile for the chosen role.
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        icon={role === "student" ? GraduationCap : Presentation}
        title={role === "student" ? "Set up your student profile" : "Set up your teacher profile"}
        subtitle={
          role === "student"
            ? "Your goals, availability and preferences are what the matching scores against."
            : "Students are matched to you on these skills, your availability, experience and format."
        }
      />
      {me.user.status === "pending" && (
        <div className="mb-5">
          <InfoBanner>Your teacher account is awaiting admin approval. You can complete your profile now.</InfoBanner>
        </div>
      )}
      {skillsError ? (
        <ErrorBanner message={skillsError} />
      ) : !skills ? (
        <Skeleton className="h-96" />
      ) : role === "student" ? (
        <StudentProfileForm initial={me.profile as OwnedMentee | null} defaultName={defaultName} skills={skills} onSave={save} submitLabel="Save and see my matches" />
      ) : (
        <TeacherProfileForm initial={me.profile as OwnedMentor | null} defaultName={defaultName} skills={skills} onSave={save} submitLabel="Save profile" />
      )}
    </div>
  );
}
