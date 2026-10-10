import { TypedEventEmitter } from '../utils/event-emitter.js';
import { AudioGraph } from '../audio/audio-graph.js';
import { StreamResolutionPipeline } from '../stream/stream-pipeline.js';
import { QueueManager } from './queue-manager.js';
import { MediaSessionManager } from './media-session.js';
export class AudioPlayerService extends TypedEventEmitter {
    audioGraph;
    pipeline;
    queueManager;
    mediaSession;
    state = 'idle';
    crossfadeDuration = 4.0; // BitChord default crossfade duration (0-12s)
    enableAutoPreload = true;
    preloadLeadSeconds = 15.0;
    nextTrackPreloaded = false;
    crossfadeTriggeredForCurrent = false;
    progressInterval = null;
    constructor(pipeline, audioGraph, options) {
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
    wireDeckListeners(deck) {
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
    setState(newState) {
        if (this.state !== newState) {
            this.state = newState;
            this.emit('stateChange', newState);
            this.mediaSession.updatePlaybackState(newState);
            if (newState === 'playing') {
                this.startProgressPolling();
            }
            else if (newState === 'paused' || newState === 'idle' || newState === 'ended' || newState === 'error') {
                this.stopProgressPolling();
            }
        }
    }
    getState() {
        return this.state;
    }
    // --- Transport Controls ---
    async playTrack(track, forceBypassCache = false) {
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
        }
        catch (err) {
            console.error('[AudioPlayerService] Playback failed for track:', track.title, err);
            this.setState('error');
            this.emit('error', err instanceof Error ? err : new Error(String(err)), track);
            throw err;
        }
    }
    async resume() {
        await this.audioGraph.contextManager.unlock();
        const activeDeck = this.audioGraph.getActiveDeck();
        if (activeDeck.getTrack()) {
            await activeDeck.play();
            this.setState('playing');
        }
        else {
            const next = this.queueManager.getCurrentTrack() || this.queueManager.peekNext();
            if (next) {
                await this.playTrack(next);
            }
        }
    }
    pause() {
        this.audioGraph.getActiveDeck().pause();
        this.audioGraph.getInactiveDeck().pause();
        this.setState('paused');
    }
    stop() {
        this.audioGraph.deckA.stop();
        this.audioGraph.deckB.stop();
        this.audioGraph.crossfader.cancelScheduledFades();
        this.setState('idle');
    }
    seek(seconds) {
        const activeDeck = this.audioGraph.getActiveDeck();
        activeDeck.seek(seconds);
        this.mediaSession.updatePositionState(activeDeck.getDuration(), seconds);
    }
    setVolume(volume) {
        this.audioGraph.setMasterVolume(volume);
        this.emit('volumeChange', this.audioGraph.getMasterVolume(), this.audioGraph.getIsMuted());
    }
    getVolume() {
        return this.audioGraph.getMasterVolume();
    }
    setMuted(muted) {
        this.audioGraph.setMuted(muted);
        this.emit('volumeChange', this.audioGraph.getMasterVolume(), muted);
    }
    setPlaybackRate(rate) {
        this.audioGraph.deckA.setPlaybackRate(rate);
        this.audioGraph.deckB.setPlaybackRate(rate);
        const activeDeck = this.audioGraph.getActiveDeck();
        this.mediaSession.updatePositionState(activeDeck.getDuration(), activeDeck.getCurrentTime(), rate);
    }
    setCrossfadeDuration(seconds) {
        this.crossfadeDuration = Math.max(0, Math.min(12, seconds));
    }
    getCrossfadeDuration() {
        return this.crossfadeDuration;
    }
    // --- Queue Navigation & Crossfading ---
    async setQueue(tracks, startIndex = 0, autoplay = true) {
        const track = this.queueManager.setQueue(tracks, startIndex);
        this.emit('queueChange', [...this.queueManager.getUpcomingQueue()], [...this.queueManager.getHistory()]);
        if (track && autoplay) {
            await this.playTrack(track);
        }
    }
    async skipToNext(useCrossfade = true) {
        const nextTrack = this.queueManager.next();
        this.emit('queueChange', [...this.queueManager.getUpcomingQueue()], [...this.queueManager.getHistory()]);
        if (!nextTrack) {
            this.stop();
            this.setState('ended');
            return;
        }
        if (useCrossfade && this.crossfadeDuration > 0 && this.state === 'playing') {
            await this.crossfadeToTrack(nextTrack, this.crossfadeDuration);
        }
        else {
            await this.playTrack(nextTrack);
        }
    }
    async skipToPrevious() {
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
    async crossfadeToTrack(nextTrack, durationSec) {
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
        }
        catch (err) {
            console.warn('[AudioPlayerService] Crossfade failed, falling back to direct play:', err);
            await this.playTrack(nextTrack);
        }
    }
    // --- Auto-Preload and End Detection ---
    handlePlaybackProgress(currentTime, duration) {
        if (duration <= 0)
            return;
        const remaining = duration - currentTime;
        // 1. Preload next track when within preload lead time
        if (this.enableAutoPreload &&
            !this.nextTrackPreloaded &&
            remaining <= this.preloadLeadSeconds + this.crossfadeDuration) {
            this.preloadNextTrack();
        }
        // 2. Automatically trigger crossfade when within crossfade duration
        if (this.crossfadeDuration > 0 &&
            !this.crossfadeTriggeredForCurrent &&
            remaining <= this.crossfadeDuration &&
            remaining > 0) {
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
        const progress = {
            currentTime,
            duration,
            bufferedTime: activeDeck.getBufferedSecondsAhead(),
            bufferedPercentage: activeDeck.getBufferedRatio(),
            isCrossfading: this.audioGraph.crossfader.getIsCrossfading(),
        };
        this.emit('progress', progress);
        this.mediaSession.updatePositionState(duration, currentTime);
    }
    async preloadNextTrack() {
        const nextTrack = this.queueManager.peekNext();
        if (!nextTrack)
            return;
        this.nextTrackPreloaded = true;
        const inactiveDeck = this.audioGraph.getInactiveDeck();
        try {
            const resolution = await this.pipeline.resolve(nextTrack);
            await inactiveDeck.load(nextTrack, resolution.stream);
        }
        catch (err) {
            console.warn('[AudioPlayerService] Failed to preload next track:', err);
            this.nextTrackPreloaded = false;
        }
    }
    handleTrackEnded() {
        const nextTrack = this.queueManager.next();
        this.emit('queueChange', [...this.queueManager.getUpcomingQueue()], [...this.queueManager.getHistory()]);
        if (nextTrack) {
            this.playTrack(nextTrack);
        }
        else {
            this.setState('ended');
        }
    }
    handleDeckError(failedDeck, error) {
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
    emitTelemetry() {
        const activeDeck = this.audioGraph.getActiveDeck();
        const stream = activeDeck.getStream();
        if (!stream)
            return;
        const telemetry = {
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
            dspChainActive: this.audioGraph.equalizer.isEnabled() ||
                this.audioGraph.spatializer.getOptions().enabled ||
                this.audioGraph.normalizer.getOptions().enabled,
            activeDeck: activeDeck.id,
        };
        this.emit('telemetry', telemetry);
    }
    getAudioGraph() {
        return this.audioGraph;
    }
    getPipeline() {
        return this.pipeline;
    }
    getQueueManager() {
        return this.queueManager;
    }
    getCurrentTrack() {
        return this.audioGraph.getActiveDeck().getTrack();
    }
    getCurrentStream() {
        return this.audioGraph.getActiveDeck().getStream();
    }
    getCurrentTime() {
        return this.audioGraph.getActiveDeck().getCurrentTime();
    }
    getDuration() {
        return this.audioGraph.getActiveDeck().getDuration();
    }
    // --- Polling Timers ---
    startProgressPolling() {
        if (this.progressInterval)
            return;
        this.progressInterval = setInterval(() => {
            if (this.state === 'playing') {
                this.emitTelemetry();
            }
        }, 1000);
    }
    stopProgressPolling() {
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
            this.progressInterval = null;
        }
    }
    destroy() {
        this.stop();
        this.stopProgressPolling();
        this.audioGraph.deckA.reset();
        this.audioGraph.deckB.reset();
        this.audioGraph.contextManager.close();
        this.removeAllListeners();
    }
}
//# sourceMappingURL=audio-player-service.js.map