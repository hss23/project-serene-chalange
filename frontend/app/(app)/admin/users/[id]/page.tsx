"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, History, ShieldCheck, ShieldOff, Trash2, UserCog } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { StudentProfileForm, TeacherProfileForm } from "@/components/ProfileForm";
import { RoleBadge, StatusBadge } from "@/components/admin/UserBadges";
import { Avatar, ErrorBanner, InfoBanner, Skeleton } from "@/components/ui";
import { describeAudit } from "@/lib/audit";
import { useSkills } from "@/lib/hooks/useSkills";
import { ROLE_LABEL } from "@/lib/roles";
import type { AdminUserDetail, OwnedMentee, OwnedMentor, Role } from "@/lib/types";

type Confirm = { kind: "suspend" | "delete" } | { kind: "role"; role: Role } | null;

export default function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { api, me } = useAuth();
  const router = useRouter();
  const { skills } = useSkills();
  const [data, setData] = useState<AdminUserDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [roleChoice, setRoleChoice] = useState<Role | "">("");

  const load = useCallback(async () => {
    try {
      setData(await api<AdminUserDetail>(`/api/admin/users/${id}`));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [api, id]);

  useEffect(() => {
    let cancelled = false;
    api<AdminUserDetail>(`/api/admin/users/${id}`)
      .then((d) => !cancelled && setData(d))
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [api, id]);

  async function run(fn: () => Promise<unknown>, done: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await fn();
      setNotice(done);
      setConfirm(null);
      await load();
    } catch (e) {
      setError((e as Error).message);
      setConfirm(null);
    } finally {
      setBusy(false);
    }
  }

  const patch = (body: Record<string, string>) => api(`/api/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(body) });

  if (error && !data) return <ErrorBanner message={error} onRetry={load} />;
  if (!data) return <Skeleton className="h-96" />;

  const { user, profile, profileComplete, audit } = data;
  const self = user.id === me?.user.id;
  const name = user.display_name ?? user.email ?? "Unnamed";

  return (
    <div className="space-y-6">
      <Link href="/admin/users" className="inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
        <ArrowLeft className="h-4 w-4" /> All users
      </Link>

      <section className="card flex flex-wrap items-center gap-5">
        <Avatar name={name} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="flex flex-wrap items-center gap-2 text-xl font-semibold text-fg">
            {name}
            {user.is_demo && <span className="chip">demo account</span>}
            {self && <span className="chip-accent">you</span>}
          </h1>
          <p className="text-sm text-muted">{user.email}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-subtle">
            <RoleBadge role={user.role} /> <StatusBadge status={user.status} />
            <span>Joined {new Date(user.created_at).toLocaleDateString()}</span>
            <span>· Last seen {new Date(user.last_seen_at).toLocaleString()}</span>
          </div>
        </div>
      </section>

      {notice && (
        <div className="flex items-center gap-2 rounded-2xl border border-success/20 bg-success-soft p-4 text-sm text-success">
          <CheckCircle2 className="h-4 w-4" /> {notice}
        </div>
      )}
      {error && <ErrorBanner message={error} />}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <UserCog className="h-4 w-4 text-subtle" />
            <h2 className="font-semibold text-fg">{user.role === "admin" ? "Admin account" : "Matching profile"}</h2>
            {user.role !== "admin" && user.role && (
              <span className={`text-xs ${profileComplete ? "text-success" : "text-warn"}`}>· {profileComplete ? "complete" : "incomplete"}</span>
            )}
          </div>
          {!user.role ? (
            <InfoBanner>This user hasn&apos;t chosen a role yet. Assign one on the right, or wait for them to finish onboarding.</InfoBanner>
          ) : user.role === "admin" ? (
            <InfoBanner>Admins don&apos;t have a matching profile.</InfoBanner>
          ) : !skills ? (
            <Skeleton className="h-96" />
          ) : user.role === "student" ? (
            <StudentProfileForm
              key={JSON.stringify(profile)}
              initial={profile as OwnedMentee | null}
              defaultName={user.display_name ?? ""}
              skills={skills}
              submitLabel="Save changes"
              onSave={(v) => run(() => api(`/api/admin/users/${id}/profile`, { method: "PUT", body: JSON.stringify(v) }), "Profile updated.")}
            />
          ) : (
            <TeacherProfileForm
              key={JSON.stringify(profile)}
              initial={profile as OwnedMentor | null}
              defaultName={user.display_name ?? ""}
              skills={skills}
              submitLabel="Save changes"
              onSave={(v) => run(() => api(`/api/admin/users/${id}/profile`, { method: "PUT", body: JSON.stringify(v) }), "Profile updated.")}
            />
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <section className="card space-y-3">
            <p className="eyebrow">Account status</p>
            {user.status === "pending" && (
              <button className="btn-primary w-full" disabled={busy} onClick={() => run(() => patch({ status: "active" }), "Teacher approved.")}>
                <CheckCircle2 className="h-4 w-4" /> Approve teacher
              </button>
            )}
            {user.status === "suspended" ? (
              <button className="btn-secondary w-full" disabled={busy} onClick={() => run(() => patch({ status: "active" }), "Account reactivated.")}>
                <ShieldCheck className="h-4 w-4" /> Reactivate
              </button>
            ) : (
              <button className="btn-secondary w-full text-danger" disabled={busy || self} onClick={() => setConfirm({ kind: "suspend" })}>
                <ShieldOff className="h-4 w-4" /> Suspend
              </button>
            )}
          </section>

          <section className="card space-y-3">
            <p className="eyebrow">Role</p>
            <select className="input" value={roleChoice || user.role || ""} onChange={(e) => setRoleChoice(e.target.value as Role)} disabled={self} aria-label="Role">
              {!user.role && <option value="">No role</option>}
              {(["student", "teacher", "admin"] as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
            </select>
            <button
              className="btn-secondary w-full"
              disabled={busy || self || !roleChoice || roleChoice === user.role}
              onClick={() => roleChoice && setConfirm({ kind: "role", role: roleChoice })}
            >
              Change role
            </button>
            {self && <p className="text-xs text-subtle">You can&apos;t change your own role.</p>}
          </section>

          <section className="card space-y-3">
            <p className="eyebrow">Danger zone</p>
            <button className="btn w-full border border-danger/30 text-danger hover:bg-danger-soft" disabled={busy || self} onClick={() => setConfirm({ kind: "delete" })}>
              <Trash2 className="h-4 w-4" /> Delete user
            </button>
          </section>

          <section className="card">
            <p className="eyebrow mb-3 flex items-center gap-1.5"><History className="h-3.5 w-3.5" /> Audit trail</p>
            {audit.length === 0 ? (
              <p className="text-sm text-subtle">No admin actions on this user yet.</p>
            ) : (
              <ul className="space-y-2.5 text-sm">
                {audit.map((a) => (
                  <li key={a.id}>
                    <p className="text-fg">{describeAudit(a)}</p>
                    <p className="text-xs text-subtle">{a.actorEmail} · {a.at ? new Date(a.at).toLocaleString() : ""}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>

      <ConfirmDialog
        open={!!confirm}
        danger={confirm?.kind !== "role"}
        busy={busy}
        title={confirm?.kind === "delete" ? "Delete this user?" : confirm?.kind === "suspend" ? "Suspend this user?" : "Change role?"}
        confirmLabel={confirm?.kind === "delete" ? "Delete user" : confirm?.kind === "suspend" ? "Suspend" : "Change role"}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (!confirm) return;
          if (confirm.kind === "role") {
            const newRole = confirm.role;
            run(() => patch({ role: newRole }), `Role changed to ${ROLE_LABEL[newRole]}.`).then(() => setRoleChoice(""));
          } else if (confirm.kind === "delete") {
            run(() => api(`/api/admin/users/${id}`, { method: "DELETE" }), "User deleted.").then(() => router.replace("/admin/users"));
          } else {
            run(() => patch({ status: "suspended" }), "Account suspended.");
          }
        }}
      >
        {confirm?.kind === "delete" && <>This permanently removes <b>{name}</b>: their login, profile, saved matches and chat history.</>}
        {confirm?.kind === "suspend" && <><b>{name}</b> will be signed out, blocked from signing in, and hidden from matching until reactivated.</>}
        {confirm?.kind === "role" && (
          <>
            Change <b>{name}</b> to <b>{ROLE_LABEL[confirm.role]}</b>?{" "}
            {user.role && user.role !== "admin" && "Their current matching profile will be removed and they'll set up a new one."}
          </>
        )}
      </ConfirmDialog>
    </div>
  );
}
