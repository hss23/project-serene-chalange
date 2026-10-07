"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import type { Skill } from "@/lib/types";

/** Skills list for the profile forms (GET /api/skills). */
export function useSkills() {
  const { api } = useAuth();
  const [skills, setSkills] = useState<Skill[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    api<{ skills: Skill[] }>("/api/skills")
      .then((r) => !cancelled && setSkills(r.skills))
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [api]);
  return { skills, error };
}
