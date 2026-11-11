import { createReadStream } from "node:fs";
import { access, mkdir, unlink, writeFile } from "node:fs/promises";
import { dirname, normalize, resolve, sep } from "node:path";
import { Readable } from "node:stream";

import type { StorageProvider } from "./provider";

// Local disk. Defaults to storage/uploads inside the project (gitignored - see
// .gitignore). In production, set STORAGE_ROOT to a persistent volume mount
// (e.g. a Railway Volume at /data/uploads) so uploads survive redeploys.
const STORAGE_ROOT = resolve(
  process.env.STORAGE_ROOT || resolve(process.cwd(), "storage", "uploads"),
);

/**
 * Resolves a storage key to an absolute path, refusing anything that would
 * escape STORAGE_ROOT. Keys are always generated server-side (see
 * `buildStorageKey` in `file-service.ts`), never taken from a request path
 * segment directly, but this makes traversal structurally impossible
 * regardless of where a key ever originates from.
 */
function resolveKeyPath(key: string): string {
  const resolvedPath = resolve(STORAGE_ROOT, normalize(key));
  if (resolvedPath !== STORAGE_ROOT && !resolvedPath.startsWith(STORAGE_ROOT + sep)) {
    throw new Error(`Refusing to resolve storage key outside the storage root: ${key}`);
  }
  return resolvedPath;
}

/**
 * Local-disk implementation of StorageProvider - the development default.
 * Every method here is the entire contract a future cloud provider
 * (S3/R2/Supabase Storage/Azure Blob/GCS) needs to implement; see
 * `provider.ts` for the interface and `index.ts` for where a new provider
 * gets registered.
 */
export class LocalStorageProvider implements StorageProvider {
  async upload(key: string, data: Buffer): Promise<{ size: number }> {
    const path = resolveKeyPath(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, data);
    return { size: data.byteLength };
  }

  async read(key: string): Promise<ReadableStream<Uint8Array>> {
    const path = resolveKeyPath(key);
    return Readable.toWeb(createReadStream(path)) as ReadableStream<Uint8Array>;
  }

  async exists(key: string): Promise<boolean> {
    try {
      await access(resolveKeyPath(key));
      return true;
    } catch {
      return false;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await unlink(resolveKeyPath(key));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }
}
