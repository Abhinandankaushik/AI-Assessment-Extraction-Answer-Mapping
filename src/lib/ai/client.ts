import { GoogleGenAI, ThinkingLevel } from "@google/genai";

export const MODEL = process.env.GEMINI_MODEL ?? "gemini-3.6-flash";

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

export { ThinkingLevel };

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
  retries?: number;
  /** Transcription needs little deliberation; mapping and grading need more. */
  thinking?: ThinkingLevel;
}

/** Every call goes through here so structured output, retries and the
 *  deterministic temperature are applied consistently across the pipeline. */
export async function generateJson<T>({
  system,
  prompt,
  images = [],
  schema,
  temperature = 0,
  retries = 2,
  thinking = ThinkingLevel.LOW,
}: GenerateOptions): Promise<T> {
  const parts = [
    { text: prompt },
    ...images.map(({ mimeType, data }) => ({ inlineData: { mimeType, data } })),
  ];

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await ai().models.generateContent({
        model: MODEL,
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
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 700 * (attempt + 1)));
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
