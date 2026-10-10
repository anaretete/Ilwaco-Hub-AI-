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
  readonly priority: number; // lower number = higher priority (e.g., 1 = Lossless module, 2 = InnerTube)
  canHandle(track: Track): boolean;
  resolve(track: Track, options?: StreamResolutionOptions): Promise<AudioStream | null>;
}

export interface StreamPipelineConfig {
  defaultQualityProfile: QualityProfile;
  cacheTtlMs: number; // default 5 hours (18,000,000 ms)
  maxCacheEntries: number; // default 200
  timeoutMsPerResolver: number; // default 8000 ms
}
