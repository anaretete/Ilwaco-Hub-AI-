import { AudioStream } from '../types/stream.js';

interface CacheEntry {
  stream: AudioStream;
  cachedAt: number;
  expiresAt: number;
}

export class StreamCache {
  private cache: Map<string, CacheEntry> = new Map();
  private maxEntries: number;
  private defaultTtlMs: number;
  private safetyMarginMs: number = 60 * 1000; // 60 seconds buffer before URL expires

  constructor(maxEntries: number = 200, defaultTtlMs: number = 5 * 60 * 60 * 1000) {
    this.maxEntries = maxEntries;
    this.defaultTtlMs = defaultTtlMs;
  }

  public get(trackId: string): AudioStream | null {
    const entry = this.cache.get(trackId);
    if (!entry) return null;

    const now = Date.now();
    // Check if expired (or about to expire within safety margin)
    if (now >= entry.expiresAt - this.safetyMarginMs) {
      this.cache.delete(trackId);
      return null;
    }

    // Refresh LRU order: delete and re-insert at end
    this.cache.delete(trackId);
    this.cache.set(trackId, entry);

    return entry.stream;
  }

  public set(trackId: string, stream: AudioStream): void {
    const now = Date.now();
    let expiresAt = stream.expiresAt;

    // If stream did not specify expiresAt, try extracting 'expire' query param from URL
    if (!expiresAt && stream.url) {
      try {
        const urlObj = new URL(stream.url);
        const expireParam = urlObj.searchParams.get('expire');
        if (expireParam) {
          const expSeconds = parseInt(expireParam, 10);
          if (!isNaN(expSeconds) && expSeconds > 0) {
            expiresAt = expSeconds * 1000;
          }
        }
      } catch {
        // Not a standard URL, ignore
      }
    }

    if (!expiresAt) {
      expiresAt = now + this.defaultTtlMs;
    }

    // If already exists, delete first to update insertion order
    if (this.cache.has(trackId)) {
      this.cache.delete(trackId);
    } else if (this.cache.size >= this.maxEntries) {
      // Evict least recently used (first key in insertion order)
      const lruKey = this.cache.keys().next().value;
      if (lruKey !== undefined) {
        this.cache.delete(lruKey);
      }
    }

    this.cache.set(trackId, {
      stream,
      cachedAt: now,
      expiresAt,
    });
  }

  public invalidate(trackId: string): boolean {
    return this.cache.delete(trackId);
  }

  public clear(): void {
    this.cache.clear();
  }

  public size(): number {
    return this.cache.size;
  }
}
