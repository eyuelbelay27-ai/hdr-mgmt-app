"use client";

import { useState } from "react";

export interface FileRef {
  name: string;
  url: string;
  kind: string;
}

/**
 * Inline thumbnail with click-to-enlarge overlay — the house style for
 * every uploaded picture/document in the app (Section 9): receipts,
 * advance payment proof, sign art, cut files. PDFs and other non-image
 * files show a generic file chip instead of a broken thumbnail, but still
 * open (in a new tab) on click.
 */
export function Lightbox({ file, size = 48 }: { file: FileRef; size?: number }) {
  const [open, setOpen] = useState(false);
  const isImage = file.kind.startsWith("image/");

  if (!isImage) {
    return (
      <a
        className="btn btn-sm"
        href={file.url}
        target="_blank"
        rel="noreferrer"
        title={file.name}
      >
        📄 {file.name.length > 20 ? file.name.slice(0, 20) + "…" : file.name}
      </a>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={file.name}
        style={{
          width: size,
          height: size,
          padding: 0,
          border: "1px solid var(--border)",
          borderRadius: 6,
          overflow: "hidden",
          cursor: "zoom-in",
          background: "var(--surface-2)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={file.url} alt={file.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </button>

      {open && (
        <div
          className="print-overlay"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.7)",
            zIndex: 200,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
          onClick={() => setOpen(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={file.url}
            alt={file.name}
            style={{ maxWidth: "90%", maxHeight: "90%", borderRadius: 8 }}
          />
        </div>
      )}
    </>
  );
}
