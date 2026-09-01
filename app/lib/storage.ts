import { writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";

/**
 * File storage abstraction (Section 2 / 10 / 11 of the handoff brief).
 * Every upload point in the app (receipts, advance payment proof, sign
 * art, cut files, price list files) calls `saveUpload` and stores only
 * the returned url/name/kind — never a base64 blob in the database, which
 * is what the prototype did as a demo-only shortcut.
 *
 * This implementation writes to local disk under public/uploads, which is
 * enough to develop and demo the real interaction pattern end-to-end. Swap
 * it for an S3-compatible implementation of the same `saveUpload` shape
 * before deploying anywhere with more than one server instance or
 * ephemeral disk — nothing above this module needs to change.
 */
export interface StoredFile {
  url: string;
  name: string;
  kind: string;
}

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

export async function saveUpload(file: File): Promise<StoredFile> {
  await mkdir(UPLOAD_DIR, { recursive: true });
  const ext = path.extname(file.name);
  const filename = `${crypto.randomUUID()}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(UPLOAD_DIR, filename), buffer);
  return {
    url: `/uploads/${filename}`,
    name: file.name,
    kind: file.type || "application/octet-stream",
  };
}

/** Pulls a non-empty File out of FormData, or null if the field was left blank. */
export function getUploadedFile(formData: FormData, field: string): File | null {
  const value = formData.get(field);
  return value instanceof File && value.size > 0 ? value : null;
}
