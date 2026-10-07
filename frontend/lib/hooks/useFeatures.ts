"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import type { Features } from "@/lib/types";

/** Feature flags set by admins (GET /api/settings). Everything optional stays hidden until loaded. */
export function useFeatures() {
  const { api, user } = useAuth();
  const [features, setFeatures] = useState<Features | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    api<{ features: Features }>("/api/settings")
      .then((r) => !cancelled && setFeatures(r.features))
      .catch(() => !cancelled && setFeatures({ mentorshipRequests: false }));
    return () => {
      cancelled = true;
    };
  }, [api, user, reloadKey]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);
  return { features, reload };
}
