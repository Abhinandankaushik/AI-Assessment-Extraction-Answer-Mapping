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
    <div className="grid h-full place-items-center overflow-y-auto px-4 py-4">
      <div className="flex w-full max-w-[789px] flex-col items-center">
        {/* Hero column: Figma stacks heading, subtitle, artwork and the
            drop-zone card on a uniform 20px rhythm. */}
        <div className="flex w-full flex-col items-center gap-5">
          <h1 className="t-h1 text-center">
            <span className="text-dark">Upload </span>
            <span className="rounded-lg bg-[#FFDECB] px-1.5 text-brand">
              Question Paper &amp; Answer Sheets
            </span>
          </h1>
          <p className="t-p1 text-center text-ink">
            Upload both files to get started
          </p>

          <HeroIllustration />

          <div className="flex h-[205px] w-full gap-4 rounded-[24px] bg-white/50 p-3">
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
          className="mt-10"
          disabled={!ready}
          onClick={() => setPhase("extracting")}
        >
          Start Mapping
          <ArrowRight size={16} />
        </PrimaryButton>

        <p className="t-p5 mt-4 text-center text-muted/70">
          Once both files are uploaded, you&rsquo;ll be able to map answers with
          questions
        </p>
      </div>
    </div>
  );
}
