import { AudioCodec } from './stream.js';

export interface EQBandConfig {
  frequency: number; // Hz (e.g. 60, 230, 910, 3600, 14000)
  gain: number; // dB (-12 to +12)
  q: number; // Quality factor (e.g. 1.4)
  type: BiquadFilterType;
}

export interface EqualizerPreset {
  name: string;
  gains: number[]; // dB values matching default frequency bands
}

export interface SpatializerOptions {
  enabled: boolean;
  pan: number; // -1.0 (left) to 1.0 (right)
  stereoSpread: number; // 0.0 (mono) to 2.0 (super-wide)
}

export interface NormalizerOptions {
  enabled: boolean;
  targetLufs: number; // default -14.0 LUFS
  preAmpDb: number; // dB manual boost/cut (-10 to +10)
  limiterThresholdDb: number; // -0.5 dB threshold for safety
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
