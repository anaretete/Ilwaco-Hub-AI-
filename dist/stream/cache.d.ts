import { AudioStream } from '../types/stream.js';
export declare class StreamCache {
    private cache;
    private maxEntries;
    private defaultTtlMs;
    private safetyMarginMs;
    constructor(maxEntries?: number, defaultTtlMs?: number);
    get(trackId: string): AudioStream | null;
    set(trackId: string, stream: AudioStream): void;
    invalidate(trackId: string): boolean;
    clear(): void;
    size(): number;
}
//# sourceMappingURL=cache.d.ts.map