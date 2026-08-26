import fs from "node:fs";
import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";

const apiKey = fs.readFileSync(".env.local", "utf8").match(/GEMINI_API_KEY=(.+)/)[1].trim();
const ai = new GoogleGenAI({ apiKey });
const pdf = fs.readFileSync("public/samples/class10_science_question_paper.pdf").toString("base64");

const schema = {
  type: Type.OBJECT,
  properties: {
    questions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          displayNumber: { type: Type.STRING },
          text: { type: Type.STRING },
          marks: { type: Type.INTEGER, nullable: true },
          page: { type: Type.INTEGER },
        },
        required: ["displayNumber", "text", "page"],
      },
    },
  },
  required: ["questions"],
};

async function run(model, thinking) {
  const t0 = Date.now();
  try {
    const res = await ai.models.generateContent({
      model,
      contents: [{ role: "user", parts: [
        { text: "Extract every question verbatim. Treat labelled sub-parts like 11 (a) and 11 (b) as separate entries." },
        { inlineData: { mimeType: "application/pdf", data: pdf } },
      ]}],
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 0,
        ...(thinking ? { thinkingConfig: { thinkingLevel: thinking } } : {}),
      },
    });
    const n = JSON.parse(res.text).questions.length;
    const u = res.usageMetadata ?? {};
    console.log(`${model.padEnd(20)} think=${String(thinking).padEnd(8)} ${((Date.now()-t0)/1000).toFixed(1)}s  q=${n}  thoughts=${u.thoughtsTokenCount ?? "-"} out=${u.candidatesTokenCount ?? "-"}`);
  } catch (e) {
    console.log(`${model.padEnd(20)} think=${String(thinking).padEnd(8)} FAILED ${((Date.now()-t0)/1000).toFixed(1)}s ${String(e.message).slice(0,90)}`);
  }
}

await run("gemini-3.6-flash", ThinkingLevel.LOW);
await run("gemini-3.6-flash", ThinkingLevel.MEDIUM);
