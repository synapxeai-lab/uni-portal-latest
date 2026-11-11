import { env } from "@/config/env";

import { LocalStorageProvider } from "./local-provider";
import type { StorageProvider } from "./provider";

export type { StorageProvider } from "./provider";

let cachedProvider: StorageProvider | undefined;

/**
 * The single factory every caller uses to reach storage - never construct a
 * provider class directly. Adding a cloud backend later (S3, Cloudflare R2,
 * Supabase Storage, Azure Blob Storage, Google Cloud Storage) means writing
 * one new class implementing `StorageProvider` and adding one `case` below;
 * every upload/download/delete call site in the app is already written
 * against the interface, so none of them change.
 */
export function getStorageProvider(): StorageProvider {
  if (!cachedProvider) {
    switch (env.STORAGE_DRIVER) {
      case "local":
      default:
        cachedProvider = new LocalStorageProvider();
    }
  }
  return cachedProvider;
}
