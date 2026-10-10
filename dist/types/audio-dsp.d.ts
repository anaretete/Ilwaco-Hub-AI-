import { AudioCodec } from './stream.js';
export interface EQBandConfig {
    frequency: number;
    gain: number;
    q: number;
    type: BiquadFilterType;
}
export interface EqualizerPreset {
    name: string;
    gains: number[];
}
export interface SpatializerOptions {
    enabled: boolean;
    pan: number;
    stereoSpread: number;
}
export interface NormalizerOptions {
    enabled: boolean;
    targetLufs: number;
    preAmpDb: number;
    limiterThresholdDb: number;
}
export interface AudioTelemetry {
    sourceName: string;
    codec: AudioCodec;
    bitrateKbps: number;
    sampleRateHz: number;
    bitDepthBits: number;
    channels: number;
    isLossless: boolean;
    currentLufs: number;
    bufferHealthSeconds: number;
    bufferHealthRatio: number;
    latencyMs: number;
    dspChainActive: boolean;
    activeDeck: 'A' | 'B';
}
//# sourceMappingURL=audio-dsp.d.ts.map