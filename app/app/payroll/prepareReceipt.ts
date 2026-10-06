// Server actions accept at most 1 MB, and phone photos of bank slips are
// often several MB — so photos are downscaled to JPEG in the browser first.
const MAX_UPLOAD_BYTES = 950 * 1024;
const MAX_EDGE = 1800;

async function downscale(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  for (const quality of [0.82, 0.7, 0.55]) {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (blob && blob.size <= MAX_UPLOAD_BYTES) {
      return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
    }
  }
  return file;
}

/** Returns an uploadable file, or an error message to show instead. */
export async function prepareReceipt(file: File): Promise<{ file: File } | { error: string }> {
  let result = file;
  if (file.type.startsWith("image/") && file.size > MAX_UPLOAD_BYTES) {
    try {
      result = await downscale(file);
    } catch {
      // Formats the browser can't decode (e.g. HEIC outside Safari) fall through to the size check.
    }
  }
  if (result.size > MAX_UPLOAD_BYTES) {
    return {
      error: file.type === "application/pdf"
        ? "This PDF is over 1 MB. Upload a screenshot or photo instead."
        : "This file is too large. Try a screenshot instead.",
    };
  }
  return { file: result };
}
