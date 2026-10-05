// Gemini wrapper: embeddings + chat, with typed errors for quota/availability.
// Runs only in the backend; GEMINI_API_KEY never leaves the server.
import { ApiError, GoogleGenAI, ThinkingLevel } from "@google/genai";

export const EMBEDDING_DIMS = 768;
export const embeddingModel = () => process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-2";
export const chatModel = () => process.env.GEMINI_CHAT_MODEL || "gemini-3.5-flash";
// Used when the primary model is overloaded (503/504) or times out. Set to "none" to disable.
export const fallbackModel = () => process.env.GEMINI_FALLBACK_MODEL || "gemini-3.5-flash-lite";
// Grounded Q&A over a few short passages needs little reasoning. Measured: MINIMAL answers in about 1.5s,
// while the default/LOW levels took about 11s on gemini-3.5-flash with the same answer quality.
const thinkingLevel = () => (process.env.GEMINI_THINKING_LEVEL || "MINIMAL").toUpperCase() as ThinkingLevel;
const GENERATE_TIMEOUT_MS = 10_000; // API minimum is 10s; MINIMAL usually answers in ~1.5s, so fail over to the fallback quickly

export class AiError extends Error {}
export class QuotaError extends AiError {
  constructor() {
    super("The AI service's free-tier quota is used up right now. Please try again in a minute.");
  }
}

let client: GoogleGenAI | undefined;
function ai(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new AiError("The AI service is not configured on the server.");
  client ??= new GoogleGenAI({ apiKey, httpOptions: { timeout: 20_000 } });
  return client;
}

function mapError(err: unknown): never {
  if (err instanceof AiError) throw err;
  const status = err instanceof ApiError ? err.status : undefined;
  const msg = err instanceof Error ? err.message : String(err);
  if (status === 429 || /RESOURCE_EXHAUSTED|quota/i.test(msg)) throw new QuotaError();
  console.error("[gemini]", status, msg);
  if (status === 400 && /API key/i.test(msg)) throw new AiError("The AI service is misconfigured (invalid API key).");
  if (status === 503) throw new AiError("The AI model is busy right now (high demand). Please try again in a moment.");
  if (/abort|timeout|timed out/i.test(msg)) throw new AiError("The AI service took too long to respond. Please try again.");
  throw new AiError("The AI service is temporarily unavailable. Please try again.");
}

/** Overload/timeout errors are worth retrying on another model; auth, quota and bad-request errors are not. */
function isTransient(err: unknown): boolean {
  if (err instanceof ApiError) return err.status === 500 || err.status === 503 || err.status === 504;
  return /abort|timeout|timed out|fetch failed/i.test(err instanceof Error ? err.message : String(err));
}

function checkDims(values: number[] | undefined): number[] {
  if (!values || values.length !== EMBEDDING_DIMS) {
    throw new AiError(`Unexpected embedding size ${values?.length ?? 0} (expected ${EMBEDDING_DIMS}).`);
  }
  return values;
}

// gemini-embedding-2 takes task instructions inside the text rather than a taskType parameter.
const queryText = (q: string) => `task: search result | query: ${q}`;
const docText = (title: string, text: string) => `title: ${title || "none"} | text: ${text}`;

// Small per-instance LRU so repeated questions don't spend embedding quota.
const queryCache = new Map<string, number[]>();
const CACHE_MAX = 200;

export async function embedQuery(question: string): Promise<number[]> {
  const key = question.trim().toLowerCase();
  const hit = queryCache.get(key);
  if (hit) {
    queryCache.delete(key);
    queryCache.set(key, hit);
    return hit;
  }
  try {
    const res = await ai().models.embedContent({
      model: embeddingModel(),
      contents: [{ parts: [{ text: queryText(question) }] }],
      config: { outputDimensionality: EMBEDDING_DIMS },
    });
    const values = checkDims(res.embeddings?.[0]?.values);
    queryCache.set(key, values);
    if (queryCache.size > CACHE_MAX) queryCache.delete(queryCache.keys().next().value!);
    return values;
  } catch (err) {
    mapError(err);
  }
}

/** Embed documents in one call; each item is wrapped in its own Content so we get one vector per item. */
export async function embedDocuments(items: { title: string; text: string }[]): Promise<number[][]> {
  try {
    const res = await ai().models.embedContent({
      model: embeddingModel(),
      contents: items.map((i) => ({ parts: [{ text: docText(i.title, i.text) }] })),
      config: { outputDimensionality: EMBEDDING_DIMS },
    });
    const out = (res.embeddings ?? []).map((e) => checkDims(e.values));
    if (out.length !== items.length) throw new AiError(`Expected ${items.length} embeddings, got ${out.length}.`);
    return out;
  } catch (err) {
    mapError(err);
  }
}

export async function generateAnswer(systemInstruction: string, prompt: string): Promise<string> {
  const fallback = fallbackModel();
  const models = [chatModel(), ...(fallback && fallback !== "none" && fallback !== chatModel() ? [fallback] : [])];
  try {
    let res: Awaited<ReturnType<GoogleGenAI["models"]["generateContent"]>> | undefined;
    for (let i = 0; i < models.length; i++) {
      try {
        res = await ai().models.generateContent({
          model: models[i],
          contents: prompt,
          config: {
            systemInstruction,
            temperature: 0.2,
            maxOutputTokens: 2048,
            thinkingConfig: { thinkingLevel: thinkingLevel() },
            httpOptions: { timeout: GENERATE_TIMEOUT_MS },
          },
        });
        break;
      } catch (err) {
        if (i < models.length - 1 && isTransient(err)) {
          console.warn(`[gemini] ${models[i]} unavailable, falling back to ${models[i + 1]}`);
          continue;
        }
        throw err;
      }
    }
    const text = res?.text?.trim();
    if (!text) {
      const reason = res?.promptFeedback?.blockReason ?? res?.candidates?.[0]?.finishReason;
      throw new AiError(
        reason ? `The AI declined to answer this question (${reason}). Try rephrasing.` : "The AI returned an empty answer. Please try again.",
      );
    }
    return text;
  } catch (err) {
    mapError(err);
  }
}
