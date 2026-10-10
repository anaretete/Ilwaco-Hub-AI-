import { Track } from '../types/track.js';
import { AudioStream, QualityProfile, StreamResolutionResult } from '../types/stream.js';
import { IStreamResolver, StreamPipelineConfig, StreamResolutionOptions } from './types.js';
import { StreamCache } from './cache.js';
import { InnerTubeResolver } from './innertube-resolver.js';

export class StreamResolutionPipeline {
  private resolvers: IStreamResolver[] = [];
  private cache: StreamCache;
  private config: StreamPipelineConfig;
  private isCellular: boolean = false;

  constructor(config?: Partial<StreamPipelineConfig>) {
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

  public registerResolver(resolver: IStreamResolver): void {
    // Avoid duplicate names
    this.resolvers = this.resolvers.filter((r) => r.name !== resolver.name);
    this.resolvers.push(resolver);
    // Sort by priority ascending (1 = highest, 10 = lowest)
    this.resolvers.sort((a, b) => a.priority - b.priority);
  }

  public unregisterResolver(resolverName: string): boolean {
    const prevLen = this.resolvers.length;
    this.resolvers = this.resolvers.filter((r) => r.name !== resolverName);
    return this.resolvers.length < prevLen;
  }

  public getResolvers(): readonly IStreamResolver[] {
    return this.resolvers;
  }

  public setNetworkState(isCellular: boolean): void {
    this.isCellular = isCellular;
  }

  public getQualityProfile(): QualityProfile {
    return { ...this.config.defaultQualityProfile };
  }

  public setQualityProfile(profile: Partial<QualityProfile>): void {
    this.config.defaultQualityProfile = {
      ...this.config.defaultQualityProfile,
      ...profile,
    };
  }

  /**
   * Resolves an audio stream for a track through the multi-tier pipeline.
   */
  public async resolve(track: Track, options?: StreamResolutionOptions): Promise<StreamResolutionResult> {
    const startTime = Date.now();
    const effectiveIsCellular = options?.isCellular ?? this.isCellular;
    const profile = this.config.defaultQualityProfile;
    const ceiling =
      options?.qualityCeiling ?? (effectiveIsCellular ? profile.cellularCeiling : profile.wifiCeiling);
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

    const attemptedSources: string[] = [];

    // 2. Cascade through registered resolvers in priority order
    for (const resolver of this.resolvers) {
      if (!resolver.canHandle(track)) {
        continue;
      }

      attemptedSources.push(resolver.name);

      try {
        const stream = await this.resolveWithTimeout(
          resolver.resolve(track, {
            qualityCeiling: ceiling,
            isCellular: effectiveIsCellular,
            lengthSlackSeconds: slackSeconds,
          }),
          this.config.timeoutMsPerResolver
        );

        if (stream && stream.url) {
          // Duration slack validation
          if (track.duration > 0 && stream.duration && stream.duration > 0) {
            const diff = Math.abs(stream.duration - track.duration);
            if (diff > slackSeconds) {
              console.warn(
                `[StreamResolutionPipeline] Stream from ${resolver.name} duration (${stream.duration}s) exceeds slack of track (${track.duration}s ±${slackSeconds}s). Skipping.`
              );
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
      } catch (err) {
        console.warn(`[StreamResolutionPipeline] Resolver ${resolver.name} failed:`, err);
        // Continue to fallback resolver
      }
    }

    throw new Error(
      `Failed to resolve stream for track "${track.title}" (${track.id}) after trying sources: ${attemptedSources.join(', ')}`
    );
  }

  /**
   * Invalidates a stream in the cache (e.g. on HTTP 403 / 410 or network failure).
   */
  public invalidateCache(trackId: string): void {
    this.cache.invalidate(trackId);
  }

  /**
   * Clears the entire stream cache.
   */
  public clearCache(): void {
    this.cache.clear();
  }

  private async resolveWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    let timer: any;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error(`Resolution timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    try {
      const result = await Promise.race([promise, timeoutPromise]);
      return result;
    } finally {
      clearTimeout(timer);
    }
  }
}
