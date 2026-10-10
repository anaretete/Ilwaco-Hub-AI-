export class TypedEventEmitter<Events extends Record<string, any>> {
  private listeners: Map<keyof Events, Set<Function>> = new Map();

  public on<K extends keyof Events>(event: K, listener: Events[K]): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);

    return () => this.off(event, listener);
  }

  public once<K extends keyof Events>(event: K, listener: Events[K]): () => void {
    const onceWrapper = ((...args: any[]) => {
      this.off(event, onceWrapper as unknown as Events[K]);
      (listener as Function)(...args);
    }) as unknown as Events[K];

    return this.on(event, onceWrapper);
  }

  public off<K extends keyof Events>(event: K, listener: Events[K]): void {
    const set = this.listeners.get(event);
    if (set) {
      set.delete(listener);
      if (set.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  public emit<K extends keyof Events>(event: K, ...args: Parameters<Events[K]>): void {
    const set = this.listeners.get(event);
    if (!set) return;

    for (const listener of Array.from(set)) {
      try {
        listener(...args);
      } catch (err) {
        console.error(`Error in event listener for '${String(event)}':`, err);
      }
    }
  }

  public removeAllListeners(event?: keyof Events): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
}
