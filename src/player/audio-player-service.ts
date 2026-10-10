import { Track } from '../types/track.js';
import { AudioStream } from '../types/stream.js';
import { PlaybackState, PlayerEvents, PlaybackProgress, RepeatMode } from '../types/player.js';
import { AudioTelemetry } from '../types/audio-dsp.js';
import { TypedEventEmitter } from '../utils/event-emitter.js';
import { AudioGraph } from '../audio/audio-graph.js';
import { AudioDeck } from '../audio/audio-deck.js';
import { StreamResolutionPipeline } from '../stream/stream-pipeline.js';
import { QueueManager } from './queue-manager.js';
import { MediaSessionManager } from './media-session.js';

export interface PlayerOptions {
  crossfadeDurationSeconds?: number; // 0 to 12 seconds (default 4s)
  enableAutoPreload?: boolean;
  preloadLeadSeconds?: number; // preload next track when remaining <= this (default 15s)
}

export class AudioPlayerService extends TypedEventEmitter<PlayerEvents> {
  private audioGraph: AudioGraph;
  private pipeline: StreamResolutionPipeline;
  private queueManager: QueueManager;
  private mediaSession: MediaSessionManager;

  private state: PlaybackState = 'idle';
  private crossfadeDuration: number = 4.0; // BitChord default crossfade duration (0-12s)
  private enableAutoPreload: boolean = true;
  private preloadLeadSeconds: number = 15.0;

  private nextTrackPreloaded: boolean = false;
  private crossfadeTriggeredForCurrent: boolean = false;
  private progressInterval: any = null;

  constructor(
    pipeline?: StreamResolutionPipeline,
    audioGraph?: AudioGraph,
    options?: PlayerOptions
  ) {
    super();

    this.pipeline = pipeline || new StreamResolutionPipeline();
    this.audioGraph = audioGraph || new AudioGraph();
    this.queueManager = new QueueManager();

    if (options?.crossfadeDurationSeconds !== undefined) {
      this.setCrossfadeDuration(options.crossfadeDurationSeconds);
    }
    if (options?.enableAutoPreload !== undefined) {
      this.enableAutoPreload = options.enableAutoPreload;
    }
    if (options?.preloadLeadSeconds !== undefined) {
      this.preloadLeadSeconds = options.preloadLeadSeconds;
    }

    this.mediaSession = new MediaSessionManager({
      onPlay: () => this.resume(),
      onPause: () => this.pause(),
      onPrevious: () => this.skipToPrevious(),
      onNext: () => this.skipToNext(),
      onSeekTo: ({ seekTime }) => this.seek(seekTime),
      onSeekBackward: ({ seekOffset }) => this.seek(this.getCurrentTime() - (seekOffset || 10)),
      onSeekForward: ({ seekOffset }) => this.seek(this.getCurrentTime() + (seekOffset || 10)),
    });

    this.wireDeckListeners(this.audioGraph.deckA);
    this.wireDeckListeners(this.audioGraph.deckB);
  }

  private wireDeckListeners(deck: AudioDeck): void {
    deck.setListeners({
      onTimeUpdate: (activeDeck, currentTime, duration) => {
        if (activeDeck === this.audioGraph.getActiveDeck()) {
          this.handlePlaybackProgress(currentTime, duration);
        }
      },
      onEnded: (deckEnded) => {
        if (deckEnded === this.audioGraph.getActiveDeck() && !this.audioGraph.crossfader.getIsCrossfading()) {
          this.handleTrackEnded();
        }
      },
      onWaiting: (activeDeck) => {
        if (activeDeck === this.audioGraph.getActiveDeck()) {
          this.setState('buffering');
        }
      },
      onPlaying: (activeDeck) => {
        if (activeDeck === this.audioGraph.getActiveDeck()) {
          this.setState('playing');
        }
      },
      onReady: (activeDeck) => {
        if (activeDeck === this.audioGraph.getActiveDeck() && this.state === 'loading') {
          this.setState('ready');
        }
      },
      onError: (failedDeck, error) => {
        this.handleDeckError(failedDeck, error);
      },
    });
  }

  // --- State & Lifecycle ---

