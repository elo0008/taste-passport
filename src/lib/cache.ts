import crypto from 'crypto';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * Serverless Memory Cache
 *
 * NOTE ON SERVERLESS LIMITATION:
 * In a serverless/lambda environment (such as Vercel), in-memory state persists
 * only within a warm execution container. Across cold starts or across distinct
 * concurrent lambdas, this in-memory cache is not shared. For persistent multi-instance
 * caching, an external distributed cache (like Redis) would be required. However,
 * within container lifetimes, this cache provides fast response times and avoids
 * duplicate Qloo API calls and rate-limit hits.
 */
export class MemoryCache {
  private readonly maxEntries: number;
  private readonly entries: Map<string, CacheEntry<any>> = new Map();

  constructor(maxEntries = 200) {
    this.maxEntries = maxEntries;
  }

  public get<T>(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.entries.delete(key);
      return undefined;
    }

    // Refresh LRU order: delete and re-insert
    this.entries.delete(key);
    this.entries.set(key, entry);

    return entry.value as T;
  }

  public set<T>(key: string, value: T, ttlMs: number = 24 * 60 * 60 * 1000): void {
    if (this.entries.size >= this.maxEntries) {
      // Evict oldest entry (first key in map)
      const oldestKey = this.entries.keys().next().value;
      if (oldestKey) {
        this.entries.delete(oldestKey);
      }
    }

    this.entries.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  public has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  public clear(): void {
    this.entries.clear();
  }

  public size(): number {
    return this.entries.size;
  }

  public static hashKey(obj: unknown): string {
    const jsonStr = JSON.stringify(obj);
    return crypto.createHash('sha256').update(jsonStr).digest('hex');
  }
}

// Global shared cache instances
export const passportResultCache = new MemoryCache(200);
export const qlooRequestCache = new MemoryCache(200);

