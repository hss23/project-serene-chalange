"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bookmark, LayoutDashboard, LogOut, MessageSquareText, Sparkles, Users } from "lucide-react";
import { useAuth } from "./AuthProvider";
import { Avatar } from "./ui";

const LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/match", label: "Find a mentor", icon: Sparkles },
  { href: "/mentors", label: "Mentors", icon: Users },
  { href: "/saved", label: "Saved", icon: Bookmark },
  { href: "/chat", label: "Assistant", icon: MessageSquareText },
];

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
  const { user, loading, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const name = user?.displayName || user?.email || "You";

  return (
    <header className="sticky top-0 z-20 border-b border-line/70 bg-bg/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href={user ? "/dashboard" : "/"} aria-label="Serene Mentors home">
          <Logo />
        </Link>

        {user && (
          <nav className="order-3 -mx-1 flex w-full gap-1 overflow-x-auto px-1 md:order-none md:mx-0 md:w-auto md:rounded-2xl md:border md:border-line md:bg-surface/70 md:p-1">
            {LINKS.map(({ href, label, icon: Icon }) => {
              const active = pathname.startsWith(href);
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
                <span className="max-w-40 truncate text-muted">{user.email}</span>
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
