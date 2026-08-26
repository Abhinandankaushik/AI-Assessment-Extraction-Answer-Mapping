export type UploadKind = "question" | "answer";

export type Phase = "upload" | "extracting" | "mapping" | "error";

export interface UploadedFile {
  id: string;
  kind: UploadKind;
  name: string;
  size: number;
  mime: string;
  pageCount: number;
  file: File;
}

/** A rasterised page, normalised so bounding boxes stay resolution-independent. */
export interface PageImage {
  index: number;
  dataUrl: string;
  width: number;
  height: number;
}

export interface ExtractedQuestion {
  id: string;
  /** Exactly as printed on the paper, e.g. "11(a)". */
  displayNumber: string;
  parentNumber: string | null;
  subLabel: string | null;
  text: string;
  marks: number | null;
  page: number;
  orderIndex: number;
}

/** Normalised to 0..1 against the page it belongs to. */
export interface BBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface AnswerRegion {
  page: number;
  box: BBox;
}

export interface AnswerBlock {
  id: string;
  /** The question number the student wrote next to the answer, if any. */
  labelOnSheet: string | null;
  transcription: string;
  regions: AnswerRegion[];
  continuesFromPrevPage: boolean;
}

export type MatchBasis = "label" | "semantic" | "none";
export type Verdict = "correct" | "partial" | "incorrect" | "unanswered";

export interface QuestionResult {
  questionId: string;
  blockIds: string[];
  matchBasis: MatchBasis;
  confidence: number;
  awarded: number | null;
  total: number | null;
  verdict: Verdict;
  feedback: string;
}

export interface GradingSummary {
  awarded: number;
  total: number;
  answered: number;
  unanswered: number;
  unmatched: number;
  overall: string;
}
