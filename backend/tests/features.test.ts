import { describe, expect, it, vi } from "vitest";
import { KbDocumentInput, previewChunks, slugify, uniqueSlug } from "../src/rag/kbRules";
import {
  availableMentors,
  daysLeft,
  isExpired,
  MAX_PENDING_PER_STUDENT,
  requestBlocker,
  spotsLeft,
  type RequestContext,
} from "../src/mentorships/rules";

describe("knowledge-base document rules", () => {
  const body = "## Section\n" + "Mentors meet mentees every two weeks for at least 45 minutes. ".repeat(2);

  it("accepts a valid Markdown document and normalises line endings", () => {
    const parsed = KbDocumentInput.parse({ title: "  Meeting cadence  ", content: body.replace(/\n/g, "\r\n") });
    expect(parsed.title).toBe("Meeting cadence");
    expect(parsed.content).not.toContain("\r");
  });

  it("rejects short titles, too-short or too-long content, and binary data", () => {
    expect(() => KbDocumentInput.parse({ title: "Hi", content: body })).toThrow(/at least 3/);
    expect(() => KbDocumentInput.parse({ title: "Valid title", content: "too short" })).toThrow(/at least 50/);
    expect(() => KbDocumentInput.parse({ title: "Valid title", content: "x".repeat(100_001) })).toThrow(/at most/);
    expect(() => KbDocumentInput.parse({ title: "Valid title", content: body + "\u0000" })).toThrow(/plain text/);
  });

  it("previews the sections a document will be split into", () => {
    expect(previewChunks(body).map((c) => c.heading)).toEqual(["Section"]);
    expect(previewChunks("# Only a title\n\n## Empty\n")).toEqual([]);
  });

  it("makes URL-safe, unique slugs", () => {
    expect(slugify("Mentor Onboarding: Week 1!")).toBe("mentor-onboarding-week-1");
    expect(slugify("Café Guidelines")).toBe("cafe-guidelines");
    expect(slugify("!!!")).toBe("document");
    expect(uniqueSlug("faq", new Set(["faq", "faq-2"]))).toBe("faq-3");
    expect(uniqueSlug("new-doc", new Set(["faq"]))).toBe("new-doc");
  });
});

describe("mentorship rules", () => {
  const ok: RequestContext = {
    menteeComplete: true,
    mentorEligible: true,
    mentorSpotsLeft: 2,
    hasOpenRequestToMentor: false,
    hasActiveMentor: false,
    pendingCount: 0,
  };

  it("allows a valid request", () => {
    expect(requestBlocker(ok)).toBeNull();
  });

  it("blocks each rule with a specific code", () => {
    expect(requestBlocker({ ...ok, menteeComplete: false })?.code).toBe("profile_incomplete");
    expect(requestBlocker({ ...ok, hasActiveMentor: true })?.code).toBe("already_has_mentor");
    expect(requestBlocker({ ...ok, mentorEligible: false })?.code).toBe("mentor_unavailable");
    expect(requestBlocker({ ...ok, hasOpenRequestToMentor: true })?.code).toBe("duplicate_request");
    expect(requestBlocker({ ...ok, mentorSpotsLeft: 0 })?.code).toBe("at_capacity");
    expect(requestBlocker({ ...ok, pendingCount: MAX_PENDING_PER_STUDENT })?.code).toBe("too_many_pending");
  });

  it("expires pending requests after seven days", () => {
    const now = new Date("2026-10-10T12:00:00Z");
    expect(isExpired("2026-10-03T12:00:01Z", now)).toBe(false);
    expect(isExpired("2026-10-03T12:00:00Z", now)).toBe(true);
    expect(daysLeft("2026-10-10T11:00:00Z", now)).toBe(7); // just sent
    expect(daysLeft("2026-10-03T18:00:00Z", now)).toBe(1); // last 6 hours
    expect(daysLeft("2026-10-01T00:00:00Z", now)).toBe(0);
  });

  it("computes spots and filters full teachers but keeps existing connections", () => {
    expect(spotsLeft(3, 1)).toBe(2);
    expect(spotsLeft(2, 5)).toBe(0);
    const mentors = [
      { id: "a", max_mentees: 1 },
      { id: "b", max_mentees: 2 },
      { id: "c", max_mentees: 1 },
    ];
    const counts = new Map([["a", 1], ["b", 1], ["c", 1]]);
    expect(availableMentors(mentors, counts, new Set()).map((m) => m.id)).toEqual(["b"]);
    expect(availableMentors(mentors, counts, new Set(["c"])).map((m) => m.id)).toEqual(["b", "c"]);
  });
});

describe("feature gate", () => {
  it("returns 403 feature_disabled when the setting is off and passes when on", async () => {
    let value = false;
    vi.doMock("../src/lib/supabase", () => ({
      supabaseAdmin: () => ({
        from: () => ({ select: async () => ({ data: [{ key: "mentorship_requests_enabled", value }], error: null }) }),
      }),
      dbError: () => {
        throw new Error("db");
      },
    }));
    const settings = await import("../src/data/settings");
    await expect(settings.assertFeature("mentorshipRequests")).rejects.toMatchObject({ status: 403, code: "feature_disabled" });
    vi.resetModules();
    value = true;
    const fresh = await import("../src/data/settings");
    await expect(fresh.assertFeature("mentorshipRequests")).resolves.toBeUndefined();
  });
});
