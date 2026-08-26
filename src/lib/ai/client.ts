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
}

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
    ...images.map(({ mimeType, data }) => ({ inlineData: { mimeType, data } })),
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
            thinkingConfig: { thinkingLevel: thinking },
          },
        });
        const text = response.text;
        if (!text) throw new Error("The model returned an empty response");
        return JSON.parse(text) as T;
      } catch (error) {
        lastError = error;
        if (isRetryableAcrossModels(error)) break; // straight to the next model
        if (attempt === 0) await new Promise((r) => setTimeout(r, 700));
      }
    }
  }

  if (isRetryableAcrossModels(lastError)) throw new QuotaExhaustedError();
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
