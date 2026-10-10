import { Track } from '../types/track.js';
import { AudioStream } from '../types/stream.js';
import { IStreamResolver, StreamResolutionOptions } from './types.js';
export interface CustomSourceModuleConfig {
    name: string;
    endpointUrl: string;
    authToken?: string;
    priority?: number;
    supportLossless?: boolean;
}
export declare class CustomSourceResolver implements IStreamResolver {
    readonly name: string;
    readonly priority: number;
    private endpointUrl;
    private authToken?;
    private supportLossless;
    private customFetch?;
    constructor(config: CustomSourceModuleConfig, customFetch?: typeof fetch);
    canHandle(track: Track): boolean;
    resolve(track: Track, options?: StreamResolutionOptions): Promise<AudioStream | null>;
}
//# sourceMappingURL=custom-source-resolver.d.ts.map