import { Track } from '../types/track.js';
import { AudioStream } from '../types/stream.js';
import { IStreamResolver, StreamResolutionOptions } from './types.js';
export interface InnerTubeRawFormat {
    itag: number;
    url?: string;
    cipher?: string;
    signatureCipher?: string;
    mimeType: string;
    bitrate: number;
    averageBitrate?: number;
    audioSampleRate?: string;
    audioChannels?: number;
    loudnessDb?: number;
    approxDurationMs?: string;
    contentLength?: string;
    audioQuality?: string;
}
export interface InnerTubePlayerResponse {
    playabilityStatus: {
        status: string;
        reason?: string;
    };
    streamingData?: {
        expiresInSeconds?: string;
        formats?: InnerTubeRawFormat[];
        adaptiveFormats?: InnerTubeRawFormat[];
    };
    playerConfig?: {
        audioConfig?: {
            loudnessDb?: number;
            perceptualLoudnessDb?: number;
        };
    };
}
export declare class InnerTubeResolver implements IStreamResolver {
    readonly name = "InnerTubeX";
    readonly priority = 10;
    private apiBaseUrl;
    private customFetch?;
    constructor(apiBaseUrl?: string, customFetch?: typeof fetch);
    canHandle(track: Track): boolean;
    resolve(track: Track, options?: StreamResolutionOptions): Promise<AudioStream | null>;
    private fetchPlayerResponse;
    private selectBestAudioFormat;
    private parseCodec;
}
//# sourceMappingURL=innertube-resolver.d.ts.map