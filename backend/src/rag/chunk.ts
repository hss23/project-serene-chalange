// Markdown chunker: split on headings, then sub-split long sections on paragraph
// boundaries (~maxChars) with a small overlap so ideas aren't cut mid-thought.

export interface Chunk {
  index: number;
  heading: string; // e.g. "Session formats > Group sessions"
  content: string;
}

export interface ParsedDoc {
  title: string;
  chunks: Chunk[];
}

export function chunkMarkdown(markdown: string, opts: { maxChars?: number; overlap?: number } = {}): ParsedDoc {
  const maxChars = opts.maxChars ?? 800;
  const overlap = opts.overlap ?? 100;
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");

  let title = "";
  const sections: { heading: string; body: string[] }[] = [];
  let h2 = "";
  let current: { heading: string; body: string[] } | null = null;

  for (const line of lines) {
    const m = /^(#{1,3})\s+(.*\S)\s*$/.exec(line);
    if (m) {
      const level = m[1].length;
      const text = m[2];
      if (level === 1 && !title) {
        title = text;
        continue;
      }
      if (level <= 2) h2 = text;
      current = { heading: level === 3 && h2 ? `${h2} > ${text}` : text, body: [] };
      sections.push(current);
      continue;
    }
    if (!current) {
      current = { heading: "Overview", body: [] };
      sections.push(current);
    }
    current.body.push(line);
  }

  const chunks: Chunk[] = [];
  for (const s of sections) {
    const text = s.body.join("\n").trim();
    if (!text) continue;
    for (const piece of splitText(text, maxChars, overlap)) {
      chunks.push({ index: chunks.length, heading: s.heading, content: piece });
    }
  }
  return { title: title || "Untitled", chunks };
}

function splitText(text: string, maxChars: number, overlap: number): string[] {
  if (text.length <= maxChars) return [text];
  const paras = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  const out: string[] = [];
  let buf = "";
  const push = (s: string) => {
    if (s.trim()) out.push(s.trim());
  };

  for (const p of paras) {
    if (p.length > maxChars) {
      // Very long paragraph: split on sentence boundaries, falling back to a hard character split.
      push(buf);
      buf = "";
      const sentences = p.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) ?? [p];
      for (const s of sentences) {
        if (buf && (buf + s).length > maxChars) {
          push(buf);
          buf = buf.slice(-overlap);
        }
        buf += s;
        while (buf.length > maxChars) {
          push(buf.slice(0, maxChars));
          buf = buf.slice(maxChars - overlap);
        }
      }
      continue;
    }
    if (buf && (buf + "\n\n" + p).length > maxChars) {
      push(buf);
      // Overlap: carry the tail of the previous chunk, starting at a word boundary.
      const tail = buf.slice(-overlap).replace(/^\S*\s/, "");
      buf = tail.length + p.length + 2 <= maxChars ? `${tail}\n\n${p}` : p;
    } else {
      buf = buf ? `${buf}\n\n${p}` : p;
    }
  }
  push(buf);
  return out;
}