  private setState(newState: PlaybackState): void {
    if (this.state !== newState) {
      this.state = newState;
      this.emit('stateChange', newState);
      this.mediaSession.updatePlaybackState(newState);

      if (newState === 'playing') {
        this.startProgressPolling();
      } else if (newState === 'paused' || newState === 'idle' || newState === 'ended' || newState === 'error') {
        this.stopProgressPolling();
      }
    }
  }

  public getState(): PlaybackState {
    return this.state;
  }

  // --- Transport Controls ---

  public async playTrack(track: Track, forceBypassCache: boolean = false): Promise<void> {
    await this.audioGraph.contextManager.unlock();
    this.setState('loading');

    // Reset crossfade tracking flags
    this.nextTrackPreloaded = false;
    this.crossfadeTriggeredForCurrent = false;

    try {
      // 1. Resolve stream via pipeline
      const resolution = await this.pipeline.resolve(track, { forceBypassCache });
      const stream = resolution.stream;

      // 2. Select active deck and load stream
      const activeDeck = this.audioGraph.getActiveDeck();
      this.audioGraph.crossfader.setImmediateDeck(activeDeck.id);

      // Set Loudness Normalizer LUFS
      this.audioGraph.normalizer.setTrackLufs(stream.loudnessLufs);

      await activeDeck.load(track, stream);
      await activeDeck.play();

      this.setState('playing');
      this.emit('trackChange', track, stream);
      this.mediaSession.updateTrack(track);
      this.emitTelemetry();
    } catch (err: any) {
      console.error('[AudioPlayerService] Playback failed for track:', track.title, err);
      this.setState('error');
      this.emit('error', err instanceof Error ? err : new Error(String(err)), track);
      throw err;
    }
  }

  public async resume(): Promise<void> {
    await this.audioGraph.contextManager.unlock();
    const activeDeck = this.audioGraph.getActiveDeck();
    if (activeDeck.getTrack()) {
      await activeDeck.play();
      this.setState('playing');
    } else {
      const next = this.queueManager.getCurrentTrack() || this.queueManager.peekNext();
      if (next) {
        await this.playTrack(next);
      }
    }
  }

  public pause(): void {
    this.audioGraph.getActiveDeck().pause();
    this.audioGraph.getInactiveDeck().pause();
    this.setState('paused');
  }

  public stop(): void {
    this.audioGraph.deckA.stop();
    this.audioGraph.deckB.stop();
    this.audioGraph.crossfader.cancelScheduledFades();
    this.setState('idle');
  }

  public seek(seconds: number): void {
    const activeDeck = this.audioGraph.getActiveDeck();
    activeDeck.seek(seconds);
    this.mediaSession.updatePositionState(activeDeck.getDuration(), seconds);
  }

  public setVolume(volume: number): void {
    this.audioGraph.setMasterVolume(volume);
    this.emit('volumeChange', this.audioGraph.getMasterVolume(), this.audioGraph.getIsMuted());
  }

  public getVolume(): number {
    return this.audioGraph.getMasterVolume();
  }

  public setMuted(muted: boolean): void {
    this.audioGraph.setMuted(muted);
    this.emit('volumeChange', this.audioGraph.getMasterVolume(), muted);
  }

  public setPlaybackRate(rate: number): void {
    this.audioGraph.deckA.setPlaybackRate(rate);
    this.audioGraph.deckB.setPlaybackRate(rate);
    const activeDeck = this.audioGraph.getActiveDeck();
    this.mediaSession.updatePositionState(activeDeck.getDuration(), activeDeck.getCurrentTime(), rate);
  }

  public setCrossfadeDuration(seconds: number): void {
    this.crossfadeDuration = Math.max(0, Math.min(12, seconds));
  }

  public getCrossfadeDuration(): number {
    return this.crossfadeDuration;
  }

  // --- Queue Navigation & Crossfading ---

  public async setQueue(tracks: Track[], startIndex: number = 0, autoplay: boolean = true): Promise<void> {
    const track = this.queueManager.setQueue(tracks, startIndex);
    this.emit('queueChange', [...this.queueManager.getUpcomingQueue()], [...this.queueManager.getHistory()]);

    if (track && autoplay) {
      await this.playTrack(track);
    }
  }

