export declare class Crossfader {
    private context;
    readonly deckAGainNode: GainNode;
    readonly deckBGainNode: GainNode;
    readonly outputNode: GainNode;
    private activeDeck;
    private isCrossfading;
    private crossfadeTimer;
    constructor(context: AudioContext);
    getActiveDeck(): 'A' | 'B';
    getInactiveDeck(): 'A' | 'B';
    getIsCrossfading(): boolean;
    /**
     * Sets a deck as active immediately without a transition curve.
     */
    setImmediateDeck(deck: 'A' | 'B'): void;
    /**
     * Performs an equal-power crossfade from active deck to target deck over duration seconds.
     */
    startCrossfade(targetDeck: 'A' | 'B', durationSeconds: number, onComplete?: () => void): void;
    cancelScheduledFades(): void;
}
//# sourceMappingURL=crossfader.d.ts.map