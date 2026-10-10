import { Track } from '../types/track.js';
import { RepeatMode } from '../types/player.js';
export declare class QueueManager {
    private currentTrack;
    private queue;
    private history;
    private originalQueue;
    private isShuffled;
    private repeatMode;
    setQueue(tracks: Track[], startIndex?: number): Track | null;
    getCurrentTrack(): Track | null;
    getUpcomingQueue(): readonly Track[];
    getHistory(): readonly Track[];
    getRepeatMode(): RepeatMode;
    setRepeatMode(mode: RepeatMode): void;
    isShuffleEnabled(): boolean;
    toggleShuffle(): boolean;
    private shuffleUpcoming;
    addTrack(track: Track): void;
    addNext(track: Track): void;
    removeTrack(index: number): Track | null;
    moveTrack(fromIndex: number, toIndex: number): boolean;
    peekNext(): Track | null;
    next(): Track | null;
    previous(): Track | null;
    clear(): void;
}
//# sourceMappingURL=queue-manager.d.ts.map