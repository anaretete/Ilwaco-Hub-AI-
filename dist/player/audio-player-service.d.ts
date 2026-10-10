import { Track } from '../types/track.js';
import { AudioStream } from '../types/stream.js';
import { PlaybackState, PlayerEvents } from '../types/player.js';
import { TypedEventEmitter } from '../utils/event-emitter.js';
import { AudioGraph } from '../audio/audio-graph.js';
import { StreamResolutionPipeline } from '../stream/stream-pipeline.js';
import { QueueManager } from './queue-manager.js';
export interface PlayerOptions {
    crossfadeDurationSeconds?: number;
    enableAutoPreload?: boolean;
    preloadLeadSeconds?: number;
}
export declare class AudioPlayerService extends TypedEventEmitter<PlayerEvents> {
    private audioGraph;
    private pipeline;
    private queueManager;
    private mediaSession;
    private state;
    private crossfadeDuration;
    private enableAutoPreload;
    private preloadLeadSeconds;
    private nextTrackPreloaded;
    private crossfadeTriggeredForCurrent;
    private progressInterval;
    constructor(pipeline?: StreamResolutionPipeline, audioGraph?: AudioGraph, options?: PlayerOptions);
    private wireDeckListeners;
    private setState;
    getState(): PlaybackState;
    playTrack(track: Track, forceBypassCache?: boolean): Promise<void>;
    resume(): Promise<void>;
    pause(): void;
    stop(): void;
    seek(seconds: number): void;
    setVolume(volume: number): void;
    getVolume(): number;
    setMuted(muted: boolean): void;
    setPlaybackRate(rate: number): void;
    setCrossfadeDuration(seconds: number): void;
    getCrossfadeDuration(): number;
    setQueue(tracks: Track[], startIndex?: number, autoplay?: boolean): Promise<void>;
    skipToNext(useCrossfade?: boolean): Promise<void>;
    skipToPrevious(): Promise<void>;
    /**
     * Smoothly crossfades between current active deck and next track loaded onto the inactive deck.
     */
    private crossfadeToTrack;
    private handlePlaybackProgress;
    private preloadNextTrack;
    private handleTrackEnded;
    private handleDeckError;
    emitTelemetry(): void;
    getAudioGraph(): AudioGraph;
    getPipeline(): StreamResolutionPipeline;
    getQueueManager(): QueueManager;
    getCurrentTrack(): Track | null;
    getCurrentStream(): AudioStream | null;
    getCurrentTime(): number;
    getDuration(): number;
    private startProgressPolling;
    private stopProgressPolling;
    destroy(): void;
}
//# sourceMappingURL=audio-player-service.d.ts.map