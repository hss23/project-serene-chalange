// Firestore security rules tests. Requires the Firestore emulator:
//   npm run test:rules   (from frontend/; rules live at the repo root)
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, getDocs, collection, serverTimestamp, setDoc } from "firebase/firestore";

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "serene-rules-test",
    firestore: { rules: readFileSync("../firestore.rules", "utf8") },
  });
});

afterAll(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "users/alice/chatSessions/s1"), { title: "Hi" });
    await setDoc(doc(db, "users/alice/chatSessions/s1/messages/m1"), { role: "user", text: "Hello" });
    await setDoc(doc(db, "users/alice/matchHistory/h1"), { menteeId: "mentee-01" });
  });
});

const saved = (mentorId = "mentor-01") => ({
  mentorId,
  mentorName: "Dr. Priya Raman",
  score: 98,
  reasons: ["Covers 4 of 4 goal skills"],
  menteeId: "mentee-01",
  savedAt: serverTimestamp(),
});

describe("owner access", () => {
  it("can read own chat messages and match history", async () => {
    const db = env.authenticatedContext("alice").firestore();
    await assertSucceeds(getDocs(collection(db, "users/alice/chatSessions/s1/messages")));
    await assertSucceeds(getDoc(doc(db, "users/alice/matchHistory/h1")));
  });

  it("can save, update and delete a valid saved match", async () => {
    const db = env.authenticatedContext("alice").firestore();
    await assertSucceeds(setDoc(doc(db, "users/alice/savedMatches/mentor-01"), saved()));
    await assertSucceeds(deleteDoc(doc(db, "users/alice/savedMatches/mentor-01")));
  });

  it("can write preferences/settings", async () => {
    const db = env.authenticatedContext("alice").firestore();
    await assertSucceeds(
      setDoc(doc(db, "users/alice/preferences/settings"), { lastMenteeId: "mentee-01", updatedAt: serverTimestamp() }),
    );
  });
});

describe("cross-user and anonymous access", () => {
  it("denies reading another user's data", async () => {
    const db = env.authenticatedContext("bob").firestore();
    await assertFails(getDocs(collection(db, "users/alice/chatSessions/s1/messages")));
    await assertFails(getDoc(doc(db, "users/alice/matchHistory/h1")));
    await assertFails(getDocs(collection(db, "users/alice/savedMatches")));
  });

  it("denies writing into another user's saved matches", async () => {
    const db = env.authenticatedContext("bob").firestore();
    await assertFails(setDoc(doc(db, "users/alice/savedMatches/mentor-01"), saved()));
  });

  it("denies unauthenticated access", async () => {
    const db = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, "users/alice/chatSessions/s1")));
    await assertFails(setDoc(doc(db, "users/alice/savedMatches/mentor-01"), saved()));
  });
});

describe("server-only collections and validation", () => {
  it("denies client writes to chat messages, match history and meta", async () => {
    const db = env.authenticatedContext("alice").firestore();
    await assertFails(setDoc(doc(db, "users/alice/chatSessions/s1/messages/m2"), { role: "assistant", text: "fake" }));
    await assertFails(setDoc(doc(db, "users/alice/matchHistory/h2"), { menteeId: "x" }));
    await assertFails(setDoc(doc(db, "users/alice/meta/rate_chat"), { count: 0 }));
  });

  it("rejects malformed saved matches", async () => {
    const db = env.authenticatedContext("alice").firestore();
    // mentorId field doesn't match document id
    await assertFails(setDoc(doc(db, "users/alice/savedMatches/mentor-02"), saved("mentor-01")));
    // score out of range
    await assertFails(setDoc(doc(db, "users/alice/savedMatches/mentor-01"), { ...saved(), score: 500 }));
    // unexpected field
    await assertFails(setDoc(doc(db, "users/alice/savedMatches/mentor-01"), { ...saved(), isAdmin: true }));
  });

  it("rejects preferences documents other than settings", async () => {
    const db = env.authenticatedContext("alice").firestore();
    await assertFails(setDoc(doc(db, "users/alice/preferences/other"), { lastMenteeId: "mentee-01" }));
  });
});
