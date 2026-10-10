export class MediaSessionManager {
    callbacks = {};
    constructor(callbacks) {
        if (callbacks) {
            this.callbacks = callbacks;
        }
        this.registerHandlers();
    }
    isAvailable() {
        return typeof navigator !== 'undefined' && 'mediaSession' in navigator;
    }
    registerHandlers() {
        if (!this.isAvailable())
            return;
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
        }
        catch (err) {
            console.warn('[MediaSessionManager] Failed to register action handlers:', err);
        }
    }
    updateTrack(track) {
        if (!this.isAvailable())
            return;
        if (!track) {
            navigator.mediaSession.metadata = null;
            return;
        }
        const artwork = (track.artwork || []).map((art) => ({
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
    updatePlaybackState(state) {
        if (!this.isAvailable())
            return;
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
    updatePositionState(duration, currentTime, playbackRate = 1.0) {
        if (!this.isAvailable() || typeof navigator.mediaSession.setPositionState !== 'function')
            return;
        if (duration > 0 && !isNaN(duration) && currentTime >= 0 && !isNaN(currentTime)) {
            try {
                navigator.mediaSession.setPositionState({
                    duration,
                    playbackRate,
                    position: Math.min(currentTime, duration),
                });
            }
            catch (err) {
                // Can throw if position exceeds duration
            }
        }
    }
}
//# sourceMappingURL=media-session.js.map