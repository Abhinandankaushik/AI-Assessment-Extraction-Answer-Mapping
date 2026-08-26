"use client";

import { ArrowRight } from "lucide-react";
import { useCallback } from "react";
import { countPages } from "@/lib/pdf";
import { useAppStore } from "@/lib/store";
import type { UploadKind } from "@/lib/types";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { DropZone } from "./DropZone";
import { HeroIllustration } from "./HeroIllustration";

export function UploadScreen() {
  const { files, setFile, removeFile, setPhase } = useAppStore();
  const ready = Boolean(files.question && files.answer);

  const handleSelect = useCallback(
    async (picked: File, kind: UploadKind) => {
      const pageCount = await countPages(picked).catch(() => 1);
      setFile({
        id: `${kind}-${picked.name}-${picked.lastModified}`,
        kind,
        name: picked.name,
        size: picked.size,
        mime: picked.type,
        pageCount,
        file: picked,
      });
    },
    [setFile],
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
              file={files.question}
              onSelect={handleSelect}
              onRemove={removeFile}
            />
            <DropZone
              kind="answer"
              label="Answer Sheet"
              file={files.answer}
              onSelect={handleSelect}
              onRemove={removeFile}
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
