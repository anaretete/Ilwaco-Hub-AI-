import { Track } from '../types/track.js';
import { RepeatMode } from '../types/player.js';

export class QueueManager {
  private currentTrack: Track | null = null;
  private queue: Track[] = [];
  private history: Track[] = [];
  private originalQueue: Track[] = []; // Stores unmodified queue for unshuffling

  private isShuffled: boolean = false;
  private repeatMode: RepeatMode = 'off';

  public setQueue(tracks: Track[], startIndex: number = 0): Track | null {
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

  public getCurrentTrack(): Track | null {
    return this.currentTrack;
  }

  public getUpcomingQueue(): readonly Track[] {
    return this.queue;
  }

  public getHistory(): readonly Track[] {
    return this.history;
  }

  public getRepeatMode(): RepeatMode {
    return this.repeatMode;
  }

  public setRepeatMode(mode: RepeatMode): void {
    this.repeatMode = mode;
  }

  public isShuffleEnabled(): boolean {
    return this.isShuffled;
  }

  public toggleShuffle(): boolean {
    this.isShuffled = !this.isShuffled;

    if (this.isShuffled) {
      this.shuffleUpcoming();
    } else {
      // Restore original upcoming order (filtering out already played items)
      const playedIds = new Set(this.history.map((t) => t.id));
      if (this.currentTrack) playedIds.add(this.currentTrack.id);
      this.queue = this.originalQueue.filter((t) => !playedIds.has(t.id));
    }

    return this.isShuffled;
  }

  private shuffleUpcoming(): void {
    // Fisher-Yates shuffle
    const array = [...this.queue];
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    this.queue = array;
  }

  public addTrack(track: Track): void {
    this.queue.push(track);
    this.originalQueue.push(track);
  }

  public addNext(track: Track): void {
    this.queue.unshift(track);
    this.originalQueue.push(track);
  }

  public removeTrack(index: number): Track | null {
    if (index < 0 || index >= this.queue.length) return null;
    const [removed] = this.queue.splice(index, 1);
    this.originalQueue = this.originalQueue.filter((t) => t.id !== removed.id);
    return removed;
  }

  public moveTrack(fromIndex: number, toIndex: number): boolean {
    if (
      fromIndex < 0 ||
      fromIndex >= this.queue.length ||
      toIndex < 0 ||
      toIndex >= this.queue.length
    ) {
      return false;
    }
    const [item] = this.queue.splice(fromIndex, 1);
    this.queue.splice(toIndex, 0, item);
    return true;
  }

  public peekNext(): Track | null {
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

  public next(): Track | null {
    if (this.repeatMode === 'one' && this.currentTrack) {
      return this.currentTrack;
    }

    if (this.queue.length > 0) {
      if (this.currentTrack) {
        this.history.push(this.currentTrack);
      }
      this.currentTrack = this.queue.shift()!;
      return this.currentTrack;
    }

    if (this.repeatMode === 'all' && (this.history.length > 0 || this.currentTrack)) {
      const allTracks = [...this.history];
      if (this.currentTrack) allTracks.push(this.currentTrack);
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

  public previous(): Track | null {
    if (this.history.length === 0) {
      return this.currentTrack;
    }

    const prevTrack = this.history.pop()!;
    if (this.currentTrack) {
      this.queue.unshift(this.currentTrack);
    }
    this.currentTrack = prevTrack;
    return this.currentTrack;
  }

  public clear(): void {
    this.currentTrack = null;
    this.queue = [];
    this.history = [];
    this.originalQueue = [];
  }
}
