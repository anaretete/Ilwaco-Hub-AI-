import { Track } from '../types/track.js';
import { AudioCodec, AudioStream, QualityCeiling } from '../types/stream.js';
import { IStreamResolver, StreamResolutionOptions } from './types.js';
import { StreamCipher } from './cipher.js';

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

export class InnerTubeResolver implements IStreamResolver {
  public readonly name = 'InnerTubeX';
  public readonly priority = 10; // YouTube Music is the standard fallback

  private apiBaseUrl: string;
  private customFetch?: typeof fetch;

  constructor(apiBaseUrl: string = 'https://music.youtube.com', customFetch?: typeof fetch) {
    this.apiBaseUrl = apiBaseUrl;
    this.customFetch = customFetch;
  }

  public canHandle(track: Track): boolean {
    // InnerTube can handle tracks from YouTube or tracks that have a YouTube sourceId
    return track.sourceType === 'youtube' || !!track.sourceId;
  }

  public async resolve(track: Track, options?: StreamResolutionOptions): Promise<AudioStream | null> {
    const videoId = track.sourceId || track.id;
    if (!videoId) return null;

    try {
      const response = await this.fetchPlayerResponse(videoId);
      if (!response || response.playabilityStatus.status !== 'OK' || !response.streamingData) {
        return null;
      }

      const rawFormats = response.streamingData.adaptiveFormats || response.streamingData.formats || [];
      const audioFormats = rawFormats.filter((f) => f.mimeType && f.mimeType.startsWith('audio/'));

      if (audioFormats.length === 0) {
        return null;
      }

      // Select best format matching ceiling
      const ceiling = options?.qualityCeiling || (options?.isCellular ? 'MEDIUM' : 'HIGH');
      const selectedFormat = this.selectBestAudioFormat(audioFormats, ceiling);

      if (!selectedFormat) return null;

      // Extract playable URL
      let streamUrl: string | null = null;
      if (selectedFormat.url) {
        streamUrl = selectedFormat.url;
      } else if (selectedFormat.signatureCipher || selectedFormat.cipher) {
        const cipherStr = selectedFormat.signatureCipher || selectedFormat.cipher || '';
        streamUrl = StreamCipher.decodeCipherUrl(cipherStr);
      }

      if (!streamUrl) return null;

      const codec = this.parseCodec(selectedFormat.mimeType);
      const sampleRate = parseInt(selectedFormat.audioSampleRate || '48000', 10);
      const bitrate = Math.round((selectedFormat.averageBitrate || selectedFormat.bitrate || 160000) / 1000);
      const durationSec = selectedFormat.approxDurationMs ? parseInt(selectedFormat.approxDurationMs, 10) / 1000 : track.duration;

      // YouTube loudnessDb is calibrated relative to -14 LUFS target:
      // Track LUFS ≈ -14.0 - loudnessDb
      const loudnessDb = selectedFormat.loudnessDb ?? response.playerConfig?.audioConfig?.loudnessDb ?? 0;
      const estimatedLufs = -14.0 - loudnessDb;

      // Extract expiration
      const urlObj = new URL(streamUrl);
      const expireSeconds = parseInt(urlObj.searchParams.get('expire') || '0', 10);
      const expiresAt = expireSeconds > 0 ? expireSeconds * 1000 : Date.now() + 6 * 3600 * 1000;

      return {
        url: streamUrl,
        formatId: selectedFormat.itag,
        mimeType: selectedFormat.mimeType,
        codec,
        bitrate,
        sampleRate,
        bitDepth: 16,
        channels: selectedFormat.audioChannels || 2,
        isLossless: false,
        duration: durationSec,
        contentLength: selectedFormat.contentLength ? parseInt(selectedFormat.contentLength, 10) : undefined,
        loudnessLufs: estimatedLufs,
        expiresAt,
        sourceName: this.name,
      };
    } catch (err) {
      console.warn(`[InnerTubeResolver] Failed to resolve track ${videoId}:`, err);
      return null;
    }
  }

  private async fetchPlayerResponse(videoId: string): Promise<InnerTubePlayerResponse | null> {
    const fetchFn = this.customFetch || globalThis.fetch;
    if (!fetchFn) {
      throw new Error('No fetch implementation available');
    }

    const payload = {
      context: {
        client: {
          clientName: 'WEB_REMIX',
          clientVersion: '1.20241001.01.00',
          hl: 'en',
          gl: 'US',
        },
      },
      videoId,
    };

    const res = await fetchFn(`${this.apiBaseUrl}/youtubei/v1/player`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      return null;
    }

    return (await res.json()) as InnerTubePlayerResponse;
  }

  private selectBestAudioFormat(formats: InnerTubeRawFormat[], ceiling: QualityCeiling): InnerTubeRawFormat | null {
    // Target bitrates for ceilings
    const maxBitrate = ceiling === 'LOW' ? 100000 : ceiling === 'MEDIUM' ? 170000 : 350000;

    // Filter within ceiling
    const candidates = formats.filter((f) => {
      const br = f.averageBitrate || f.bitrate || 0;
      return br <= maxBitrate;
    });

    const pool = candidates.length > 0 ? candidates : formats;

    // Sort: prefer Opus > AAC, then higher bitrate
    return pool.sort((a, b) => {
      const isOpusA = a.mimeType?.includes('opus') ? 1 : 0;
      const isOpusB = b.mimeType?.includes('opus') ? 1 : 0;
      if (isOpusA !== isOpusB) return isOpusB - isOpusA;

      const brA = a.averageBitrate || a.bitrate || 0;
      const brB = b.averageBitrate || b.bitrate || 0;
      return brB - brA;
    })[0] || null;
  }

  private parseCodec(mimeType: string): AudioCodec {
    if (mimeType.includes('opus')) return 'opus';
    if (mimeType.includes('mp4a') || mimeType.includes('aac')) return 'aac';
    if (mimeType.includes('flac')) return 'flac';
    if (mimeType.includes('mp3') || mimeType.includes('mpeg')) return 'mp3';
    return 'opus';
  }
}
