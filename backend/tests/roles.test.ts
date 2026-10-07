import { describe, expect, it, vi } from "vitest";
import { rankMenteesForMentor } from "../src/matching/score";
import { duplicateSkill, MenteeProfileInput, MentorProfileInput } from "../src/users/profileSchemas";
import {
  checkAdminChange,
  initialStatus,
  menteeComplete,
  mentorComplete,
  parseAdminEmails,
  resolveRole,
} from "../src/users/roles";
import { mentee, mentees, mentor } from "./helpers";

describe("admin allow-list", () => {
  const admins = parseAdminEmails(" Boss@Example.com, ops@example.com ,, ");

  it("parses, trims and lower-cases", () => {
    expect([...admins]).toEqual(["boss@example.com", "ops@example.com"]);
  });

  it("promotes listed emails to admin and leaves others unchanged", () => {
    expect(resolveRole("BOSS@example.com", admins, null)).toBe("admin");
    expect(resolveRole("boss@example.com", admins, "student")).toBe("admin");
    expect(resolveRole("someone@example.com", admins, "teacher")).toBe("teacher");
    expect(resolveRole(undefined, admins, null)).toBeNull();
  });
});

describe("initial status", () => {
  it("puts new teachers in pending unless auto-approve is on", () => {
    expect(initialStatus("teacher")).toBe("pending");
    expect(initialStatus("teacher", true)).toBe("active");
    expect(initialStatus("student")).toBe("active");
  });
});

describe("profile completeness", () => {
  it("accepts complete seed profiles", () => {
    expect(menteeComplete(mentee("Aisha Khan"))).toBe(true);
    expect(mentorComplete(mentor("Dr. Priya Raman"))).toBe(true);
  });

  it("rejects missing skills, availability or languages", () => {
    expect(menteeComplete({ ...mentee("Aisha Khan"), goals: [] })).toBe(false);
    expect(mentorComplete({ ...mentor("Dr. Priya Raman"), availability: [] })).toBe(false);
    expect(mentorComplete({ ...mentor("Dr. Priya Raman"), languages: [] })).toBe(false);
    expect(menteeComplete(null)).toBe(false);
  });
});

describe("admin change guard", () => {
  const base = { actorId: "a1", targetId: "t1", targetRole: "student" as const, adminCount: 2 };

  it("allows normal changes", () => {
    expect(checkAdminChange({ ...base, newStatus: "suspended" })).toBeNull();
    expect(checkAdminChange({ ...base, newRole: "teacher" })).toBeNull();
    expect(checkAdminChange({ ...base, deleting: true })).toBeNull();
  });

  it("blocks admins from suspending, demoting or deleting themselves", () => {
    const self = { ...base, targetId: "a1", targetRole: "admin" as const };
    expect(checkAdminChange({ ...self, newStatus: "suspended" })).toMatch(/your own/);
    expect(checkAdminChange({ ...self, newRole: "student" })).toMatch(/your own/);
    expect(checkAdminChange({ ...self, deleting: true })).toMatch(/your own/);
  });

  it("never removes the last admin", () => {
    const lastAdmin = { ...base, targetRole: "admin" as const, adminCount: 1 };
    expect(checkAdminChange({ ...lastAdmin, newRole: "teacher" })).toMatch(/at least one/);
    expect(checkAdminChange({ ...lastAdmin, deleting: true })).toMatch(/at least one/);
    expect(checkAdminChange({ ...lastAdmin, newStatus: "active" })).toBeNull();
  });
});

describe("profile schemas", () => {
  const validMentee = {
    name: "New Student",
    industry: "Software",
    city: "Pune",
    timezone_offset: 5.5,
    languages: ["English"],
    format: "remote",
    availability: ["weekday_evening"],
    goal_summary: "I want to get better at React.",
    career_stage: "Junior",
    desired_min_years: 5,
    goals: [{ name: "React", priority: 3 }],
  };

  it("accepts a valid student profile and coerces numbers", () => {
    const parsed = MenteeProfileInput.parse({ ...validMentee, desired_min_years: "5" });
    expect(parsed.desired_min_years).toBe(5);
  });

  it("rejects bad slots, empty goals and out-of-range values", () => {
    expect(() => MenteeProfileInput.parse({ ...validMentee, availability: ["midnight"] })).toThrow();
    expect(() => MenteeProfileInput.parse({ ...validMentee, goals: [] })).toThrow(/at least one goal skill/);
    expect(() => MenteeProfileInput.parse({ ...validMentee, timezone_offset: 20 })).toThrow();
    expect(() => MenteeProfileInput.parse({ ...validMentee, goals: [{ name: "React", priority: 9 }] })).toThrow();
  });

  it("rejects a teacher profile without skills", () => {
    expect(() =>
      MentorProfileInput.parse({
        ...validMentee,
        headline: "Engineer",
        bio: "Ten years of building web apps.",
        years_experience: 10,
        skills: [],
      }),
    ).toThrow(/at least one skill/);
  });

  it("detects duplicate skills case-insensitively", () => {
    expect(duplicateSkill(["React", "Testing", "react"])).toBe("react");
    expect(duplicateSkill(["React", "Testing"])).toBeNull();
  });
});

describe("reverse ranking for teachers", () => {
  it("ranks Aisha first for Dr. Priya Raman, with the same score as the student view", () => {
    const results = rankMenteesForMentor(mentor("Dr. Priya Raman"), mentees, 5);
    expect(results[0].menteeName).toBe("Aisha Khan");
    expect(results[0].score).toBe(98);
    expect(results[0].reasons.length).toBeGreaterThanOrEqual(2);
  });

  it("is deterministic and limited", () => {
    const a = rankMenteesForMentor(mentor("Marcus Bell"), mentees, 5);
    const b = rankMenteesForMentor(mentor("Marcus Bell"), [...mentees].reverse(), 5);
    expect(a).toEqual(b);
    expect(a).toHaveLength(5);
  });
});

describe("role guard middleware", () => {
  it("returns 403 for the wrong role and passes the right one", async () => {
    vi.mock("../src/lib/firebaseAdmin", () => ({ adminAuth: vi.fn(), adminDb: vi.fn() }));
    const { requireRole, requireActive } = await import("../src/middleware/auth");
    const run = (mw: (...a: never[]) => void, appUser: unknown) => {
      let err: unknown = "not-called";
      mw({ appUser } as never, {} as never, ((e?: unknown) => (err = e)) as never);
      return err as { status?: number; code?: string } | undefined;
    };
    expect(run(requireRole("admin"), { role: "student", status: "active" })?.status).toBe(403);
    expect(run(requireRole("admin"), { role: "admin", status: "active" })).toBeUndefined();
    expect(run(requireRole("student"), { role: null, status: "active" })?.code).toBe("role_required");
    expect(run(requireActive, { role: "student", status: "suspended" })?.code).toBe("suspended");
    expect(run(requireActive, { role: "teacher", status: "pending" })).toBeUndefined();
  });
});
