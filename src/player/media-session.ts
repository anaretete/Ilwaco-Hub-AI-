import { Track } from '../types/track.js';
import { PlaybackState } from '../types/player.js';

export interface MediaSessionCallbacks {
  onPlay: () => void;
  onPause: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onSeekTo: (details: { seekTime: number }) => void;
  onSeekBackward: (details: { seekOffset?: number }) => void;
  onSeekForward: (details: { seekOffset?: number }) => void;
}

export class MediaSessionManager {
  private callbacks: Partial<MediaSessionCallbacks> = {};

  constructor(callbacks?: Partial<MediaSessionCallbacks>) {
    if (callbacks) {
      this.callbacks = callbacks;
    }
    this.registerHandlers();
  }

  private isAvailable(): boolean {
    return typeof navigator !== 'undefined' && 'mediaSession' in navigator;
  }

  private registerHandlers(): void {
    if (!this.isAvailable()) return;

    try {
      navigator.mediaSession.setActionHandler('play', () => {
        this.callbacks.onPlay?.();
      });

      navigator.mediaSession.setActionHandler('pause', () => {
        this.callbacks.onPause?.();
      });

      navigator.mediaSession.setActionHandler('previoustrack', () => {
        this.callbacks.onPrevious?.();
      });

      navigator.mediaSession.setActionHandler('nexttrack', () => {
        this.callbacks.onNext?.();
      });

      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined) {
          this.callbacks.onSeekTo?.({ seekTime: details.seekTime });
        }
      });

      navigator.mediaSession.setActionHandler('seekbackward', (details) => {
        this.callbacks.onSeekBackward?.({ seekOffset: details.seekOffset || 10 });
      });

      navigator.mediaSession.setActionHandler('seekforward', (details) => {
        this.callbacks.onSeekForward?.({ seekOffset: details.seekOffset || 10 });
      });
    } catch (err) {
      console.warn('[MediaSessionManager] Failed to register action handlers:', err);
    }
  }

  public updateTrack(track: Track | null): void {
    if (!this.isAvailable()) return;

    if (!track) {
      navigator.mediaSession.metadata = null;
      return;
    }

    const artwork: MediaImage[] = (track.artwork || []).map((art) => ({
      src: art.url,
      sizes: art.width && art.height ? `${art.width}x${art.height}` : '512x512',
      type: 'image/jpeg',
    }));

    if (artwork.length === 0) {
      artwork.push({
        src: 'https://bitchord.kushagrasingh.in/icon.png',
        sizes: '512x512',
        type: 'image/png',
      });
    }

    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist,
      album: track.album || '',
      artwork,
    });
  }

  public updatePlaybackState(state: PlaybackState): void {
    if (!this.isAvailable()) return;

    switch (state) {
      case 'playing':
        navigator.mediaSession.playbackState = 'playing';
        break;
      case 'paused':
        navigator.mediaSession.playbackState = 'paused';
        break;
      case 'idle':
      case 'ended':
      case 'error':
        navigator.mediaSession.playbackState = 'none';
        break;
      default:
        break;
    }
  }

  public updatePositionState(duration: number, currentTime: number, playbackRate: number = 1.0): void {
    if (!this.isAvailable() || typeof navigator.mediaSession.setPositionState !== 'function') return;

    if (duration > 0 && !isNaN(duration) && currentTime >= 0 && !isNaN(currentTime)) {
      try {
        navigator.mediaSession.setPositionState({
          duration,
          playbackRate,
          position: Math.min(currentTime, duration),
        });
      } catch (err) {
        // Can throw if position exceeds duration
      }
    }
  }
}
