import { describe, expect, it } from "vitest";
import { rankMentors, scoreMatch, timezoneDiff, WEIGHTS, type MenteeProfile } from "../src/matching/score";
import { mentee, mentees, mentor, mentors } from "./helpers";

describe("weights", () => {
  it("sum to 1", () => {
    expect(Object.values(WEIGHTS).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
  });
});

describe("timezoneDiff", () => {
  it("handles half-hour offsets", () => expect(timezoneDiff(5.5, 0)).toBe(5.5));
  it("wraps around the date line", () => expect(timezoneDiff(12, -11)).toBe(1));
  it("is symmetric", () => expect(timezoneDiff(-8, 9)).toBe(timezoneDiff(9, -8)));
});

describe("scoreMatch", () => {
  it("returns scores within 0..100 and at least two reasons for every pair", () => {
    for (const me of mentees) {
      for (const mo of mentors) {
        const r = scoreMatch(me, mo);
        expect(r.score).toBeGreaterThanOrEqual(0);
        expect(r.score).toBeLessThanOrEqual(100);
        expect(r.reasons.length).toBeGreaterThanOrEqual(2);
        expect(Number.isNaN(r.score)).toBe(false);
      }
    }
  });

  it("treats empty constraints as neutral instead of dividing by zero", () => {
    const blank: MenteeProfile = { ...mentee("Aisha Khan"), goals: [], availability: [], desired_min_years: 0, languages: [] };
    const r = scoreMatch(blank, mentor("Marcus Bell"));
    expect(Number.isFinite(r.score)).toBe(true);
    const skills = r.breakdown.find((c) => c.key === "skills")!;
    expect(skills.specified).toBe(false);
    expect(skills.score).toBe(1);
  });

  it("gives zero format compatibility for in-person mentor in another city", () => {
    const r = scoreMatch(mentee("Emily Clarke"), mentor("Ivan Horvat"));
    const fmt = r.breakdown.find((c) => c.key === "format")!;
    expect(fmt.score).toBe(0.5); // language only
  });

  it("flags weak matches", () => {
    const r = scoreMatch(mentee("Diego Fernández"), mentor("Lucas Moreau"));
    expect(r.weak).toBe(true);
    expect(r.caveats.length).toBeGreaterThan(0);
  });
});

describe("rankMentors", () => {
  it("returns top 5 sorted by score with stable tie-break", () => {
    for (const me of mentees) {
      const r = rankMentors(me, mentors, 5);
      expect(r).toHaveLength(5);
      for (let i = 1; i < r.length; i++) {
        expect(r[i - 1].score > r[i].score || (r[i - 1].score === r[i].score && r[i - 1].mentorId < r[i].mentorId)).toBe(true);
      }
    }
  });

  it("clamps limit and handles fewer mentors than limit", () => {
    expect(rankMentors(mentee("Aisha Khan"), mentors.slice(0, 2), 5)).toHaveLength(2);
    expect(rankMentors(mentee("Aisha Khan"), mentors, 100)).toHaveLength(10);
    expect(rankMentors(mentee("Aisha Khan"), [], 5)).toEqual([]);
  });
});
