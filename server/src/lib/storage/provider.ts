/**
 * The one seam the whole file-storage feature is built around. Every piece
 * of business logic (create a material, download a submission attachment,
 * remove an assignment attachment, ...) talks to this interface only - never
 * to `fs`, never to a cloud SDK directly. A future cloud backend (Amazon S3,
 * Cloudflare R2, Supabase Storage, Azure Blob Storage, Google Cloud Storage)
 * is a new class implementing these four methods, wired in via
 * `getStorageProvider()` (see `./index.ts`) - nothing outside `src/lib/storage`
 * changes.
 */
export interface StorageProvider {
  /** Persists `data` under `key`, creating any needed structure. Returns the byte length actually written. */
  upload(key: string, data: Buffer): Promise<{ size: number }>;
  /** Streams the bytes stored at `key`. Throws if the key doesn't exist - callers should check `exists()` first when a missing file is an expected, recoverable case (e.g. a legacy pre-storage record). */
  read(key: string): Promise<ReadableStream<Uint8Array>>;
  /** True if an object exists at `key`. */
  exists(key: string): Promise<boolean>;
  /** Removes the object at `key`. A no-op, not an error, if it doesn't exist. */
  delete(key: string): Promise<void>;
}
