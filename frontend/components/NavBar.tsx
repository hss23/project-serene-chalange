"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BookOpenText,
  Bookmark,
  Handshake,
  LayoutDashboard,
  LogOut,
  MessageSquareText,
  Shield,
  Sparkles,
  UserRoundCog,
  Users,
  type LucideIcon,
} from "lucide-react";
import { homePath, ROLE_LABEL } from "@/lib/roles";
import type { Role } from "@/lib/types";
import { useFeatures } from "@/lib/hooks/useFeatures";
import { useAuth } from "./AuthProvider";
import { Avatar } from "./ui";

type NavLink = { href: string; label: string; icon: LucideIcon; feature?: "mentorshipRequests" };

const LINKS: Record<Role, NavLink[]> = {
  student: [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/match", label: "My matches", icon: Sparkles },
    { href: "/mentors", label: "Teachers", icon: Users },
    { href: "/saved", label: "Saved", icon: Bookmark },
    { href: "/mentorship", label: "Mentorship", icon: Handshake, feature: "mentorshipRequests" },
    { href: "/chat", label: "Assistant", icon: MessageSquareText },
    { href: "/profile", label: "Profile", icon: UserRoundCog },
  ],
  teacher: [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/mentors", label: "Teachers", icon: Users },
    { href: "/chat", label: "Assistant", icon: MessageSquareText },
    { href: "/profile", label: "Profile", icon: UserRoundCog },
  ],
  admin: [
    { href: "/admin", label: "Overview", icon: Shield },
    { href: "/admin/users", label: "Users", icon: Users },
    { href: "/admin/knowledge", label: "Knowledge", icon: BookOpenText },
    { href: "/match", label: "Matching", icon: Sparkles },
    { href: "/chat", label: "Assistant", icon: MessageSquareText },
  ],
};

export function Logo() {
  return (
    <span className="flex items-center gap-2.5 font-semibold tracking-tight text-fg">
      <span className="grid h-8 w-8 place-items-center rounded-xl brand-gradient text-white shadow-sm">
        <Sparkles className="h-4 w-4" />
      </span>
      Serene Mentors
    </span>
  );
}

export function NavBar() {
  const { user, loading, signOut, me } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const name = me?.user.displayName || user?.displayName || user?.email || "You";
  const role = me?.user.role ?? null;
  const ready = !!role && !!me?.profileComplete;
  const { features } = useFeatures();
  const links = (ready && role ? LINKS[role] : []).filter((l) => !l.feature || features?.[l.feature]);
  // Most specific match wins, so "/admin/users" doesn't also highlight "/admin".
  const activeHref = links
    .filter((l) => pathname === l.href || pathname.startsWith(`${l.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <header className="sticky top-0 z-20 border-b border-line/70 bg-bg/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href={user ? homePath(me) : "/"} aria-label="Serene Mentors home">
          <Logo />
        </Link>

        {user && links.length > 0 && (
          <nav className="order-3 -mx-1 flex w-full gap-1 overflow-x-auto px-1 md:order-none md:mx-0 md:w-auto md:rounded-2xl md:border md:border-line md:bg-surface/70 md:p-1">
            {links.map(({ href, label, icon: Icon }) => {
              const active = href === activeHref;
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-3 py-1.5 text-sm transition ${
                    active ? "bg-accent-soft font-medium text-accent-ink" : "text-muted hover:bg-surface-2 hover:text-fg"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              );
            })}
          </nav>
        )}

        <div className="flex items-center gap-2 text-sm">
          {loading ? null : user ? (
            <>
              <span className="hidden items-center gap-2 lg:flex">
                <Avatar name={name} size="sm" />
                <span className="flex flex-col leading-tight">
                  <span className="max-w-40 truncate text-fg">{name}</span>
                  {role && <span className="text-[11px] text-subtle">{ROLE_LABEL[role]}{me?.user.status === "pending" ? " · pending" : ""}</span>}
                </span>
              </span>
              <button
                className="btn-ghost px-3"
                aria-label="Sign out"
                title="Sign out"
                onClick={async () => {
                  await signOut();
                  router.replace("/login");
                }}
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="btn-ghost">
                Sign in
              </Link>
              <Link href="/signup" className="btn-primary">
                Get started
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
