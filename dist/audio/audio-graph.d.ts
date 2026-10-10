import { AudioContextManager } from './audio-context-manager.js';
import { Crossfader } from './crossfader.js';
import { AudioDeck } from './audio-deck.js';
import { DynamicEqualizer } from './equalizer.js';
import { StereoSpatializer } from './spatializer.js';
import { LoudnessNormalizer } from './loudness-normalizer.js';
import { AudioAnalyzer } from './analyzer.js';
export declare class AudioGraph {
    readonly contextManager: AudioContextManager;
    readonly crossfader: Crossfader;
    readonly deckA: AudioDeck;
    readonly deckB: AudioDeck;
    readonly equalizer: DynamicEqualizer;
    readonly spatializer: StereoSpatializer;
    readonly normalizer: LoudnessNormalizer;
    readonly masterGain: GainNode;
    readonly analyzer: AudioAnalyzer;
    private isMuted;
    private savedVolume;
    constructor();
    private wireGraph;
    setMasterVolume(volume: number): void;
    getMasterVolume(): number;
    setMuted(muted: boolean): void;
    getIsMuted(): boolean;
    getActiveDeck(): AudioDeck;
    getInactiveDeck(): AudioDeck;
    getPipelineStatus(): {
        contextState: AudioContextState | 'uninitialized';
        sampleRate: number;
        activeDeck: 'A' | 'B';
        equalizerActive: boolean;
        spatializerActive: boolean;
        normalizerActive: boolean;
        isCrossfading: boolean;
    };
}
//# sourceMappingURL=audio-graph.d.ts.map