import { StreamCache } from './cache.js';
import { InnerTubeResolver } from './innertube-resolver.js';
export class StreamResolutionPipeline {
    resolvers = [];
    cache;
    config;
    isCellular = false;
    constructor(config) {
        this.config = {
            defaultQualityProfile: {
                wifiCeiling: 'LOSSLESS',
                cellularCeiling: 'MEDIUM',
                preferLosslessWhenAvailable: true,
                lengthSlackSeconds: 5.0,
            },
            cacheTtlMs: 5 * 60 * 60 * 1000,
            maxCacheEntries: 200,
            timeoutMsPerResolver: 8000,
            ...config,
        };
        this.cache = new StreamCache(this.config.maxCacheEntries, this.config.cacheTtlMs);
        // Register default YouTube Music InnerTube resolver
        this.registerResolver(new InnerTubeResolver());
    }
    registerResolver(resolver) {
        // Avoid duplicate names
        this.resolvers = this.resolvers.filter((r) => r.name !== resolver.name);
        this.resolvers.push(resolver);
        // Sort by priority ascending (1 = highest, 10 = lowest)
        this.resolvers.sort((a, b) => a.priority - b.priority);
    }
    unregisterResolver(resolverName) {
        const prevLen = this.resolvers.length;
        this.resolvers = this.resolvers.filter((r) => r.name !== resolverName);
        return this.resolvers.length < prevLen;
    }
    getResolvers() {
        return this.resolvers;
    }
    setNetworkState(isCellular) {
        this.isCellular = isCellular;
    }
    getQualityProfile() {
        return { ...this.config.defaultQualityProfile };
    }
    setQualityProfile(profile) {
        this.config.defaultQualityProfile = {
            ...this.config.defaultQualityProfile,
            ...profile,
        };
    }
    /**
     * Resolves an audio stream for a track through the multi-tier pipeline.
     */
    async resolve(track, options) {
        const startTime = Date.now();
        const effectiveIsCellular = options?.isCellular ?? this.isCellular;
        const profile = this.config.defaultQualityProfile;
        const ceiling = options?.qualityCeiling ?? (effectiveIsCellular ? profile.cellularCeiling : profile.wifiCeiling);
        const slackSeconds = options?.lengthSlackSeconds ?? profile.lengthSlackSeconds;
        // 1. Check cache first
        if (!options?.forceBypassCache) {
            const cached = this.cache.get(track.id);
            if (cached) {
                return {
                    trackId: track.id,
                    stream: cached,
                    fromCache: true,
                    resolutionTimeMs: Date.now() - startTime,
                    attemptedSources: ['cache'],
                };
            }
        }
        const attemptedSources = [];
        // 2. Cascade through registered resolvers in priority order
        for (const resolver of this.resolvers) {
            if (!resolver.canHandle(track)) {
                continue;
            }
            attemptedSources.push(resolver.name);
            try {
                const stream = await this.resolveWithTimeout(resolver.resolve(track, {
                    qualityCeiling: ceiling,
                    isCellular: effectiveIsCellular,
                    lengthSlackSeconds: slackSeconds,
                }), this.config.timeoutMsPerResolver);
                if (stream && stream.url) {
                    // Duration slack validation
                    if (track.duration > 0 && stream.duration && stream.duration > 0) {
                        const diff = Math.abs(stream.duration - track.duration);
                        if (diff > slackSeconds) {
                            console.warn(`[StreamResolutionPipeline] Stream from ${resolver.name} duration (${stream.duration}s) exceeds slack of track (${track.duration}s ±${slackSeconds}s). Skipping.`);
                            continue;
                        }
                    }
                    // Cache the successfully resolved stream
                    this.cache.set(track.id, stream);
                    return {
                        trackId: track.id,
                        stream,
                        fromCache: false,
                        resolutionTimeMs: Date.now() - startTime,
                        attemptedSources,
                    };
                }
            }
            catch (err) {
                console.warn(`[StreamResolutionPipeline] Resolver ${resolver.name} failed:`, err);
                // Continue to fallback resolver
            }
        }
        throw new Error(`Failed to resolve stream for track "${track.title}" (${track.id}) after trying sources: ${attemptedSources.join(', ')}`);
    }
    /**
     * Invalidates a stream in the cache (e.g. on HTTP 403 / 410 or network failure).
     */
    invalidateCache(trackId) {
        this.cache.invalidate(trackId);
    }
    /**
     * Clears the entire stream cache.
     */
    clearCache() {
        this.cache.clear();
    }
    async resolveWithTimeout(promise, timeoutMs) {
        let timer;
        const timeoutPromise = new Promise((_, reject) => {
            timer = setTimeout(() => {
                reject(new Error(`Resolution timed out after ${timeoutMs}ms`));
            }, timeoutMs);
        });
        try {
            const result = await Promise.race([promise, timeoutPromise]);
            return result;
        }
        finally {
            clearTimeout(timer);
        }
    }
}
//# sourceMappingURL=stream-pipeline.js.map