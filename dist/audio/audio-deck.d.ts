import { Track } from '../types/track.js';
import { AudioStream } from '../types/stream.js';
export interface DeckStateListeners {
    onTimeUpdate: (deck: AudioDeck, currentTime: number, duration: number) => void;
    onEnded: (deck: AudioDeck) => void;
    onWaiting: (deck: AudioDeck) => void;
    onPlaying: (deck: AudioDeck) => void;
    onError: (deck: AudioDeck, error: Event | string) => void;
    onReady: (deck: AudioDeck) => void;
}
export declare class AudioDeck {
    readonly id: 'A' | 'B';
    private context;
    private audioElement;
    private sourceNode;
    private destinationNode;
    private currentTrack;
    private currentStream;
    private listeners;
    private isPrepared;
    constructor(id: 'A' | 'B', context: AudioContext, destinationNode: GainNode);
    private connectSourceNode;
    private bindEvents;
    setListeners(listeners: Partial<DeckStateListeners>): void;
    load(track: Track, stream: AudioStream): Promise<void>;
    play(): Promise<void>;
    pause(): void;
    stop(): void;
    seek(seconds: number): void;
    setPlaybackRate(rate: number): void;
    getCurrentTime(): number;
    getDuration(): number;
    getTrack(): Track | null;
    getStream(): AudioStream | null;
    isPaused(): boolean;
    isReady(): boolean;
    /**
     * Calculates buffer health: buffered time ahead in seconds.
     */
    getBufferedSecondsAhead(): number;
    /**
     * Calculates ratio of total duration buffered (0.0 to 1.0).
     */
    getBufferedRatio(): number;
    reset(): void;
}
//# sourceMappingURL=audio-deck.d.ts.map