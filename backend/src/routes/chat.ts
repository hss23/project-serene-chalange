import { Router } from "express";
import { FieldValue, type DocumentReference } from "firebase-admin/firestore";
import { z } from "zod";
import { dbError, supabaseAdmin } from "../lib/supabase";
import { embedQuery, generateAnswer } from "../lib/gemini";
import { adminDb } from "../lib/firebaseAdmin";
import { enforceRateLimit } from "../lib/rateLimit";
import { currentUser } from "../middleware/auth";
import {
  buildPrompt,
  isNotInKb,
  REFUSAL,
  resolveCitations,
  retrievalQuery,
  SYSTEM_INSTRUCTION,
  type RetrievedChunk,
  type Source,
  type Turn,
} from "../rag/prompt";

const Body = z.object({
  sessionId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/, "Invalid chat session id"),
  question: z
    .string()
    .trim()
    .min(1, "Please type a question.")
    .max(1000, "Questions are limited to 1000 characters."),
});

const TOP_K = 5;
const minSimilarity = () => Number(process.env.RAG_MIN_SIMILARITY ?? 0.65);
const hourlyLimit = () => Number(process.env.CHAT_HOURLY_LIMIT ?? 30);

export const chatRouter = Router();

// RAG chatbot: retrieve from pgvector, answer with Gemini using only retrieved context, cite sources.
chatRouter.post("/", async (req, res) => {
  const user = currentUser(req);
  const { sessionId, question } = Body.parse(req.body ?? {});
  await enforceRateLimit(user.uid, "chat", hourlyLimit(), 60 * 60 * 1000);

  // Session path is always derived from the verified uid, so users can't touch others' sessions.
  const sessionRef = adminDb().doc(`users/${user.uid}/chatSessions/${sessionId}`);
  const history = await loadHistory(sessionRef);
  const t0 = Date.now();

  // 1) Retrieve: embed the (context-aware) question and run a pgvector similarity search.
  const embedding = await embedQuery(retrievalQuery(question, history));
  const { data, error } = await supabaseAdmin().rpc("match_kb_chunks", {
    query_embedding: `[${embedding.join(",")}]`,
    match_count: TOP_K,
    min_similarity: minSimilarity(),
  });
  if (error) dbError("match_kb_chunks", error);
  const chunks = (data ?? []) as RetrievedChunk[];
  const tRetrieve = Date.now();

  // 2) Generate: only when something relevant was retrieved; otherwise refuse without calling the LLM.
  let answer = REFUSAL;
  let sources: Source[] = [];
  let supported = false;
  if (chunks.length > 0) {
    const raw = await generateAnswer(SYSTEM_INSTRUCTION, buildPrompt(question, chunks, history));
    if (!isNotInKb(raw)) {
      const resolved = resolveCitations(raw, chunks);
      answer = resolved.answer;
      sources = resolved.sources;
      supported = sources.length > 0;
    }
  }
  console.info(
    `[chat] retrieved=${chunks.length} top=${chunks[0]?.similarity.toFixed(3) ?? "-"} supported=${supported} retrieveMs=${tRetrieve - t0} generateMs=${Date.now() - tRetrieve}`,
  );

  // 3) Persist to Firestore (best effort: the user still gets the answer if this fails).
  let saved = true;
  try {
    const batch = adminDb().batch();
    const messages = sessionRef.collection("messages");
    const now = Date.now();
    batch.set(
      sessionRef,
      {
        updatedAt: FieldValue.serverTimestamp(),
        ...(history.length === 0 ? { title: question.slice(0, 60), createdAt: FieldValue.serverTimestamp() } : {}),
      },
      { merge: true },
    );
    batch.set(messages.doc(), { role: "user", text: question, order: now, createdAt: FieldValue.serverTimestamp() });
    batch.set(messages.doc(), {
      role: "assistant",
      text: answer,
      sources,
      supported,
      order: now + 1,
      createdAt: FieldValue.serverTimestamp(),
    });
    await batch.commit();
  } catch (err) {
    saved = false;
    console.error("[chat] failed to save messages", err);
  }

  res.json({ answer, sources, supported, saved, retrieved: chunks.length });
});

async function loadHistory(sessionRef: DocumentReference): Promise<Turn[]> {
  try {
    const snap = await sessionRef.collection("messages").orderBy("order", "desc").limit(6).get();
    return snap.docs
      .map((d) => d.data() as { role: Turn["role"]; text: string })
      .reverse()
      .map((m) => ({ role: m.role, text: m.text }));
  } catch (err) {
    console.error("[chat] failed to load history", err);
    return [];
  }
}
