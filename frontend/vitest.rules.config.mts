import { defineConfig } from "vitest/config";

// Firestore security rules tests; run against the emulator via `npm run test:rules`.
export default defineConfig({
  test: { include: ["tests/firestore.rules.test.ts"], environment: "node", testTimeout: 20000 },
});