  public async skipToNext(useCrossfade: boolean = true): Promise<void> {
    const nextTrack = this.queueManager.next();
    this.emit('queueChange', [...this.queueManager.getUpcomingQueue()], [...this.queueManager.getHistory()]);

    if (!nextTrack) {
      this.stop();
      this.setState('ended');
      return;
    }

    if (useCrossfade && this.crossfadeDuration > 0 && this.state === 'playing') {
      await this.crossfadeToTrack(nextTrack, this.crossfadeDuration);
    } else {
      await this.playTrack(nextTrack);
    }
  }

  public async skipToPrevious(): Promise<void> {
    // If more than 3 seconds into the track, restart it (standard player behavior)
    if (this.getCurrentTime() > 3.0) {
      this.seek(0);
      return;
    }

    const prevTrack = this.queueManager.previous();
    this.emit('queueChange', [...this.queueManager.getUpcomingQueue()], [...this.queueManager.getHistory()]);

    if (prevTrack) {
      await this.playTrack(prevTrack);
    }
  }

  /**
   * Smoothly crossfades between current active deck and next track loaded onto the inactive deck.
   */
  private async crossfadeToTrack(nextTrack: Track, durationSec: number): Promise<void> {
    const fromDeck = this.audioGraph.getActiveDeck();
    const toDeck = this.audioGraph.getInactiveDeck();
    const fromTrack = fromDeck.getTrack();

    try {
      // 1. Resolve target stream if not already preloaded with same track
      let targetStream = toDeck.getStream();
      if (!toDeck.isReady() || toDeck.getTrack()?.id !== nextTrack.id) {
        const resolution = await this.pipeline.resolve(nextTrack);
        targetStream = resolution.stream;
        await toDeck.load(nextTrack, targetStream);
      }

      // 2. Adjust normalizer for incoming stream
      this.audioGraph.normalizer.setTrackLufs(targetStream?.loudnessLufs);

      // 3. Start target deck playing
      await toDeck.play();

      this.emit('crossfadeStart', fromTrack, nextTrack, durationSec);

      // 4. Trigger equal-power Web Audio crossfade
      this.audioGraph.crossfader.startCrossfade(toDeck.id, durationSec, () => {
        // Upon crossfade completion:
        fromDeck.stop();
        fromDeck.reset();
        this.nextTrackPreloaded = false;
        this.crossfadeTriggeredForCurrent = false;

        this.emit('crossfadeEnd', nextTrack);
        this.emit('trackChange', nextTrack, toDeck.getStream());
        this.mediaSession.updateTrack(nextTrack);
        this.emitTelemetry();
      });
    } catch (err) {
      console.warn('[AudioPlayerService] Crossfade failed, falling back to direct play:', err);
      await this.playTrack(nextTrack);
    }
  }

  // --- Auto-Preload and End Detection ---

  private handlePlaybackProgress(currentTime: number, duration: number): void {
    if (duration <= 0) return;

    const remaining = duration - currentTime;

    // 1. Preload next track when within preload lead time
    if (
      this.enableAutoPreload &&
      !this.nextTrackPreloaded &&
      remaining <= this.preloadLeadSeconds + this.crossfadeDuration
    ) {
      this.preloadNextTrack();
    }

    // 2. Automatically trigger crossfade when within crossfade duration
    if (
      this.crossfadeDuration > 0 &&
      !this.crossfadeTriggeredForCurrent &&
      remaining <= this.crossfadeDuration &&
      remaining > 0
    ) {
      const nextTrack = this.queueManager.peekNext();
      if (nextTrack) {
        this.crossfadeTriggeredForCurrent = true;
        this.queueManager.next(); // Advance queue
        this.emit('queueChange', [...this.queueManager.getUpcomingQueue()], [...this.queueManager.getHistory()]);
        this.crossfadeToTrack(nextTrack, remaining);
      }
    }

    // 3. Emit progress
    const activeDeck = this.audioGraph.getActiveDeck();
    const progress: PlaybackProgress = {
      currentTime,
      duration,
      bufferedTime: activeDeck.getBufferedSecondsAhead(),
      bufferedPercentage: activeDeck.getBufferedRatio(),
      isCrossfading: this.audioGraph.crossfader.getIsCrossfading(),
    };
    this.emit('progress', progress);
    this.mediaSession.updatePositionState(duration, currentTime);
  }

