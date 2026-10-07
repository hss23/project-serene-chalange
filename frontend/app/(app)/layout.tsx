"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { ShieldOff } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { ErrorBanner, InfoBanner, Spinner } from "@/components/ui";
import { allowedRoles, homePath } from "@/lib/roles";

// Client-side routing by role is for UX only. Real enforcement is server-side: every /api route
// verifies the Firebase ID token, loads the account, and checks status and role.
export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, configured, me, meError, refreshMe, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const onboarding = pathname.startsWith("/onboarding");
  const roles = allowedRoles(pathname);
  const needsOnboarding = !!me && (!me.user.role || !me.profileComplete);
  const wrongRole = !!me && !!me.user.role && !!roles && !roles.includes(me.user.role);

  useEffect(() => {
    if (!configured || loading) return;
    if (!user) return router.replace("/login");
    if (!me || me.user.status === "suspended") return;
    if (needsOnboarding && !onboarding) return router.replace("/onboarding");
    if (!needsOnboarding && onboarding) return router.replace(homePath(me));
    if (wrongRole) router.replace(homePath(me));
  }, [configured, loading, user, me, needsOnboarding, onboarding, wrongRole, router]);

  if (!configured) {
    return <InfoBanner>Firebase isn&apos;t configured. Set the NEXT_PUBLIC_FIREBASE_* environment variables.</InfoBanner>;
  }
  if (user && !me && meError) {
    return (
      <div className="mx-auto max-w-lg py-16">
        <ErrorBanner message={meError} onRetry={refreshMe} />
      </div>
    );
  }
  if (me?.user.status === "suspended") {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center py-20 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-danger-soft text-danger">
          <ShieldOff className="h-6 w-6" />
        </span>
        <h1 className="mt-4 text-xl font-semibold text-fg">Account suspended</h1>
        <p className="mt-2 text-sm text-muted">
          An administrator has suspended this account. Contact the programme team if you think this is a mistake.
        </p>
        <button className="btn-secondary mt-6" onClick={async () => { await signOut(); router.replace("/login"); }}>
          Sign out
        </button>
      </div>
    );
  }
  const redirecting = !user || !me || (needsOnboarding && !onboarding) || (!needsOnboarding && onboarding) || wrongRole;
  if (loading || redirecting) {
    return (
      <div className="flex justify-center py-24 text-accent">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }
  return <>{children}</>;
}
