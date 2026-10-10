import { Track } from '../types/track.js';
import { PlaybackState } from '../types/player.js';
export interface MediaSessionCallbacks {
    onPlay: () => void;
    onPause: () => void;
    onPrevious: () => void;
    onNext: () => void;
    onSeekTo: (details: {
        seekTime: number;
    }) => void;
    onSeekBackward: (details: {
        seekOffset?: number;
    }) => void;
    onSeekForward: (details: {
        seekOffset?: number;
    }) => void;
}
export declare class MediaSessionManager {
    private callbacks;
    constructor(callbacks?: Partial<MediaSessionCallbacks>);
    private isAvailable;
    private registerHandlers;
    updateTrack(track: Track | null): void;
    updatePlaybackState(state: PlaybackState): void;
    updatePositionState(duration: number, currentTime: number, playbackRate?: number): void;
}
//# sourceMappingURL=media-session.d.ts.map