export class QueueManager {
    currentTrack = null;
    queue = [];
    history = [];
    originalQueue = []; // Stores unmodified queue for unshuffling
    isShuffled = false;
    repeatMode = 'off';
    setQueue(tracks, startIndex = 0) {
        if (!tracks || tracks.length === 0) {
            this.clear();
            return null;
        }
        const clampedIndex = Math.max(0, Math.min(tracks.length - 1, startIndex));
        this.currentTrack = tracks[clampedIndex];
        this.originalQueue = [...tracks];
        this.history = tracks.slice(0, clampedIndex);
        this.queue = tracks.slice(clampedIndex + 1);
        if (this.isShuffled) {
            this.shuffleUpcoming();
        }
        return this.currentTrack;
    }
    getCurrentTrack() {
        return this.currentTrack;
    }
    getUpcomingQueue() {
        return this.queue;
    }
    getHistory() {
        return this.history;
    }
    getRepeatMode() {
        return this.repeatMode;
    }
    setRepeatMode(mode) {
        this.repeatMode = mode;
    }
    isShuffleEnabled() {
        return this.isShuffled;
    }
    toggleShuffle() {
        this.isShuffled = !this.isShuffled;
        if (this.isShuffled) {
            this.shuffleUpcoming();
        }
        else {
            // Restore original upcoming order (filtering out already played items)
            const playedIds = new Set(this.history.map((t) => t.id));
            if (this.currentTrack)
                playedIds.add(this.currentTrack.id);
            this.queue = this.originalQueue.filter((t) => !playedIds.has(t.id));
        }
        return this.isShuffled;
    }
    shuffleUpcoming() {
        // Fisher-Yates shuffle
        const array = [...this.queue];
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        this.queue = array;
    }
    addTrack(track) {
        this.queue.push(track);
        this.originalQueue.push(track);
    }
    addNext(track) {
        this.queue.unshift(track);
        this.originalQueue.push(track);
    }
    removeTrack(index) {
        if (index < 0 || index >= this.queue.length)
            return null;
        const [removed] = this.queue.splice(index, 1);
        this.originalQueue = this.originalQueue.filter((t) => t.id !== removed.id);
        return removed;
    }
    moveTrack(fromIndex, toIndex) {
        if (fromIndex < 0 ||
            fromIndex >= this.queue.length ||
            toIndex < 0 ||
            toIndex >= this.queue.length) {
            return false;
        }
        const [item] = this.queue.splice(fromIndex, 1);
        this.queue.splice(toIndex, 0, item);
        return true;
    }
    peekNext() {
        if (this.repeatMode === 'one' && this.currentTrack) {
            return this.currentTrack;
        }
        if (this.queue.length > 0) {
            return this.queue[0];
        }
        if (this.repeatMode === 'all' && (this.history.length > 0 || this.currentTrack)) {
            // Loop back: pick first track from history
            return this.history[0] || this.currentTrack;
        }
        return null;
    }
    next() {
        if (this.repeatMode === 'one' && this.currentTrack) {
            return this.currentTrack;
        }
        if (this.queue.length > 0) {
            if (this.currentTrack) {
                this.history.push(this.currentTrack);
            }
            this.currentTrack = this.queue.shift();
            return this.currentTrack;
        }
        if (this.repeatMode === 'all' && (this.history.length > 0 || this.currentTrack)) {
            const allTracks = [...this.history];
            if (this.currentTrack)
                allTracks.push(this.currentTrack);
            this.history = [];
            this.currentTrack = allTracks.shift() || null;
            this.queue = allTracks;
            if (this.isShuffled) {
                this.shuffleUpcoming();
            }
            return this.currentTrack;
        }
        // End of queue
        if (this.currentTrack) {
            this.history.push(this.currentTrack);
        }
        this.currentTrack = null;
        return null;
    }
    previous() {
        if (this.history.length === 0) {
            return this.currentTrack;
        }
        const prevTrack = this.history.pop();
        if (this.currentTrack) {
            this.queue.unshift(this.currentTrack);
        }
        this.currentTrack = prevTrack;
        return this.currentTrack;
    }
    clear() {
        this.currentTrack = null;
        this.queue = [];
        this.history = [];
        this.originalQueue = [];
    }
}
//# sourceMappingURL=queue-manager.js.map