  private async preloadNextTrack(): Promise<void> {
    const nextTrack = this.queueManager.peekNext();
    if (!nextTrack) return;

    this.nextTrackPreloaded = true;
    const inactiveDeck = this.audioGraph.getInactiveDeck();

    try {
      const resolution = await this.pipeline.resolve(nextTrack);
      await inactiveDeck.load(nextTrack, resolution.stream);
    } catch (err) {
      console.warn('[AudioPlayerService] Failed to preload next track:', err);
      this.nextTrackPreloaded = false;
    }
  }

  private handleTrackEnded(): void {
    const nextTrack = this.queueManager.next();
    this.emit('queueChange', [...this.queueManager.getUpcomingQueue()], [...this.queueManager.getHistory()]);

    if (nextTrack) {
      this.playTrack(nextTrack);
    } else {
      this.setState('ended');
    }
  }

  private handleDeckError(failedDeck: AudioDeck, error: Event | string): void {
    const track = failedDeck.getTrack();
    console.error(`[AudioPlayerService] Error on Deck ${failedDeck.id}:`, error);

    if (track) {
      // Invalidate stream cache on playback error
      this.pipeline.invalidateCache(track.id);

      // Attempt recovery once if active deck failed
      if (failedDeck === this.audioGraph.getActiveDeck()) {
        console.warn(`[AudioPlayerService] Attempting recovery for track "${track.title}"...`);
        this.playTrack(track, true).catch((retryErr) => {
          this.setState('error');
          this.emit('error', retryErr instanceof Error ? retryErr : new Error(String(retryErr)), track);
        });
        return;
      }
    }

    this.setState('error');
    this.emit('error', new Error(`Playback error on Deck ${failedDeck.id}`), track || undefined);
  }

  // --- Telemetry & Stats for Nerds ---

  public emitTelemetry(): void {
    const activeDeck = this.audioGraph.getActiveDeck();
    const stream = activeDeck.getStream();
    if (!stream) return;

    const telemetry: AudioTelemetry = {
      sourceName: stream.sourceName,
      codec: stream.codec,
      bitrateKbps: stream.bitrate,
      sampleRateHz: stream.sampleRate,
      bitDepthBits: stream.bitDepth,
      channels: stream.channels,
      isLossless: stream.isLossless,
      currentLufs: stream.loudnessLufs ?? -14.0,
      bufferHealthSeconds: activeDeck.getBufferedSecondsAhead(),
      bufferHealthRatio: activeDeck.getBufferedRatio(),
      latencyMs: Math.round(this.audioGraph.contextManager.getContext().baseLatency * 1000) || 10,
      dspChainActive:
        this.audioGraph.equalizer.isEnabled() ||
        this.audioGraph.spatializer.getOptions().enabled ||
        this.audioGraph.normalizer.getOptions().enabled,
      activeDeck: activeDeck.id,
    };

    this.emit('telemetry', telemetry);
  }

  public getAudioGraph(): AudioGraph {
    return this.audioGraph;
  }

  public getPipeline(): StreamResolutionPipeline {
    return this.pipeline;
  }

  public getQueueManager(): QueueManager {
    return this.queueManager;
  }

  public getCurrentTrack(): Track | null {
    return this.audioGraph.getActiveDeck().getTrack();
  }

  public getCurrentStream(): AudioStream | null {
    return this.audioGraph.getActiveDeck().getStream();
  }

  public getCurrentTime(): number {
    return this.audioGraph.getActiveDeck().getCurrentTime();
  }

  public getDuration(): number {
    return this.audioGraph.getActiveDeck().getDuration();
  }

  // --- Polling Timers ---

  private startProgressPolling(): void {
    if (this.progressInterval) return;
    this.progressInterval = setInterval(() => {
      if (this.state === 'playing') {
        this.emitTelemetry();
      }
    }, 1000);
  }

  private stopProgressPolling(): void {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
  }

  public destroy(): void {
    this.stop();
    this.stopProgressPolling();
    this.audioGraph.deckA.reset();
    this.audioGraph.deckB.reset();
    this.audioGraph.contextManager.close();
    this.removeAllListeners();
  }
}
