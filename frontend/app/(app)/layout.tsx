"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { InfoBanner, Spinner } from "@/components/ui";

// Client-side guard for UX only. Real enforcement is server-side: every /api route verifies
// the Firebase ID token, and Firestore rules check request.auth.uid.
export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, configured } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (configured && !loading && !user) router.replace("/login");
  }, [configured, loading, user, router]);

  if (!configured) {
    return <InfoBanner>Firebase isn&apos;t configured. Set the NEXT_PUBLIC_FIREBASE_* environment variables.</InfoBanner>;
  }
  if (loading || !user) {
    return (
      <div className="flex justify-center py-24 text-accent">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }
  return <>{children}</>;
}
