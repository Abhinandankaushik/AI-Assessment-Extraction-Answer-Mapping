"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { MappingScreen } from "@/components/mapping/MappingScreen";
import { rasterize } from "@/lib/pdf";
import { useAppStore } from "@/lib/store";
import type {
  AnswerBlock,
  ExtractedQuestion,
  QuestionResult,
} from "@/lib/types";

/**
 * Dev harness only. Renders the real sample answer sheet with a hand-authored
 * result set so the mapping UI — highlighting, multi-page answers, unanswered
 * questions, orphans — can be exercised without spending API quota.
 * Bounding boxes here are approximate; a real run gets them from the model.
 */
const QUESTIONS: ExtractedQuestion[] = [
  ["q1", "1", "Hard water contains dissolved salts of which of the following pairs of metals?", 1],
  ["q2", "2", "Which of the following correctly represents the formation of magnesium oxide by transfer of electrons?", 1],
  ["q3", "3", "An ionic solid is found to have an unusually low melting point. Which statement best explains this observation?", 1],
  ["q4", "4", "What is observed when dilute hydrochloric acid is added to sodium hydroxide solution?", 1],
  ["q21", "21", "An object is placed 10 cm in front of a concave mirror of focal length 15 cm. Using the mirror formula, find the position of the image formed.", 2],
  ["q22a", "22 (a)", "Lamp A is rated 50 W, 220 V and Lamp B is rated 25 W, 220 V. Calculate the ratio of their resistances RA : RB.", 2],
  ["q22b", "22 (b)", "If Lamp A and Lamp B are now connected in series across a 220 V supply, which lamp will glow brighter? Give a reason.", 2],
  ["q24a", "24 (a)", "State any two structural differences between arteries and veins.", 2],
].map(([id, displayNumber, text, marks], index) => ({
  id: id as string,
  displayNumber: displayNumber as string,
  parentNumber: String(displayNumber).split(" ")[0],
  subLabel: String(displayNumber).includes("(")
    ? String(displayNumber).replace(/.*\(([a-z])\).*/, "$1")
    : null,
  text: text as string,
  marks: marks as number,
  page: 1,
  orderIndex: index,
}));

const box = (page: number, y: number, h: number, w = 0.74) => ({
  page,
  box: { x: 0.12, y, w, h },
});

const BLOCKS: AnswerBlock[] = [
  { id: "b1", labelOnSheet: "Q.1)", transcription: "(B) Calcium and Magnesium", regions: [box(1, 0.245, 0.045)], continuesFromPrevPage: false },
  { id: "b2", labelOnSheet: "Q.2)", transcription: "(A) Mg + :O: -> Mg2+ [:O:2-]", regions: [box(1, 0.318, 0.05)], continuesFromPrevPage: false },
  { id: "b3", labelOnSheet: "Q.3)", transcription: "(C) It has weak electrostatic forces of attraction between its oppositely charged ions", regions: [box(1, 0.408, 0.075, 0.8)], continuesFromPrevPage: false },
  { id: "b4", labelOnSheet: "Q.4)", transcription: "(A) Salt and water is formed", regions: [box(1, 0.53, 0.045)], continuesFromPrevPage: false },
  { id: "b5", labelOnSheet: "Q.21)", transcription: "Given u = -10 cm, f = -15 cm. Mirror formula 1/v + 1/u = 1/f", regions: [box(3, 0.78, 0.14, 0.78)], continuesFromPrevPage: false },
  { id: "b6", labelOnSheet: null, transcription: "=> 1/v = -1/15 + 1/10 => v = +30 cm", regions: [box(4, 0.08, 0.16, 0.6)], continuesFromPrevPage: true },
  { id: "b7", labelOnSheet: "Q.22)(a)", transcription: "Lamp A -> Power = 50 W, Volt = 220 V. P = V^2/R, RA = 968 ohm", regions: [box(4, 0.32, 0.1, 0.66)], continuesFromPrevPage: false },
  { id: "b8", labelOnSheet: "Q.15)", transcription: "Newton's third law states that every action has an equal and opposite reaction.", regions: [box(2, 0.62, 0.07, 0.7)], continuesFromPrevPage: false },
];

const RESULTS: QuestionResult[] = [
  { questionId: "q1", blockIds: ["b1"], matchBasis: "label", confidence: 1, awarded: 1, total: 1, verdict: "correct", feedback: "Correct — hard water owes its hardness to dissolved calcium and magnesium salts." },
  { questionId: "q2", blockIds: ["b2"], matchBasis: "label", confidence: 1, awarded: 1, total: 1, verdict: "correct", feedback: "Right choice, and your electron-dot notation shows the transfer clearly." },
  { questionId: "q3", blockIds: ["b3"], matchBasis: "label", confidence: 1, awarded: 0.5, total: 1, verdict: "partial", feedback: "The reasoning is on the right track but the option chosen does not match a low melting point." },
  { questionId: "q4", blockIds: ["b4"], matchBasis: "label", confidence: 1, awarded: 1, total: 1, verdict: "correct", feedback: "Correct — neutralisation gives salt and water." },
  { questionId: "q21", blockIds: ["b5", "b6"], matchBasis: "label", confidence: 1, awarded: 2, total: 2, verdict: "correct", feedback: "Full marks. The sign convention and substitution are both handled correctly." },
  { questionId: "q22a", blockIds: ["b7"], matchBasis: "label", confidence: 1, awarded: 1, total: 2, verdict: "partial", feedback: "RA is correct, but you stopped before writing the ratio RA : RB." },
  { questionId: "q22b", blockIds: [], matchBasis: "none", confidence: 0, awarded: 0, total: 2, verdict: "unanswered", feedback: "This question was not attempted." },
  { questionId: "q24a", blockIds: [], matchBasis: "none", confidence: 0, awarded: 0, total: 2, verdict: "unanswered", feedback: "This question was not attempted." },
];

export default function DebugMapping() {
  const loadRun = useAppStore((s) => s.loadRun);
  const [status, setStatus] = useState("loading sample sheet…");

  useEffect(() => {
    (async () => {
      const response = await fetch("/samples/class10_science_answer_sheet.pdf");
      const file = new File([await response.blob()], "answers.pdf", {
        type: "application/pdf",
      });
      const answerPages = await rasterize(file, (done, total) =>
        setStatus(`rasterising ${done}/${total}`),
      );
      loadRun({
        answerPages,
        questions: QUESTIONS,
        blocks: BLOCKS,
        results: RESULTS,
        orphanBlockIds: ["b8"],
        summary: {
          awarded: 6.5,
          total: 12,
          answered: 6,
          unanswered: 2,
          unmatched: 1,
          overall:
            "Strong on the objective questions and the mirror-formula derivation. The ratio in 22 (a) was left unfinished, and two questions were not attempted at all.",
        },
      });
      setStatus("");
    })().catch((error) => setStatus(`error: ${error.message}`));
  }, [loadRun]);

  if (status) {
    return <p className="p-6 font-mono text-sm">{status}</p>;
  }

  return (
    <AppShell collapsed variant="mapping">
      <MappingScreen />
    </AppShell>
  );
}
