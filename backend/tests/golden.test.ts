// GOLDEN TEST (also documented in README):
// Mentee "Aisha Khan" -> mentor "Dr. Priya Raman" must rank #1.
import { describe, expect, it } from "vitest";
import { rankMentors } from "../src/matching/score";
import { mentee, mentors } from "./helpers";

describe("golden matching case", () => {
  const results = rankMentors(mentee("Aisha Khan"), mentors, 5);

  it("ranks Dr. Priya Raman first for Aisha Khan", () => {
    expect(results[0].mentorName).toBe("Dr. Priya Raman");
    expect(results[0].score).toBe(98);
  });

  it("wins by a clear margin over the next candidate", () => {
    expect(results[0].score - results[1].score).toBeGreaterThanOrEqual(15);
  });

  it("gives human readable reasons", () => {
    expect(results[0].reasons.length).toBeGreaterThanOrEqual(2);
    expect(results[0].reasons[0]).toMatch(/Covers 4 of 4 goal skills/);
  });

  it("is deterministic across runs", () => {
    expect(rankMentors(mentee("Aisha Khan"), mentors, 5)).toEqual(results);
    expect(rankMentors(mentee("Aisha Khan"), [...mentors].reverse(), 5)).toEqual(results);
  });
});
