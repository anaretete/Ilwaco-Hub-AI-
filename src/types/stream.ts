export type AudioCodec = 'opus' | 'aac' | 'flac' | 'alac' | 'mp3' | 'vorbis';

export type QualityCeiling = 'LOW' | 'MEDIUM' | 'HIGH' | 'LOSSLESS';

export type NetworkType = 'wifi' | 'cellular' | 'ethernet' | 'offline' | 'unknown';

export interface QualityProfile {
  wifiCeiling: QualityCeiling;
  cellularCeiling: QualityCeiling;
  preferLosslessWhenAvailable: boolean;
  lengthSlackSeconds: number; // e.g. 5 seconds tolerance for duration match
}

export interface AudioStream {
  url: string;
  formatId?: string | number; // itag or format identifier
  mimeType: string;
  codec: AudioCodec;
  bitrate: number; // in kbps (e.g. 160, 256, 320, 1411)
  sampleRate: number; // in Hz (e.g. 44100, 48000, 96000)
  bitDepth: number; // in bits (16, 24, 32)
  channels: number; // usually 2
  isLossless: boolean;
  duration?: number; // in seconds
  contentLength?: number; // in bytes
  loudnessLufs?: number; // measured/estimated LUFS (e.g. -14.0)
  expiresAt?: number; // timestamp in milliseconds when URL expires
  sourceName: string; // e.g. 'InnerTubeX', 'LosslessModule', 'JioSaavn'
  headers?: Record<string, string>;
}

export interface StreamResolutionResult {
  trackId: string;
  stream: AudioStream;
  fromCache: boolean;
  resolutionTimeMs: number;
  attemptedSources: string[];
}
