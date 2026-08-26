"use client";

import { useEffect, useState } from "react";
import { rasterize, stripDataUrlPrefix } from "@/lib/pdf";
import type { AnswerBlock, PageImage } from "@/lib/types";

/** Dev-only harness: runs the real rasterise -> extract path and paints the
 *  returned boxes over the rendered page so highlight accuracy is verifiable. */
export default function DebugBoxes() {
  const [pages, setPages] = useState<PageImage[]>([]);
  const [blocks, setBlocks] = useState<AnswerBlock[]>([]);
  const [status, setStatus] = useState("starting…");

  useEffect(() => {
    (async () => {
      const params = new URLSearchParams(location.search);
      const src = params.get("src") ?? "/samples/student_answer_sheet.pdf";
      setStatus(`fetching ${src}…`);
      const res = await fetch(src);
      const file = new File([await res.blob()], "answers.pdf", {
        type: "application/pdf",
      });
      setStatus("rasterising…");
      const rendered = await rasterize(file, (done, total) =>
        setStatus(`rasterising page ${done}/${total}…`),
      );
      setPages(rendered);

      if (!params.has("extract")) {
        setStatus(`rendered ${rendered.length} pages (add ?extract=1 to run the model)`);
        return;
      }

      const all: AnswerBlock[] = [];
      for (let i = 0; i < rendered.length; i += 4) {
        const batch = rendered.slice(i, i + 4);
        setStatus(`extracting pages ${i + 1}-${i + batch.length}/${rendered.length}…`);
        const r = await fetch("/api/extract-answers", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            pages: batch.map((p) => ({
              mimeType: "image/jpeg",
              data: stripDataUrlPrefix(p.dataUrl),
            })),
            pageNumbers: batch.map((p) => p.index + 1),
            totalPages: rendered.length,
          }),
        });
        const json = await r.json();
        if (json.error) throw new Error(json.error);
        all.push(...(json.blocks ?? []));
        setBlocks([...all]);
      }
      setBlocks(all);
      setStatus(`done — ${all.length} blocks`);
    })().catch((e) => setStatus(`error: ${e.message}`));
  }, []);

  return (
    <div className="bg-neutral-100 p-6">
      <p className="mb-4 font-mono text-sm">{status}</p>
      {pages.map((page) => (
        <div
          key={page.index}
          className="relative mx-auto mb-8 w-[760px] shadow-lg"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={page.dataUrl} alt={`page ${page.index + 1}`} className="w-full" />
          {blocks
            .flatMap((b) =>
              b.regions
                .filter((r) => r.page === page.index + 1)
                .map((r) => ({ b, r })),
            )
            .map(({ b, r }) => (
              <div
                key={b.id}
                className="absolute rounded-[16px] border-2"
                style={{
                  left: `${r.box.x * 100}%`,
                  top: `${r.box.y * 100}%`,
                  width: `${r.box.w * 100}%`,
                  height: `${r.box.h * 100}%`,
                  borderColor: "#3DD218",
                  background: "rgb(94 255 53 / 0.10)",
                }}
              >
                <span className="absolute -top-[26px] left-0 rounded-t-[12px] bg-[#34AC15] px-3 py-0.5 text-[13px] font-bold text-white">
                  {b.labelOnSheet ?? (b.continuesFromPrevPage ? "cont." : "?")}
                </span>
              </div>
            ))}
        </div>
      ))}
    </div>
  );
}
