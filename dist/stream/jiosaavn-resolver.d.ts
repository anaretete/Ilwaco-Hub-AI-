import { Track } from '../types/track.js';
import { AudioStream } from '../types/stream.js';
import { IStreamResolver, StreamResolutionOptions } from './types.js';
export declare class JioSaavnResolver implements IStreamResolver {
    readonly name = "JioSaavn";
    readonly priority = 5;
    private apiBaseUrl;
    private customFetch?;
    constructor(apiBaseUrl?: string, customFetch?: typeof fetch);
    canHandle(track: Track): boolean;
    resolve(track: Track, options?: StreamResolutionOptions): Promise<AudioStream | null>;
}
//# sourceMappingURL=jiosaavn-resolver.d.ts.map