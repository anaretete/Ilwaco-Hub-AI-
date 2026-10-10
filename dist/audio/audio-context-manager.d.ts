export declare class AudioContextManager {
    private context;
    private isUnlocked;
    getContext(): AudioContext;
    unlock(): Promise<boolean>;
    getState(): AudioContextState | 'uninitialized';
    getSampleRate(): number;
    close(): Promise<void>;
}
//# sourceMappingURL=audio-context-manager.d.ts.map