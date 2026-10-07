import { HttpError } from "../errors";
import { dbError, supabaseAdmin } from "../lib/supabase";

/** Feature flags exposed to clients (camelCase) and their database keys. */
export const FEATURES = {
  mentorshipRequests: "mentorship_requests_enabled",
} as const;
export type FeatureName = keyof typeof FEATURES;
export type Features = Record<FeatureName, boolean>;

const CACHE_MS = 30_000;
let cache: { features: Features; at: number } | null = null;

export async function getFeatures(): Promise<Features> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.features;
  const { data, error } = await supabaseAdmin().from("app_settings").select("key, value");
  if (error) dbError("read settings", error);
  const byKey = new Map((data ?? []).map((r) => [r.key as string, r.value]));
  const features = Object.fromEntries(
    Object.entries(FEATURES).map(([name, key]) => [name, byKey.get(key) === true]),
  ) as Features;
  cache = { features, at: Date.now() };
  return features;
}

export async function setFeature(name: FeatureName, enabled: boolean, userId: string): Promise<Features> {
  const { error } = await supabaseAdmin()
    .from("app_settings")
    .upsert({ key: FEATURES[name], value: enabled, updated_at: new Date().toISOString(), updated_by: userId }, { onConflict: "key" });
  if (error) dbError("update setting", error);
  cache = null;
  return getFeatures();
}

/** Throw 403 when a feature is switched off (used by feature-gated routes). */
export async function assertFeature(name: FeatureName): Promise<void> {
  if (!(await getFeatures())[name]) {
    throw new HttpError(403, "This feature isn't enabled. An admin can turn it on.", "feature_disabled");
  }
}
