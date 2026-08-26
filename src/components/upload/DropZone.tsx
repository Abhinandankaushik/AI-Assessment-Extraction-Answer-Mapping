"use client";

import { Upload, X } from "lucide-react";
import { useId, useRef, useState } from "react";
import { formatBytes, plural } from "@/lib/format";
import type { UploadKind, UploadedFile } from "@/lib/types";
import { PdfIcon } from "./PdfIcon";

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = "application/pdf,image/png,image/jpeg,image/webp";

export function DropZone({
  kind,
  label,
  file,
  onSelect,
  onRemove,
}: {
  kind: UploadKind;
  label: string;
  file: UploadedFile | null;
  onSelect: (file: File, kind: UploadKind) => void;
  onRemove: (kind: UploadKind) => void;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function accept(picked: File | undefined) {
    if (!picked) return;
    if (picked.size > MAX_BYTES) {
      setError("File is larger than 10MB");
      return;
    }
    if (!ACCEPT.split(",").includes(picked.type) && !/\.pdf$/i.test(picked.name)) {
      setError("Upload a PDF or an image");
      return;
    }
    setError(null);
    onSelect(picked, kind);
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        accept(e.dataTransfer.files[0]);
      }}
      className={`relative grid h-[127px] flex-none place-items-center rounded-drop border-[1.5px] border-dashed bg-surface px-2.5 py-4 transition-colors md:h-[181px] md:flex-1 md:p-2.5 ${
        dragging ? "border-brand bg-brand/5" : "border-hairline"
      }`}
    >
      {file ? (
        <div className="relative flex max-w-full items-center gap-3 rounded-card bg-surface-2 px-4 py-3">
          <PdfIcon />
          <div className="min-w-0">
            <p className="t-p3-bold truncate text-dark">{file.name}</p>
            {/* Centred under the filename, as in the filled-state frame. */}
            <p className="t-meta text-center text-muted/55">
              {formatBytes(file.size)} &nbsp;•&nbsp; {plural(file.pageCount, "Page")}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onRemove(kind)}
            aria-label={`Remove ${label}`}
            className="absolute -top-2.5 -right-2.5 grid size-7 place-items-center rounded-full bg-ink text-white transition-transform hover:scale-110"
          >
            <X size={15} strokeWidth={2.4} />
          </button>
        </div>
      ) : (
        <>
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept={ACCEPT}
            className="sr-only"
            onChange={(e) => {
              accept(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <label
            htmlFor={inputId}
            className="flex cursor-pointer flex-col items-center gap-1 md:gap-2.5"
          >
            <span className="grid size-10 place-items-center rounded-[7px] bg-[#F3F3F3] text-ink md:size-12 md:rounded-lg">
              <Upload className="size-[27px] md:size-8" strokeWidth={1.8} />
            </span>
            <span className="text-[18px] leading-[1.4] font-bold tracking-[-0.04em] text-dark md:text-[20px] md:leading-[22px] md:font-semibold md:tracking-[-0.06em]">
              Upload <span className="text-brand">{label}</span>
            </span>
            <span className="t-meta text-muted/55">
              {error ?? "Max 10MB"}
            </span>
          </label>
        </>
      )}
    </div>
  );
}
