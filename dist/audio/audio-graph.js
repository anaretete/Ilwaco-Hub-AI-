import { AudioContextManager } from './audio-context-manager.js';
import { Crossfader } from './crossfader.js';
import { AudioDeck } from './audio-deck.js';
import { DynamicEqualizer } from './equalizer.js';
import { StereoSpatializer } from './spatializer.js';
import { LoudnessNormalizer } from './loudness-normalizer.js';
import { AudioAnalyzer } from './analyzer.js';
export class AudioGraph {
    contextManager;
    crossfader;
    deckA;
    deckB;
    equalizer;
    spatializer;
    normalizer;
    masterGain;
    analyzer;
    isMuted = false;
    savedVolume = 1.0;
    constructor() {
        this.contextManager = new AudioContextManager();
        const ctx = this.contextManager.getContext();
        // 1. Crossfader
        this.crossfader = new Crossfader(ctx);
        // 2. Decks A and B
        this.deckA = new AudioDeck('A', ctx, this.crossfader.deckAGainNode);
        this.deckB = new AudioDeck('B', ctx, this.crossfader.deckBGainNode);
        // 3. DSP chain
        this.equalizer = new DynamicEqualizer(ctx);
        this.spatializer = new StereoSpatializer(ctx);
        this.normalizer = new LoudnessNormalizer(ctx);
        this.masterGain = ctx.createGain();
        this.analyzer = new AudioAnalyzer(ctx);
        this.wireGraph(ctx);
    }
    wireGraph(ctx) {
        // Crossfader Output -> Equalizer -> Spatializer -> Loudness Normalizer -> Master Gain -> Analyzer -> Destination
        this.crossfader.outputNode.connect(this.equalizer.inputNode);
        this.equalizer.outputNode.connect(this.spatializer.inputNode);
        this.spatializer.outputNode.connect(this.normalizer.inputNode);
        this.normalizer.outputNode.connect(this.masterGain);
        this.masterGain.connect(this.analyzer.getNode());
        this.analyzer.getNode().connect(ctx.destination);
    }
    setMasterVolume(volume) {
        const clamped = Math.max(0, Math.min(1, volume));
        this.savedVolume = clamped;
        if (!this.isMuted) {
            const ctx = this.contextManager.getContext();
            this.masterGain.gain.setTargetAtTime(clamped, ctx.currentTime, 0.02);
        }
    }
    getMasterVolume() {
        return this.savedVolume;
    }
    setMuted(muted) {
        this.isMuted = muted;
        const ctx = this.contextManager.getContext();
        const targetGain = muted ? 0 : this.savedVolume;
        this.masterGain.gain.setTargetAtTime(targetGain, ctx.currentTime, 0.02);
    }
    getIsMuted() {
        return this.isMuted;
    }
    getActiveDeck() {
        return this.crossfader.getActiveDeck() === 'A' ? this.deckA : this.deckB;
    }
    getInactiveDeck() {
        return this.crossfader.getActiveDeck() === 'A' ? this.deckB : this.deckA;
    }
    getPipelineStatus() {
        return {
            contextState: this.contextManager.getState(),
            sampleRate: this.contextManager.getSampleRate(),
            activeDeck: this.crossfader.getActiveDeck(),
            equalizerActive: this.equalizer.isEnabled(),
            spatializerActive: this.spatializer.getOptions().enabled,
            normalizerActive: this.normalizer.getOptions().enabled,
            isCrossfading: this.crossfader.getIsCrossfading(),
        };
    }
}
//# sourceMappingURL=audio-graph.js.map