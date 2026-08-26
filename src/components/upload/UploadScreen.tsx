"use client";

import { ArrowRight } from "lucide-react";
import { useCallback } from "react";
import { countPages, isPdf } from "@/lib/pdf";
import { useAppStore } from "@/lib/store";
import type { UploadKind, UploadedFile } from "@/lib/types";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { DropZone } from "./DropZone";
import { HeroIllustration } from "./HeroIllustration";

/** Photographed pages arrive as page1.jpg, page2.jpg, page10.jpg — plain
 *  alphabetical sorting would place 10 before 2, so compare numerically. */
const byPageOrder = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

export function UploadScreen() {
  const { files, addFiles, removeFile, clearSlot, setPhase } = useAppStore();
  const ready = files.question.length > 0 && files.answer.length > 0;

  const handleSelect = useCallback(
    async (picked: File[], kind: UploadKind) => {
      const ordered = [...picked].sort((a, b) =>
        byPageOrder.compare(a.name, b.name),
      );
      const described: UploadedFile[] = await Promise.all(
        ordered.map(async (file) => ({
          id: `${kind}-${file.name}-${file.size}-${file.lastModified}`,
          kind,
          name: file.name,
          size: file.size,
          mime: file.type,
          pageCount: await countPages(file).catch(() => 1),
          isPdf: isPdf(file),
          file,
        })),
      );
      addFiles(kind, described);
    },
    [addFiles],
  );

  return (
    <div className="grid h-full place-items-center overflow-y-auto px-2.5 pb-6 md:px-4 md:py-4">
      <div className="flex w-full max-w-[789px] flex-col items-center">
        <div className="flex w-full flex-col items-center gap-5">
          {/* Phone frames use a single dark 24px line; the desktop frame splits
              the headline and highlights the second half. */}
          <h1 className="text-center text-[24px] leading-[1.2] font-bold tracking-[-0.04em] text-dark md:text-[40px]">
            Upload{" "}
            <span className="md:rounded-lg md:bg-[#FFDECB] md:px-1.5 md:text-brand">
              Question Paper &amp; Answer Sheets
            </span>
          </h1>
          <p className="t-p1 hidden text-center text-ink md:block">
            Upload both files to get started
          </p>

          <HeroIllustration />

          <div className="flex w-full flex-col gap-3 rounded-[24px] bg-white/50 p-3 md:h-[205px] md:flex-row md:gap-4">
            <DropZone
              kind="question"
              label="Question Paper"
              files={files.question}
              onSelect={handleSelect}
              onRemove={removeFile}
              onClear={clearSlot}
            />
            <DropZone
              kind="answer"
              label="Answer Sheet"
              files={files.answer}
              onSelect={handleSelect}
              onRemove={removeFile}
              onClear={clearSlot}
            />
          </div>
        </div>

        <PrimaryButton
          className="mt-8 md:mt-10"
          disabled={!ready}
          onClick={() => setPhase("extracting")}
        >
          Start Mapping
          <ArrowRight size={16} />
        </PrimaryButton>

        <p className="t-p5 mt-4 max-w-[320px] text-center text-muted/70 md:max-w-none">
          Once both files are uploaded, you&rsquo;ll be able to map answers with
          questions
        </p>
      </div>
    </div>
  );
}
