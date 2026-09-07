"use client";

import { useRef } from "react";
import { X } from "lucide-react";
import { Lightbox } from "../Lightbox";
import { uploadChecklistImagesAction, deleteChecklistImageAction, type ChecklistItemKey } from "./actions";
import { useAutosave } from "../useAutosave";
import { SaveStatusBadge } from "../SaveStatusBadge";

interface ChecklistImage {
  id: string;
  name: string;
  url: string;
  kind: string;
}

/**
 * Optional proof pictures for one Final Checklist item — multiple images
 * allowed, immediate upload on selection (house pattern), never required.
 */
export function ChecklistImageUpload({
  jobId,
  itemKey,
  images,
  editable,
}: {
  jobId: string;
  itemKey: ChecklistItemKey;
  images: ChecklistImage[];
  editable: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autosave = useAutosave((formData) => uploadChecklistImagesAction(jobId, itemKey, { error: null }, formData));

  return (
    <div style={{ marginTop: 6 }}>
      {images.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: editable ? 6 : 0 }}>
          {images.map((img) => (
            <div key={img.id} style={{ position: "relative" }}>
              <Lightbox file={img} size={40} />
              {editable && (
                <form action={deleteChecklistImageAction.bind(null, img.id, jobId)}>
                  <button
                    className="btn btn-sm btn-danger"
                    type="submit"
                    title="Remove picture"
                    style={{ position: "absolute", top: -6, right: -6, width: 18, height: 18, padding: 0, borderRadius: 999, lineHeight: 1 }}
                  >
                    <X size={11} strokeWidth={3} />
                  </button>
                </form>
              )}
            </div>
          ))}
        </div>
      )}

      {editable && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <input
            ref={inputRef}
            className="input"
            type="file"
            accept="image/*"
            multiple
            style={{ fontSize: 11.5, maxWidth: 220 }}
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              if (files.length === 0) return;
              const fd = new FormData();
              files.forEach((f) => fd.append("images", f));
              autosave.saveNow(() => fd);
              if (inputRef.current) inputRef.current.value = "";
            }}
          />
          <SaveStatusBadge status={autosave.status} error={autosave.error} />
        </div>
      )}
    </div>
  );
}
