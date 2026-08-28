"use client";

import { Upload, X } from "lucide-react";
import { useId, useState } from "react";
import { formatBytes, plural } from "@/lib/format";
import type { UploadKind, UploadedFile } from "@/lib/types";
import { PdfIcon } from "./PdfIcon";

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = "application/pdf,image/png,image/jpeg,image/webp";

export function DropZone({
  kind,
  label,
  files,
  onSelect,
  onRemove,
  onClear,
}: {
  kind: UploadKind;
  label: string;
  files: UploadedFile[];
  onSelect: (picked: File[], kind: UploadKind) => void;
  onRemove: (kind: UploadKind, id: string) => void;
  onClear: (kind: UploadKind) => void;
}) {
  const inputId = useId();
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function accept(picked: FileList | null) {
    const list = Array.from(picked ?? []);
    if (list.length === 0) return;

    const oversized = list.find((f) => f.size > MAX_BYTES);
    if (oversized) {
      setError(`${oversized.name} is larger than 10MB`);
      return;
    }
    const wrongType = list.find(
      (f) => !ACCEPT.split(",").includes(f.type) && !/\.pdf$/i.test(f.name),
    );
    if (wrongType) {
      setError("Upload a PDF or images");
      return;
    }
    if (list.filter((f) => /pdf/i.test(f.type)).length > 1) {
      setError("Only one PDF per slot — or several images instead");
      return;
    }

    setError(null);
    onSelect(list, kind);
  }

  const totalPages = files.reduce((sum, f) => sum + f.pageCount, 0);
  const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
  const single = files.length === 1;

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
        accept(e.dataTransfer.files);
      }}
      // Height comes from the card that holds both zones, which flexes with the
      // window; pinning 181px here would fight it and bring the scrollbar back.
      className={`relative grid h-[127px] flex-none place-items-center overflow-hidden rounded-drop border-[1.5px] border-dashed bg-surface px-2.5 py-4 transition-colors md:h-full md:flex-1 md:p-2.5 ${
        dragging ? "border-brand bg-brand/5" : "border-hairline"
      }`}
    >
      {files.length > 0 ? (
        <>
          {single ? (
            // 66px tall, r12, padding 12/20/12/12, gap 12 — read off the frame.
            // The card is capped 20px short of the zone rather than at its full
            // width: the remove button hangs 8px past the corner, and the zone
            // clips its own overflow, so a card grown to the edge by a long
            // filename took the button with it.
            <div className="relative mx-auto flex min-w-0 max-w-[calc(100%-20px)] items-center gap-3 rounded-xl bg-surface-2 py-3 pr-5 pl-3">
              <PdfIcon />
              <div className="min-w-0">
                <p className="t-p3-bold truncate text-dark" title={files[0].name}>
                  {files[0].name}
                </p>
                <p className="t-p5 truncate text-muted/80">
                  {formatBytes(files[0].size)} &nbsp;•&nbsp;{" "}
                  {plural(files[0].pageCount, "Page")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onClear(kind)}
                aria-label={`Remove ${label}`}
                className="absolute -top-2 -right-2 grid size-[26px] place-items-center rounded-full bg-dark/80 text-white shadow-[0_4px_11px_0_rgb(0_0_0/0.25)] transition-transform hover:scale-110"
              >
                <X size={16} strokeWidth={2.2} />
              </button>
            </div>
          ) : (
            // Pinned to the card so the list can never spill past the dashed
            // border: a definite height is what lets the middle pane scroll.
            <div className="absolute inset-0 flex flex-col gap-1.5 p-3">
              <div className="flex shrink-0 items-center justify-between gap-2 px-1">
                <p className="t-p5 truncate font-bold text-dark">
                  {plural(files.length, "image")} &nbsp;•&nbsp;{" "}
                  {formatBytes(totalBytes)} &nbsp;•&nbsp;{" "}
                  {plural(totalPages, "Page")}
                </p>
                <button
                  type="button"
                  onClick={() => onClear(kind)}
                  className="t-p5 shrink-0 text-muted underline underline-offset-2 hover:text-ink"
                >
                  Clear all
                </button>
              </div>
              <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
                {files.map((file, index) => (
                  <li
                    key={file.id}
                    className="flex items-center gap-2 rounded-lg bg-surface-2 py-1 pr-1 pl-2.5"
                  >
                    <span className="t-p5 w-5 shrink-0 text-muted tabular-nums">
                      {index + 1}.
                    </span>
                    <span className="t-p5 min-w-0 flex-1 truncate text-dark">
                      {file.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => onRemove(kind, file.id)}
                      aria-label={`Remove ${file.name}`}
                      className="grid size-5 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-dark hover:text-white"
                    >
                      <X size={12} strokeWidth={2.4} />
                    </button>
                  </li>
                ))}
              </ul>
              <label
                htmlFor={inputId}
                className="t-p5 shrink-0 cursor-pointer px-1 text-brand hover:underline"
              >
                + Add more pages
              </label>
            </div>
          )}
        </>
      ) : (
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
          <span className="t-meta text-muted/55">{error ?? "Max 10MB"}</span>
        </label>
      )}

      <input
        id={inputId}
        type="file"
        accept={ACCEPT}
        multiple
        className="sr-only"
        onChange={(e) => {
          accept(e.target.files);
          e.target.value = "";
        }}
      />

      {files.length > 0 && error && (
        <p className="t-p5 absolute inset-x-0 -bottom-6 text-center text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
