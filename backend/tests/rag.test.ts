import { describe, expect, it } from "vitest";
import { chunkMarkdown } from "../src/rag/chunk";
import { buildPrompt, isNotInKb, resolveCitations, retrievalQuery, type RetrievedChunk, type Turn } from "../src/rag/prompt";

describe("chunkMarkdown", () => {
  it("extracts title and splits on headings", () => {
    const doc = chunkMarkdown("# Handbook\n\n## Intro\nHello.\n\n## Sessions\n### Group\nGroups of 4.\n");
    expect(doc.title).toBe("Handbook");
    expect(doc.chunks.map((c) => c.heading)).toEqual(["Intro", "Sessions > Group"]);
  });

  it("sub-splits long sections within the size limit", () => {
    const para = "This is a sentence about mentoring. ".repeat(20).trim();
    const doc = chunkMarkdown(`# T\n\n## Long\n${[para, para, para, para].join("\n\n")}`, { maxChars: 800, overlap: 100 });
    expect(doc.chunks.length).toBeGreaterThan(1);
    for (const c of doc.chunks) expect(c.content.length).toBeLessThanOrEqual(800);
    expect(doc.chunks.every((c) => c.heading === "Long")).toBe(true);
  });

  it("hard-splits a single huge paragraph without sentence breaks", () => {
    const doc = chunkMarkdown(`# T\n\n## X\n${"a".repeat(3000)}`, { maxChars: 800, overlap: 100 });
    expect(doc.chunks.length).toBeGreaterThan(3);
    for (const c of doc.chunks) expect(c.content.length).toBeLessThanOrEqual(800);
  });

  it("skips empty sections and handles text before the first heading", () => {
    const doc = chunkMarkdown("Intro text\n\n## Empty\n\n## Full\nBody");
    expect(doc.title).toBe("Untitled");
    expect(doc.chunks.map((c) => c.heading)).toEqual(["Overview", "Full"]);
  });
});

const chunks: RetrievedChunk[] = [
  { id: 1, title: "Handbook", slug: "handbook", heading: "Intro", content: "A", similarity: 0.81234 },
  { id: 2, title: "FAQ", slug: "faq", heading: "Q", content: "B", similarity: 0.7 },
];

describe("resolveCitations", () => {
  it("keeps valid citations and drops non-existent ones", () => {
    const r = resolveCitations("Yes [1]. Also [3]. And [2, 9].", chunks);
    expect(r.answer).toBe("Yes [1]. Also . And [2].");
    expect(r.sources.map((s) => s.n)).toEqual([1, 2]);
    expect(r.sources[0].similarity).toBe(0.81);
  });

  it("returns no sources when nothing is cited", () => {
    expect(resolveCitations("No citations", chunks).sources).toEqual([]);
  });
});

describe("prompt helpers", () => {
  it("detects the NOT_IN_KB sentinel", () => {
    expect(isNotInKb("NOT_IN_KB")).toBe(true);
    expect(isNotInKb("  NOT_IN_KB.")).toBe(true);
    expect(isNotInKb("The programme lasts 12 weeks [1].")).toBe(false);
  });

  it("numbers passages and keeps only the last 4 turns", () => {
    const history: Turn[] = Array.from({ length: 10 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", text: `turn-${i}` }));
    const p = buildPrompt("How long?", chunks, history);
    expect(p).toContain("[1] Handbook — Intro");
    expect(p).toContain("[2] FAQ — Q");
    expect(p).not.toContain("turn-5");
    expect(p).toContain("turn-9");
  });

  it("adds the previous user question to short follow-ups for retrieval", () => {
    expect(retrievalQuery("and for mentors?", [{ role: "user", text: "How long is a session?" }])).toBe(
      "How long is a session?\nand for mentors?",
    );
    expect(retrievalQuery("standalone question")).toBe("standalone question");
  });

  it("does not merge history into unrelated standalone questions", () => {
    const history: Turn[] = [{ role: "user", text: "How long does a mentorship cycle last?" }];
    expect(retrievalQuery("What is the capital of France?", history)).toBe("What is the capital of France?");
    expect(retrievalQuery("and can we continue after that?", history)).toBe(
      "How long does a mentorship cycle last?\nand can we continue after that?",
    );
  });
});
