import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

/**
 * File storage abstraction (Section 2 / 10 / 11 of the handoff brief).
 * Every upload point in the app (receipts, advance payment proof, sign
 * art, cut files, price list files) calls `saveUpload` and stores only
 * the returned url/name/kind — never a base64 blob in the database, which
 * is what the prototype did as a demo-only shortcut.
 *
 * Two implementations behind the same interface, selected automatically:
 *   - S3-compatible (AletCloud Object Storage), when S3_BUCKET is set —
 *     this is what production uses.
 *   - Local disk under public/uploads, when it isn't — local dev only;
 *     doesn't persist correctly on a managed platform with ephemeral
 *     storage/multiple instances.
 *
 * Env vars (as injected by AletCloud's connectBucketToApp): S3_BUCKET,
 * S3_ENDPOINT, S3_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY,
 * AWS_S3_FORCE_PATH_STYLE. S3_PUBLIC_URL_BASE is this app's own var for
 * constructing a public object URL without a presign round-trip — set it
 * to the bucket's public base (e.g. https://s3.aletcloud.com/<bucket>)
 * for a PUBLIC_READ bucket; falls back to `${S3_ENDPOINT}/${S3_BUCKET}`
 * (path-style) if omitted.
 */
export interface StoredFile {
  url: string;
  name: string;
  kind: string;
}

const S3_BUCKET = process.env.S3_BUCKET;

const s3Client = S3_BUCKET
  ? new S3Client({
      region: process.env.S3_REGION || process.env.AWS_REGION || "us-east-1",
      endpoint: process.env.S3_ENDPOINT || process.env.AWS_ENDPOINT_URL_S3,
      forcePathStyle: (process.env.AWS_S3_FORCE_PATH_STYLE ?? "true") === "true",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
      },
    })
  : null;

const S3_PUBLIC_URL_BASE =
  process.env.S3_PUBLIC_URL_BASE ||
  (S3_BUCKET ? `${(process.env.S3_ENDPOINT || process.env.AWS_ENDPOINT_URL_S3 || "").replace(/\/$/, "")}/${S3_BUCKET}` : "");

async function saveUploadS3(file: File): Promise<StoredFile> {
  const ext = path.extname(file.name);
  const key = `uploads/${crypto.randomUUID()}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const kind = file.type || "application/octet-stream";

  await s3Client!.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: kind,
    })
  );

  return { url: `${S3_PUBLIC_URL_BASE}/${key}`, name: file.name, kind };
}

const LOCAL_UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

async function saveUploadLocal(file: File): Promise<StoredFile> {
  await mkdir(LOCAL_UPLOAD_DIR, { recursive: true });
  const ext = path.extname(file.name);
  const filename = `${crypto.randomUUID()}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(LOCAL_UPLOAD_DIR, filename), buffer);
  return {
    url: `/uploads/${filename}`,
    name: file.name,
    kind: file.type || "application/octet-stream",
  };
}

export async function saveUpload(file: File): Promise<StoredFile> {
  return s3Client ? saveUploadS3(file) : saveUploadLocal(file);
}

/** Pulls a non-empty File out of FormData, or null if the field was left blank. */
export function getUploadedFile(formData: FormData, field: string): File | null {
  const value = formData.get(field);
  return value instanceof File && value.size > 0 ? value : null;
}

async function deleteUploadS3(url: string): Promise<void> {
  const prefix = `${S3_PUBLIC_URL_BASE}/`;
  if (!url.startsWith(prefix)) return;
  await s3Client!.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: url.slice(prefix.length) }));
}

async function deleteUploadLocal(url: string): Promise<void> {
  if (!url.startsWith("/uploads/")) return;
  await unlink(path.join(LOCAL_UPLOAD_DIR, url.slice("/uploads/".length)));
}

/**
 * Best-effort delete for a stored file's url (used when a whole job is
 * deleted, Section 9). Swallows failures — an already-missing object or a
 * transient storage error shouldn't block the record deletion that already
 * succeeded by the time this runs.
 */
export async function deleteUpload(url: string | null | undefined): Promise<void> {
  if (!url) return;
  try {
    if (s3Client) await deleteUploadS3(url);
    else await deleteUploadLocal(url);
  } catch {
    // Orphaned file cleanup is best-effort only.
  }
}
