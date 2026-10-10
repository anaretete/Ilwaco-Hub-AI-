import { Track } from '../types/track.js';
import { AudioStream } from '../types/stream.js';
import { IStreamResolver, StreamResolutionOptions } from './types.js';

export class JioSaavnResolver implements IStreamResolver {
  public readonly name = 'JioSaavn';
  public readonly priority = 5; // Between Lossless (1) and YouTube fallback (10)

  private apiBaseUrl: string;
  private customFetch?: typeof fetch;

  constructor(apiBaseUrl: string = 'https://saavn.me', customFetch?: typeof fetch) {
    this.apiBaseUrl = apiBaseUrl;
    this.customFetch = customFetch;
  }

  public canHandle(track: Track): boolean {
    return true;
  }

  public async resolve(track: Track, options?: StreamResolutionOptions): Promise<AudioStream | null> {
    const fetchFn = this.customFetch || globalThis.fetch;
    if (!fetchFn) return null;

    try {
      const query = encodeURIComponent(`${track.title} ${track.artist}`);
      const res = await fetchFn(`${this.apiBaseUrl}/api/search/songs?query=${query}&page=1&limit=5`);

      if (!res.ok) return null;

      const data = await res.json() as {
        success?: boolean;
        data?: {
          results?: Array<{
            id: string;
            name: string;
            duration: string | number;
            downloadUrl?: Array<{ quality: string; url: string }>;
          }>;
        };
      };

      if (!data.success || !data.data?.results || data.data.results.length === 0) {
        return null;
      }

      // Find best match respecting length slack
      const slack = options?.lengthSlackSeconds ?? 5.0;
      let matchedResult: (typeof data.data.results)[0] | null = null;

      for (const item of data.data.results) {
        const itemDuration = typeof item.duration === 'string' ? parseInt(item.duration, 10) : item.duration;
        if (track.duration > 0 && itemDuration > 0) {
          const diff = Math.abs(itemDuration - track.duration);
          if (diff <= slack) {
            matchedResult = item;
            break;
          }
        } else {
          matchedResult = item;
          break;
        }
      }

      if (!matchedResult || !matchedResult.downloadUrl || matchedResult.downloadUrl.length === 0) {
        return null;
      }

      // Pick highest quality link (e.g. 320kbps > 160kbps > 96kbps)
      const downloadLinks = matchedResult.downloadUrl;
      const bestLink =
        downloadLinks.find((l) => l.quality === '320kbps') ||
        downloadLinks.find((l) => l.quality === '160kbps') ||
        downloadLinks[downloadLinks.length - 1];

      if (!bestLink || !bestLink.url) return null;

      const itemDuration = typeof matchedResult.duration === 'string' ? parseInt(matchedResult.duration, 10) : matchedResult.duration;

      return {
        url: bestLink.url,
        mimeType: 'audio/mp4',
        codec: 'aac',
        bitrate: bestLink.quality === '320kbps' ? 320 : 160,
        sampleRate: 44100,
        bitDepth: 16,
        channels: 2,
        isLossless: false,
        duration: itemDuration || track.duration,
        loudnessLufs: -14.0,
        expiresAt: Date.now() + 24 * 3600 * 1000,
        sourceName: this.name,
      };
    } catch {
      return null;
    }
  }
}
