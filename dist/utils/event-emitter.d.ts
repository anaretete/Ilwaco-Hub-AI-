export declare class TypedEventEmitter<Events extends Record<string, any>> {
    private listeners;
    on<K extends keyof Events>(event: K, listener: Events[K]): () => void;
    once<K extends keyof Events>(event: K, listener: Events[K]): () => void;
    off<K extends keyof Events>(event: K, listener: Events[K]): void;
    emit<K extends keyof Events>(event: K, ...args: Parameters<Events[K]>): void;
    removeAllListeners(event?: keyof Events): void;
}
//# sourceMappingURL=event-emitter.d.ts.map