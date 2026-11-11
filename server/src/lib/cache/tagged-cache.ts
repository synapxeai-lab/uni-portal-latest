/**
 * In-process, tag-invalidated read cache - the Express replacement for the
 * Next.js `"use cache"` + cacheTag/updateTag data cache the app used before.
 *
 * - Every entry has a TTL and one or more tags; a mutation calls
 *   invalidateTags() with the tags it affects and every entry carrying any of
 *   them is dropped immediately, so the acting user never reads stale data.
 * - Concurrent misses for the same key share one loader call.
 * - A load that started before an invalidation of one of its tags is not
 *   stored (it may have read pre-mutation rows) - it is still returned to its
 *   own caller, exactly like a request that raced the write would see.
 * - Bounded: the oldest entries are evicted beyond MAX_ENTRIES.
 *
 * Cached values are shared between requests - callers must treat them as
 * read-only.
 */

import { AsyncLocalStorage } from "node:async_hooks";

/** Set (in development) for requests carrying X-Cache-Bypass: 1 - see middleware/request-context.ts. */
export const cacheBypass = new AsyncLocalStorage<boolean>();

interface Entry {
  value: unknown;
  expiresAt: number;
  tags: readonly string[];
}

const MAX_ENTRIES = 10_000;

export interface CacheOptions {
  /** Time to live in milliseconds. */
  ttl: number;
  tags: readonly string[];
}

class TaggedCache {
  private readonly entries = new Map<string, Entry>();
  private readonly keysByTag = new Map<string, Set<string>>();
  private readonly inflight = new Map<
    string,
    { promise: Promise<unknown>; tags: readonly string[] }
  >();
  /** Bumped on every invalidation - lets an in-flight load detect it raced one. */
  private readonly tagVersions = new Map<string, number>();

  async getOrLoad<T>(key: string, options: CacheOptions, loader: () => Promise<T>): Promise<T> {
    // Latency measurement (development only): read straight from the database.
    if (cacheBypass.getStore() === true) {
      return loader();
    }

    const hit = this.entries.get(key);
    if (hit && hit.expiresAt > Date.now()) {
      return hit.value as T;
    }
    if (hit) {
      this.delete(key);
    }

    const pending = this.inflight.get(key);
    if (pending) {
      return pending.promise as Promise<T>;
    }

    const versionsAtStart = options.tags.map((tag) => this.tagVersions.get(tag) ?? 0);
    const load = loader()
      .then((value) => {
        const raced = options.tags.some(
          (tag, index) => (this.tagVersions.get(tag) ?? 0) !== versionsAtStart[index],
        );
        if (!raced) {
          this.set(key, value, options);
        }
        return value;
      })
      .finally(() => {
        if (this.inflight.get(key)?.promise === load) {
          this.inflight.delete(key);
        }
      });

    this.inflight.set(key, { promise: load, tags: options.tags });
    return load;
  }

  invalidateTags(...tags: string[]): void {
    for (const tag of new Set(tags)) {
      this.tagVersions.set(tag, (this.tagVersions.get(tag) ?? 0) + 1);
      // An in-flight load carrying this tag must not be joined by later
      // callers - it may resolve with the pre-mutation value.
      for (const [key, pending] of this.inflight) {
        if (pending.tags.includes(tag)) {
          this.inflight.delete(key);
        }
      }
      const keys = this.keysByTag.get(tag);
      if (!keys) {
        continue;
      }
      for (const key of [...keys]) {
        this.delete(key);
      }
      this.keysByTag.delete(tag);
    }
  }

  clear(): void {
    this.entries.clear();
    this.keysByTag.clear();
    this.inflight.clear();
  }

  get size(): number {
    return this.entries.size;
  }

  private set(key: string, value: unknown, options: CacheOptions): void {
    if (this.entries.size >= MAX_ENTRIES) {
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) {
        this.delete(oldest);
      }
    }
    this.entries.set(key, { value, expiresAt: Date.now() + options.ttl, tags: options.tags });
    for (const tag of options.tags) {
      let keys = this.keysByTag.get(tag);
      if (!keys) {
        keys = new Set();
        this.keysByTag.set(tag, keys);
      }
      keys.add(key);
    }
  }

  private delete(key: string): void {
    const entry = this.entries.get(key);
    if (!entry) {
      return;
    }
    this.entries.delete(key);
    for (const tag of entry.tags) {
      this.keysByTag.get(tag)?.delete(key);
    }
  }
}

export const cache = new TaggedCache();

/** Convenience wrapper: `cached(key, { ttl, tags }, () => query())`. */
export function cached<T>(
  key: string,
  options: CacheOptions,
  loader: () => Promise<T>,
): Promise<T> {
  return cache.getOrLoad(key, options, loader);
}
