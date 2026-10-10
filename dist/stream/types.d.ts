import { Track } from '../types/track.js';
import { AudioStream, QualityCeiling, QualityProfile } from '../types/stream.js';
export interface StreamResolutionOptions {
    qualityCeiling?: QualityCeiling;
    isCellular?: boolean;
    forceBypassCache?: boolean;
    lengthSlackSeconds?: number;
}
export interface IStreamResolver {
    readonly name: string;
    readonly priority: number;
    canHandle(track: Track): boolean;
    resolve(track: Track, options?: StreamResolutionOptions): Promise<AudioStream | null>;
}
export interface StreamPipelineConfig {
    defaultQualityProfile: QualityProfile;
    cacheTtlMs: number;
    maxCacheEntries: number;
    timeoutMsPerResolver: number;
}
//# sourceMappingURL=types.d.ts.map