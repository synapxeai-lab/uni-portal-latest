import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import type { ReadableStream as NodeWebReadableStream } from "node:stream/web";

import type { Request, Response } from "express";

import { notFound } from "@/http/errors";
import { getStorageProvider } from "@/lib/storage";

/**
 * Profile photos and classroom covers: the URL is stable per user/classroom
 * while the image behind it can be replaced, so keep the fresh window short
 * and let stale-while-revalidate hide the (cheap, ETag-validated) refresh.
 */
export const REPLACEABLE_IMAGE_CACHE_CONTROL = "private, max-age=300, stale-while-revalidate=86400";

/**
 * Lesson/submission attachments: the bytes behind an attachment id never
 * change. Still `private` and bounded to an hour so a revoked member's
 * browser stops reusing its copy soon after; revalidation is a 304.
 */
export const ATTACHMENT_CACHE_CONTROL = "private, max-age=3600";

// Every upload is stored under a fresh random key, so the key identifies the
// bytes: hashing it gives a strong ETag without reading the file.
function etagForStorageKey(storageKey: string): string {
  return `"${createHash("sha1").update(storageKey).digest("base64url")}"`;
}

function isNotModified(req: Request, etag: string): boolean {
  const header = req.get("if-none-match");
  if (!header) {
    return false;
  }
  if (header.trim() === "*") {
    return true;
  }
  return header
    .split(",")
    .map((candidate) => candidate.trim().replace(/^W\//, ""))
    .includes(etag);
}

/**
 * Streams a stored file with HTTP caching (ETag + Cache-Control, 304 on
 * revalidation). Callers must authorize BEFORE calling this - a
 * revalidation is still an access.
 */
export async function sendStoredFile(
  req: Request,
  res: Response,
  options: {
    storageKey: string;
    contentType: string;
    cacheControl: string;
    contentDisposition?: string;
    contentLength?: number;
  },
): Promise<void> {
  const etag = etagForStorageKey(options.storageKey);
  if (isNotModified(req, etag)) {
    res.status(304).set({ ETag: etag, "Cache-Control": options.cacheControl }).end();
    return;
  }

  const provider = getStorageProvider();
  if (!(await provider.exists(options.storageKey))) {
    throw notFound("File not found in storage.");
  }

  const stream = await provider.read(options.storageKey);
  res.set({
    "Content-Type": options.contentType,
    "Cache-Control": options.cacheControl,
    ETag: etag,
    "X-Content-Type-Options": "nosniff",
  });
  if (options.contentDisposition) {
    res.set("Content-Disposition", options.contentDisposition);
  }
  if (options.contentLength !== undefined) {
    res.set("Content-Length", String(options.contentLength));
  }
  Readable.fromWeb(stream as unknown as NodeWebReadableStream<Uint8Array>).pipe(res);
}
