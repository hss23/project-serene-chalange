import { Router } from "express";
import { z } from "zod";
import { FEATURES, getFeatures, setFeature, type FeatureName } from "../data/settings";
import { writeAudit } from "../lib/audit";
import { currentAppUser, requireRole } from "../middleware/auth";

export const settingsRouter = Router();

// Any signed-in, active user: which optional features are on (drives what the UI shows).
settingsRouter.get("/settings", async (_req, res) => {
  res.json({ features: await getFeatures() });
});

const FeatureNames = Object.keys(FEATURES) as [FeatureName, ...FeatureName[]];
const Patch = z.object({ feature: z.enum(FeatureNames), enabled: z.boolean() });

// Admin only: switch a feature on or off.
settingsRouter.patch("/admin/settings", requireRole("admin"), async (req, res) => {
  const actor = currentAppUser(req);
  const { feature, enabled } = Patch.parse(req.body ?? {});
  const before = await getFeatures();
  const features = await setFeature(feature, enabled, actor.id);
  await writeAudit(actor, "setting_change", { id: FEATURES[feature], email: null, name: feature }, { from: before[feature], to: enabled });
  res.json({ features });
});
