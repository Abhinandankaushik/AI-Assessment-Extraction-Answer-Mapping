export type UploadKind = "question" | "answer";

export type Phase = "upload" | "extracting" | "mapping" | "error";

export interface UploadedFile {
  id: string;
  kind: UploadKind;
  name: string;
  size: number;
  mime: string;
  pageCount: number;
  isPdf: boolean;
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

/** One "(a)"/"(b)" section of a written answer, with its own tight region. */
export interface AnswerPart {
  marker: string;
  transcription: string;
  regions: AnswerRegion[];
}

export interface AnswerBlock {
  id: string;
  /** The question number the student wrote next to the answer, if any. */
  labelOnSheet: string | null;
  /** The same number as the extraction reported it in a field of its own, kept
   *  only when it disagrees with the one read out of the transcription. The
   *  mapper falls back to it when the first names no question the paper prints:
   *  one of the two readings is a misread, and the paper says which. */
  labelReported?: string;
  transcription: string;
  regions: AnswerRegion[];
  continuesFromPrevPage: boolean;
  /** Sections the student marked inside this one answer. They only become
   *  separate blocks when the paper prints a sub-question for each of them -
   *  see materialiseParts. */
  parts?: AnswerPart[];
  /** Shared by the parts of one written answer that were split apart, so
   *  mapping can match the group once and then hand each part to its own
   *  sub-question. */
  groupId?: string;
  /** The sub-part this block opens with, when it is one part of a group. */
  partMarker?: string | null;
}

export type MatchBasis = "label" | "none";
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
