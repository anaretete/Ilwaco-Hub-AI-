export type AudioCodec = 'opus' | 'aac' | 'flac' | 'alac' | 'mp3' | 'vorbis';
export type QualityCeiling = 'LOW' | 'MEDIUM' | 'HIGH' | 'LOSSLESS';
export type NetworkType = 'wifi' | 'cellular' | 'ethernet' | 'offline' | 'unknown';
export interface QualityProfile {
    wifiCeiling: QualityCeiling;
    cellularCeiling: QualityCeiling;
    preferLosslessWhenAvailable: boolean;
    lengthSlackSeconds: number;
}
export interface AudioStream {
    url: string;
    formatId?: string | number;
    mimeType: string;
    codec: AudioCodec;
    bitrate: number;
    sampleRate: number;
    bitDepth: number;
    channels: number;
    isLossless: boolean;
    duration?: number;
    contentLength?: number;
    loudnessLufs?: number;
    expiresAt?: number;
    sourceName: string;
    headers?: Record<string, string>;
}
export interface StreamResolutionResult {
    trackId: string;
    stream: AudioStream;
    fromCache: boolean;
    resolutionTimeMs: number;
    attemptedSources: string[];
}
//# sourceMappingURL=stream.d.ts.map