import { config } from "dotenv";
config({ quiet: true }); // local development reads backend/.env; Render injects env vars directly

import { createApp } from "./app";

const REQUIRED = [
  "FIREBASE_ADMIN_PROJECT_ID",
  "FIREBASE_ADMIN_CLIENT_EMAIL",
  "FIREBASE_ADMIN_PRIVATE_KEY",
  "SUPABASE_URL",
  "GEMINI_API_KEY",
];
const missing = REQUIRED.filter((k) => !process.env[k]);
if (!process.env.SUPABASE_SECRET_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY) missing.push("SUPABASE_SECRET_KEY");
if (missing.length) {
  // Start anyway so /api/health can report the problem, but make it loud in the logs.
  console.warn(`[config] Missing environment variables: ${missing.join(", ")}`);
}

const port = Number(process.env.PORT ?? 4000);
const server = createApp().listen(port, () => {
  console.log(`[api] listening on http://localhost:${port}`);
});

// Graceful shutdown on Render deploys/restarts.
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    console.log(`[api] ${signal} received, shutting down`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  });
}
