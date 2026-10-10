import { Track } from './track.js';
import { AudioStream } from './stream.js';
import { AudioTelemetry } from './audio-dsp.js';
export type PlaybackState = 'idle' | 'loading' | 'ready' | 'playing' | 'paused' | 'buffering' | 'ended' | 'error';
export type RepeatMode = 'off' | 'all' | 'one';
export interface PlaybackProgress {
    currentTime: number;
    duration: number;
    bufferedTime: number;
    bufferedPercentage: number;
    isCrossfading: boolean;
}
export type PlayerEvents = {
    stateChange: (state: PlaybackState) => void;
    trackChange: (track: Track | null, stream: AudioStream | null) => void;
    progress: (progress: PlaybackProgress) => void;
    queueChange: (queue: Track[], history: Track[]) => void;
    telemetry: (telemetry: AudioTelemetry) => void;
    volumeChange: (volume: number, muted: boolean) => void;
    crossfadeStart: (fromTrack: Track | null, toTrack: Track, duration: number) => void;
    crossfadeEnd: (currentTrack: Track) => void;
    error: (error: Error, track?: Track) => void;
};
//# sourceMappingURL=player.d.ts.map