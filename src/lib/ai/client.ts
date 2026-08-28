import { GoogleGenAI, ThinkingLevel } from "@google/genai";

export { ThinkingLevel };

/**
 * Free-tier quota is per-model-per-day (20 requests on some models), so a
 * single model is not enough to keep a public demo alive. Each model has its
 * own bucket; on a quota or overload error we roll to the next one.
 */
export const MODELS: string[] = (
  process.env.GEMINI_MODELS ??
  "gemini-3.5-flash,gemini-3.6-flash,gemini-3-flash-preview,gemini-3.1-flash-lite"
)
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);

let client: GoogleGenAI | null = null;

function ai(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is missing. Copy .env.example to .env.local and add your key.",
    );
  }
  client ??= new GoogleGenAI({ apiKey });
  return client;
}

export interface ImagePart {
  mimeType: string;
  /** Base64 payload without the data-url prefix. */
  data: string;
  /** Text placed immediately before this image, naming it. Several scans of the
   *  same ruled notebook are near-identical, and a model asked afterwards which
   *  page a block came from has to count images to answer — which it gets
   *  wrong. A caption next to each one makes that a local fact instead. */
  label?: string;
}

/**
 * Reasoning tokens are spent from the same budget as the answer, so leaving
 * this at the API default let a page of dense handwriting exhaust it and the
 * JSON was cut off mid-string. Comfortably inside every flash model's ceiling.
 */
const MAX_OUTPUT_TOKENS = Number(process.env.GEMINI_MAX_OUTPUT_TOKENS ?? 32768);

interface GenerateOptions {
  system: string;
  prompt: string;
  images?: ImagePart[];
  schema: object;
  temperature?: number;
  /** Transcription needs little deliberation; mapping and grading need more. */
  thinking?: ThinkingLevel;
}

function isRetryableAcrossModels(error: unknown): boolean {
  const text = error instanceof Error ? error.message : String(error);
  return /\b(429|503|500)\b|quota|exhausted|overloaded|high demand/i.test(text);
}

/**
 * The reply ran out of room before the JSON closed. Worth telling apart from a
 * malformed reply: retrying the same request at temperature 0 reproduces it
 * exactly, so the caller has to send less rather than ask again.
 */
export class ResponseTruncatedError extends Error {
  constructor(detail = "") {
    super(
      `The model's reply was cut off before its JSON was complete${detail ? ` (${detail})` : ""}.`,
    );
    this.name = "ResponseTruncatedError";
  }
}

export class QuotaExhaustedError extends Error {
  constructor() {
    super(
      "All configured Gemini models have hit their free-tier quota. Try again later or add another key.",
    );
    this.name = "QuotaExhaustedError";
  }
}

/** Every call goes through here so structured output, model fallback and the
 *  deterministic temperature are applied consistently across the pipeline. */
export async function generateJson<T>({
  system,
  prompt,
  images = [],
  schema,
  temperature = 0,
  thinking = ThinkingLevel.LOW,
}: GenerateOptions): Promise<T> {
  const parts = [
    { text: prompt },
    ...images.flatMap(({ mimeType, data, label }) => [
      ...(label ? [{ text: label }] : []),
      { inlineData: { mimeType, data } },
    ]),
  ];

  let lastError: unknown;
  for (const model of MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await ai().models.generateContent({
          model,
          contents: [{ role: "user", parts }],
          config: {
            systemInstruction: system,
            responseMimeType: "application/json",
            responseSchema: schema,
            temperature,
            maxOutputTokens: MAX_OUTPUT_TOKENS,
            thinkingConfig: { thinkingLevel: thinking },
          },
        });
        const finish = response.candidates?.[0]?.finishReason;
        const text = response.text;
        if (finish === "MAX_TOKENS") throw new ResponseTruncatedError(model);
        if (!text) throw new Error("The model returned an empty response");
        try {
          return JSON.parse(text) as T;
        } catch {
          // Structured output is schema-checked, so at temperature 0 a parse
          // failure means the reply stopped early rather than came out wrong.
          throw new ResponseTruncatedError(model);
        }
      } catch (error) {
        lastError = error;
        // Both of these reproduce exactly on a repeat, so spend the attempt on
        // a different model instead of asking this one the same question twice.
        if (isRetryableAcrossModels(error) || error instanceof ResponseTruncatedError) break;
        if (attempt === 0) await new Promise((r) => setTimeout(r, 700));
      }
    }
  }

  if (isRetryableAcrossModels(lastError)) throw new QuotaExhaustedError();
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
