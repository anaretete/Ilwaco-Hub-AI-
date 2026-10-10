import { Track } from '../types/track.js';
import { QualityProfile, StreamResolutionResult } from '../types/stream.js';
import { IStreamResolver, StreamPipelineConfig, StreamResolutionOptions } from './types.js';
export declare class StreamResolutionPipeline {
    private resolvers;
    private cache;
    private config;
    private isCellular;
    constructor(config?: Partial<StreamPipelineConfig>);
    registerResolver(resolver: IStreamResolver): void;
    unregisterResolver(resolverName: string): boolean;
    getResolvers(): readonly IStreamResolver[];
    setNetworkState(isCellular: boolean): void;
    getQualityProfile(): QualityProfile;
    setQualityProfile(profile: Partial<QualityProfile>): void;
    /**
     * Resolves an audio stream for a track through the multi-tier pipeline.
     */
    resolve(track: Track, options?: StreamResolutionOptions): Promise<StreamResolutionResult>;
    /**
     * Invalidates a stream in the cache (e.g. on HTTP 403 / 410 or network failure).
     */
    invalidateCache(trackId: string): void;
    /**
     * Clears the entire stream cache.
     */
    clearCache(): void;
    private resolveWithTimeout;
}
//# sourceMappingURL=stream-pipeline.d.ts.map