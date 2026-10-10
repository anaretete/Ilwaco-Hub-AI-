export class AudioDeck {
    id;
    context;
    audioElement;
    sourceNode = null;
    destinationNode;
    currentTrack = null;
    currentStream = null;
    listeners = {};
    isPrepared = false;
    constructor(id, context, destinationNode) {
        this.id = id;
        this.context = context;
        this.destinationNode = destinationNode;
        // Initialize HTML5 Audio element
        this.audioElement = new Audio();
        this.audioElement.crossOrigin = 'anonymous';
        this.audioElement.preload = 'auto';
        this.bindEvents();
    }
    connectSourceNode() {
        if (!this.sourceNode) {
            try {
                this.sourceNode = this.context.createMediaElementSource(this.audioElement);
                this.sourceNode.connect(this.destinationNode);
            }
            catch (err) {
                console.warn(`[Deck ${this.id}] MediaElementSource connection note:`, err);
            }
        }
    }
    bindEvents() {
        this.audioElement.addEventListener('timeupdate', () => {
            this.listeners.onTimeUpdate?.(this, this.audioElement.currentTime, this.audioElement.duration || 0);
        });
        this.audioElement.addEventListener('ended', () => {
            this.listeners.onEnded?.(this);
        });
        this.audioElement.addEventListener('waiting', () => {
            this.listeners.onWaiting?.(this);
        });
        this.audioElement.addEventListener('playing', () => {
            this.listeners.onPlaying?.(this);
        });
        this.audioElement.addEventListener('canplay', () => {
            this.isPrepared = true;
            this.listeners.onReady?.(this);
        });
        this.audioElement.addEventListener('error', (e) => {
            this.listeners.onError?.(this, e);
        });
    }
    setListeners(listeners) {
        this.listeners = listeners;
    }
    async load(track, stream) {
        this.currentTrack = track;
        this.currentStream = stream;
        this.isPrepared = false;
        this.connectSourceNode();
        this.audioElement.src = stream.url;
        this.audioElement.load();
    }
    async play() {
        this.connectSourceNode();
        try {
            await this.audioElement.play();
        }
        catch (err) {
            // Autoplay or user gesture rejection
            console.warn(`[Deck ${this.id}] Audio play was interrupted or pending user gesture:`, err);
            throw err;
        }
    }
    pause() {
        this.audioElement.pause();
    }
    stop() {
        this.audioElement.pause();
        this.audioElement.currentTime = 0;
    }
    seek(seconds) {
        if (isNaN(seconds) || seconds < 0)
            return;
        const dur = this.audioElement.duration || Infinity;
        this.audioElement.currentTime = Math.min(seconds, dur);
    }
    setPlaybackRate(rate) {
        const clampedRate = Math.max(0.5, Math.min(2.0, rate));
        this.audioElement.playbackRate = clampedRate;
    }
    getCurrentTime() {
        return this.audioElement.currentTime || 0;
    }
    getDuration() {
        return this.audioElement.duration || this.currentTrack?.duration || 0;
    }
    getTrack() {
        return this.currentTrack;
    }
    getStream() {
        return this.currentStream;
    }
    isPaused() {
        return this.audioElement.paused;
    }
    isReady() {
        return this.isPrepared;
    }
    /**
     * Calculates buffer health: buffered time ahead in seconds.
     */
    getBufferedSecondsAhead() {
        const cur = this.audioElement.currentTime;
        const ranges = this.audioElement.buffered;
        for (let i = 0; i < ranges.length; i++) {
            if (ranges.start(i) <= cur && ranges.end(i) >= cur) {
                return ranges.end(i) - cur;
            }
        }
        return 0;
    }
    /**
     * Calculates ratio of total duration buffered (0.0 to 1.0).
     */
    getBufferedRatio() {
        const dur = this.audioElement.duration;
        if (!dur || isNaN(dur) || dur <= 0)
            return 0;
        const ranges = this.audioElement.buffered;
        if (ranges.length === 0)
            return 0;
        return Math.min(1.0, ranges.end(ranges.length - 1) / dur);
    }
    reset() {
        this.audioElement.pause();
        this.audioElement.removeAttribute('src');
        this.audioElement.load();
        this.currentTrack = null;
        this.currentStream = null;
        this.isPrepared = false;
    }
}
//# sourceMappingURL=audio-deck.js.map