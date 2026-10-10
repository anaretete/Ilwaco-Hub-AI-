import { equalPowerGains } from '../utils/formatters.js';
export class Crossfader {
    context;
    deckAGainNode;
    deckBGainNode;
    outputNode;
    activeDeck = 'A';
    isCrossfading = false;
    crossfadeTimer = null;
    constructor(context) {
        this.context = context;
        this.deckAGainNode = context.createGain();
        this.deckBGainNode = context.createGain();
        this.outputNode = context.createGain();
        // Initial state: Deck A 100%, Deck B 0%
        this.deckAGainNode.gain.value = 1.0;
        this.deckBGainNode.gain.value = 0.0;
        this.deckAGainNode.connect(this.outputNode);
        this.deckBGainNode.connect(this.outputNode);
    }
    getActiveDeck() {
        return this.activeDeck;
    }
    getInactiveDeck() {
        return this.activeDeck === 'A' ? 'B' : 'A';
    }
    getIsCrossfading() {
        return this.isCrossfading;
    }
    /**
     * Sets a deck as active immediately without a transition curve.
     */
    setImmediateDeck(deck) {
        this.cancelScheduledFades();
        this.activeDeck = deck;
        this.isCrossfading = false;
        const currentTime = this.context.currentTime;
        if (deck === 'A') {
            this.deckAGainNode.gain.cancelScheduledValues(currentTime);
            this.deckBGainNode.gain.cancelScheduledValues(currentTime);
            this.deckAGainNode.gain.setTargetAtTime(1.0, currentTime, 0.01);
            this.deckBGainNode.gain.setTargetAtTime(0.0, currentTime, 0.01);
        }
        else {
            this.deckAGainNode.gain.cancelScheduledValues(currentTime);
            this.deckBGainNode.gain.cancelScheduledValues(currentTime);
            this.deckAGainNode.gain.setTargetAtTime(0.0, currentTime, 0.01);
            this.deckBGainNode.gain.setTargetAtTime(1.0, currentTime, 0.01);
        }
    }
    /**
     * Performs an equal-power crossfade from active deck to target deck over duration seconds.
     */
    startCrossfade(targetDeck, durationSeconds, onComplete) {
        if (durationSeconds <= 0) {
            this.setImmediateDeck(targetDeck);
            onComplete?.();
            return;
        }
        this.cancelScheduledFades();
        this.isCrossfading = true;
        const fromDeck = this.activeDeck;
        const toDeck = targetDeck;
        const startTime = this.context.currentTime;
        const numPoints = 128; // granularity for smooth equal-power curve
        const curveFrom = new Float32Array(numPoints);
        const curveTo = new Float32Array(numPoints);
        for (let i = 0; i < numPoints; i++) {
            const progress = i / (numPoints - 1);
            const { deckAGain, deckBGain } = equalPowerGains(progress);
            if (fromDeck === 'A' && toDeck === 'B') {
                curveFrom[i] = deckAGain;
                curveTo[i] = deckBGain;
            }
            else {
                curveFrom[i] = deckBGain;
                curveTo[i] = deckAGain;
            }
        }
        const fromNode = fromDeck === 'A' ? this.deckAGainNode : this.deckBGainNode;
        const toNode = toDeck === 'A' ? this.deckAGainNode : this.deckBGainNode;
        fromNode.gain.cancelScheduledValues(startTime);
        toNode.gain.cancelScheduledValues(startTime);
        // Apply sample-accurate Web Audio curves
        fromNode.gain.setValueCurveAtTime(curveFrom, startTime, durationSeconds);
        toNode.gain.setValueCurveAtTime(curveTo, startTime, durationSeconds);
        this.activeDeck = targetDeck;
        this.crossfadeTimer = setTimeout(() => {
            this.isCrossfading = false;
            onComplete?.();
        }, durationSeconds * 1000);
    }
    cancelScheduledFades() {
        if (this.crossfadeTimer) {
            clearTimeout(this.crossfadeTimer);
            this.crossfadeTimer = null;
        }
        const now = this.context.currentTime;
        this.deckAGainNode.gain.cancelScheduledValues(now);
        this.deckBGainNode.gain.cancelScheduledValues(now);
        this.isCrossfading = false;
    }
}
//# sourceMappingURL=crossfader.js.map