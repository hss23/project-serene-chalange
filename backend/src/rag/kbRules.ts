// Pure rules for knowledge-base documents (unit tested).
import { z } from "zod";
import { chunkMarkdown } from "./chunk";

export const KB_CONTENT_MIN = 50;
export const KB_CONTENT_MAX = 100_000;

export const KbDocumentInput = z.object({
  title: z
    .string({ error: "Title is required" })
    .trim()
    .min(3, "Title must be at least 3 characters")
    .max(120, "Title must be at most 120 characters"),
  content: z
    .string({ error: "Content is required" })
    .transform((c) => c.replace(/\r\n/g, "\n"))
    .refine((c) => c.trim().length >= KB_CONTENT_MIN, `Content must be at least ${KB_CONTENT_MIN} characters`)
    .refine((c) => c.length <= KB_CONTENT_MAX, `Content must be at most ${KB_CONTENT_MAX.toLocaleString()} characters`)
    .refine((c) => !/\u0000/.test(c), "Content must be plain text (Markdown or .txt)"),
});
export type KbDocumentInput = z.infer<typeof KbDocumentInput>;

/** Returns the chunks a document would produce, or an error if it produces none. */
export function previewChunks(content: string) {
  const { chunks } = chunkMarkdown(content);
  return chunks;
}

/** "Mentor Onboarding: Week 1!" → "mentor-onboarding-week-1" */
export function slugify(title: string): string {
  const slug = title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return slug || "document";
}

/** Append -2, -3… until the slug is unused. */
export function uniqueSlug(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) {
    const candidate = `${base}-${i}`;
    if (!taken.has(candidate)) return candidate;
  }
}
