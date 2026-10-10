export class TypedEventEmitter {
    listeners = new Map();
    on(event, listener) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(listener);
        return () => this.off(event, listener);
    }
    once(event, listener) {
        const onceWrapper = ((...args) => {
            this.off(event, onceWrapper);
            listener(...args);
        });
        return this.on(event, onceWrapper);
    }
    off(event, listener) {
        const set = this.listeners.get(event);
        if (set) {
            set.delete(listener);
            if (set.size === 0) {
                this.listeners.delete(event);
            }
        }
    }
    emit(event, ...args) {
        const set = this.listeners.get(event);
        if (!set)
            return;
        for (const listener of Array.from(set)) {
            try {
                listener(...args);
            }
            catch (err) {
                console.error(`Error in event listener for '${String(event)}':`, err);
            }
        }
    }
    removeAllListeners(event) {
        if (event) {
            this.listeners.delete(event);
        }
        else {
            this.listeners.clear();
        }
    }
}
//# sourceMappingURL=event-emitter.js.map