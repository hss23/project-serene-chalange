import { MENTEES, MENTORS } from "../data/seed-data";
import type { MenteeProfile, MentorProfile } from "../src/matching/score";

export const mentors: MentorProfile[] = MENTORS.map(({ skills, ...m }) => ({
  ...m,
  skills: Object.entries(skills).map(([name, proficiency]) => ({ name, proficiency })),
}));

export const mentees: MenteeProfile[] = MENTEES.map(({ goals, ...m }) => ({
  ...m,
  goals: Object.entries(goals).map(([name, priority]) => ({ name, priority })),
}));

export const mentee = (name: string) => mentees.find((m) => m.name === name)!;
export const mentor = (name: string) => mentors.find((m) => m.name === name)!;
