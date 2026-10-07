"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Search, ShieldOff, ShieldCheck, Trash2, Users } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { RoleBadge, StatusBadge } from "@/components/admin/UserBadges";
import { Avatar, EmptyState, ErrorBanner, PageHeader, Skeleton } from "@/components/ui";
import type { AdminUser, Role, Status } from "@/lib/types";

const TABS: { key: Role | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "student", label: "Students" },
  { key: "teacher", label: "Teachers" },
  { key: "admin", label: "Admins" },
];

type Pending = { user: AdminUser; kind: "suspend" | "delete" } | null;

export default function AdminUsersPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <UsersInner />
    </Suspense>
  );
}

function UsersInner() {
  const { api, me } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const role = (params.get("role") as Role | null) ?? null;
  const status = (params.get("status") as Status | null) ?? null;
  const page = Number(params.get("page") ?? 0);
  const [q, setQ] = useState(params.get("q") ?? "");
  const [data, setData] = useState<{ users: AdminUser[]; total: number; pageSize: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Pending>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const setParam = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (!("page" in patch)) next.delete("page");
    router.replace(`${pathname}?${next.toString()}`);
  };

  // Debounced search → URL (so filters survive reloads and can be linked).
  useEffect(() => {
    const t = setTimeout(() => {
      if ((params.get("q") ?? "") !== q.trim()) setParam({ q: q.trim() || null });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  useEffect(() => {
    let cancelled = false;
    const qs = new URLSearchParams();
    if (role) qs.set("role", role);
    if (status) qs.set("status", status);
    if (params.get("q")) qs.set("q", params.get("q")!);
    qs.set("page", String(page));
    api<{ users: AdminUser[]; total: number; pageSize: number }>(`/api/admin/users?${qs.toString()}`)
      .then((r) => {
        if (cancelled) return;
        setData(r);
        setError(null);
      })
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [api, role, status, page, params, reloadKey]);

  async function act(user: AdminUser, body: Record<string, string> | null) {
    setBusyId(user.id);
    setError(null);
    try {
      if (body) await api(`/api/admin/users/${user.id}`, { method: "PATCH", body: JSON.stringify(body) });
      else await api(`/api/admin/users/${user.id}`, { method: "DELETE" });
      setConfirm(null);
      setReloadKey((k) => k + 1);
    } catch (e) {
      setError((e as Error).message);
      setConfirm(null);
    } finally {
      setBusyId(null);
    }
  }

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div>
      <PageHeader icon={Users} title="Users" subtitle="Students, teachers and admins. Demo accounts are marked; real sign-ups appear here too." />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-2xl border border-line bg-surface p-1">
          {TABS.map((t) => {
            const active = (t.key === "all" && !role) || t.key === role;
            return (
              <button
                key={t.key}
                onClick={() => setParam({ role: t.key === "all" ? null : t.key })}
                className={`rounded-xl px-3 py-1.5 text-sm transition ${active ? "bg-accent-soft font-medium text-accent-ink" : "text-muted hover:text-fg"}`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
        <select className="input w-auto" value={status ?? ""} onChange={(e) => setParam({ status: e.target.value || null })} aria-label="Filter by status">
          <option value="">Any status</option>
          <option value="active">Active</option>
          <option value="pending">Pending</option>
          <option value="suspended">Suspended</option>
        </select>
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
          <input className="input pl-10" placeholder="Search name or email…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search users" />
        </div>
      </div>

      {error && <div className="mb-4"><ErrorBanner message={error} onRetry={() => setReloadKey((k) => k + 1)} /></div>}

      {!data ? (
        <Skeleton className="h-96" />
      ) : data.users.length === 0 ? (
        <EmptyState icon={Users} title="No users match these filters" />
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-line text-xs text-subtle">
              <tr>
                <th className="px-5 py-3 font-medium">User</th>
                <th className="px-3 py-3 font-medium">Role</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-3 py-3 font-medium">Profile</th>
                <th className="px-3 py-3 font-medium">Joined</th>
                <th className="px-5 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.users.map((u) => {
                const self = u.id === me?.user.id;
                const busy = busyId === u.id;
                return (
                  <tr key={u.id} className="hover:bg-surface-2/60">
                    <td className="px-5 py-3">
                      <Link href={`/admin/users/${u.id}`} className="flex items-center gap-3">
                        <Avatar name={u.display_name ?? u.email ?? "?"} size="sm" />
                        <span className="min-w-0">
                          <span className="flex items-center gap-1.5 font-medium text-fg hover:underline">
                            {u.display_name ?? "Unnamed"}
                            {u.is_demo && <span className="chip px-1.5 py-0 text-[10px]">demo</span>}
                            {self && <span className="chip-accent px-1.5 py-0 text-[10px]">you</span>}
                          </span>
                          <span className="block truncate text-xs text-subtle">{u.email}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-3 py-3"><RoleBadge role={u.role} /></td>
                    <td className="px-3 py-3"><StatusBadge status={u.status} /></td>
                    <td className="px-3 py-3 text-xs text-muted">{u.profile ? u.profile.name : u.role === "admin" ? "—" : "Not set up"}</td>
                    <td className="px-3 py-3 text-xs text-muted">{new Date(u.created_at).toLocaleDateString()}</td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1">
                        {u.status === "pending" && (
                          <button className="btn-ghost px-2 py-1 text-xs text-success" disabled={busy} onClick={() => act(u, { status: "active" })} title="Approve">
                            <Check className="h-4 w-4" /> Approve
                          </button>
                        )}
                        {u.status === "suspended" ? (
                          <button className="btn-ghost px-2 py-1 text-xs" disabled={busy} onClick={() => act(u, { status: "active" })} title="Reactivate">
                            <ShieldCheck className="h-4 w-4" /> Reactivate
                          </button>
                        ) : (
                          !self && (
                            <button className="btn-ghost px-2 py-1 text-xs" disabled={busy} onClick={() => setConfirm({ user: u, kind: "suspend" })} title="Suspend">
                              <ShieldOff className="h-4 w-4" />
                            </button>
                          )
                        )}
                        {!self && (
                          <button className="btn-ghost px-2 py-1 text-xs text-danger" disabled={busy} onClick={() => setConfirm({ user: u, kind: "delete" })} title="Delete">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                        <Link href={`/admin/users/${u.id}`} className="btn-secondary px-3 py-1 text-xs">Manage</Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="flex items-center justify-between border-t border-line px-5 py-3 text-xs text-muted">
            <span>{data.total} users</span>
            <span className="flex items-center gap-2">
              <button className="btn-ghost px-2 py-1" disabled={page === 0} onClick={() => setParam({ page: String(page - 1) })} aria-label="Previous page">
                <ChevronLeft className="h-4 w-4" />
              </button>
              Page {page + 1} of {pages}
              <button className="btn-ghost px-2 py-1" disabled={page + 1 >= pages} onClick={() => setParam({ page: String(page + 1) })} aria-label="Next page">
                <ChevronRight className="h-4 w-4" />
              </button>
            </span>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirm}
        danger
        busy={!!busyId}
        title={confirm?.kind === "delete" ? "Delete this user?" : "Suspend this user?"}
        confirmLabel={confirm?.kind === "delete" ? "Delete user" : "Suspend"}
        onCancel={() => setConfirm(null)}
        onConfirm={() => confirm && act(confirm.user, confirm.kind === "delete" ? null : { status: "suspended" })}
      >
        {confirm?.kind === "delete" ? (
          <>This permanently removes <b>{confirm.user.display_name ?? confirm.user.email}</b>: their login, profile, saved matches and chat history.</>
        ) : (
          <><b>{confirm?.user.display_name ?? confirm?.user.email}</b> will be signed out, blocked from signing in, and hidden from matching until reactivated.</>
        )}
      </ConfirmDialog>
    </div>
  );
}
