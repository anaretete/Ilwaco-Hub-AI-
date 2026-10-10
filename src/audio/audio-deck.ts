import { Track } from '../types/track.js';
import { AudioStream } from '../types/stream.js';

export interface DeckStateListeners {
  onTimeUpdate: (deck: AudioDeck, currentTime: number, duration: number) => void;
  onEnded: (deck: AudioDeck) => void;
  onWaiting: (deck: AudioDeck) => void;
  onPlaying: (deck: AudioDeck) => void;
  onError: (deck: AudioDeck, error: Event | string) => void;
  onReady: (deck: AudioDeck) => void;
}

export class AudioDeck {
  public readonly id: 'A' | 'B';
  private context: AudioContext;
  private audioElement: HTMLAudioElement;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private destinationNode: GainNode;

  private currentTrack: Track | null = null;
  private currentStream: AudioStream | null = null;
  private listeners: Partial<DeckStateListeners> = {};
  private isPrepared: boolean = false;

  constructor(id: 'A' | 'B', context: AudioContext, destinationNode: GainNode) {
    this.id = id;
    this.context = context;
    this.destinationNode = destinationNode;

    // Initialize HTML5 Audio element
    this.audioElement = new Audio();
    this.audioElement.crossOrigin = 'anonymous';
    this.audioElement.preload = 'auto';

    this.bindEvents();
  }

  private connectSourceNode(): void {
    if (!this.sourceNode) {
      try {
        this.sourceNode = this.context.createMediaElementSource(this.audioElement);
        this.sourceNode.connect(this.destinationNode);
      } catch (err) {
        console.warn(`[Deck ${this.id}] MediaElementSource connection note:`, err);
      }
    }
  }

  private bindEvents(): void {
    this.audioElement.addEventListener('timeupdate', () => {
      this.listeners.onTimeUpdate?.(this, this.audioElement.currentTime, this.audioElement.duration || 0);
    });

    this.audioElement.addEventListener('ended', () => {
      this.listeners.onEnded?.(this);
    });

    this.audioElement.addEventListener('waiting', () => {
      this.listeners.onWaiting?.(this);
    });

    this.audioElement.addEventListener('playing', () => {
      this.listeners.onPlaying?.(this);
    });

    this.audioElement.addEventListener('canplay', () => {
      this.isPrepared = true;
      this.listeners.onReady?.(this);
    });

    this.audioElement.addEventListener('error', (e) => {
      this.listeners.onError?.(this, e);
    });
  }

  public setListeners(listeners: Partial<DeckStateListeners>): void {
    this.listeners = listeners;
  }

  public async load(track: Track, stream: AudioStream): Promise<void> {
    this.currentTrack = track;
    this.currentStream = stream;
    this.isPrepared = false;

    this.connectSourceNode();

    this.audioElement.src = stream.url;
    this.audioElement.load();
  }

  public async play(): Promise<void> {
    this.connectSourceNode();
    try {
      await this.audioElement.play();
    } catch (err) {
      // Autoplay or user gesture rejection
      console.warn(`[Deck ${this.id}] Audio play was interrupted or pending user gesture:`, err);
      throw err;
    }
  }

  public pause(): void {
    this.audioElement.pause();
  }

  public stop(): void {
    this.audioElement.pause();
    this.audioElement.currentTime = 0;
  }

  public seek(seconds: number): void {
    if (isNaN(seconds) || seconds < 0) return;
    const dur = this.audioElement.duration || Infinity;
    this.audioElement.currentTime = Math.min(seconds, dur);
  }

  public setPlaybackRate(rate: number): void {
    const clampedRate = Math.max(0.5, Math.min(2.0, rate));
    this.audioElement.playbackRate = clampedRate;
  }

  public getCurrentTime(): number {
    return this.audioElement.currentTime || 0;
  }

  public getDuration(): number {
    return this.audioElement.duration || this.currentTrack?.duration || 0;
  }

  public getTrack(): Track | null {
    return this.currentTrack;
  }

  public getStream(): AudioStream | null {
    return this.currentStream;
  }

  public isPaused(): boolean {
    return this.audioElement.paused;
  }

  public isReady(): boolean {
    return this.isPrepared;
  }

  /**
   * Calculates buffer health: buffered time ahead in seconds.
   */
  public getBufferedSecondsAhead(): number {
    const cur = this.audioElement.currentTime;
    const ranges = this.audioElement.buffered;
    for (let i = 0; i < ranges.length; i++) {
      if (ranges.start(i) <= cur && ranges.end(i) >= cur) {
        return ranges.end(i) - cur;
      }
    }
    return 0;
  }

  /**
   * Calculates ratio of total duration buffered (0.0 to 1.0).
   */
  public getBufferedRatio(): number {
    const dur = this.audioElement.duration;
    if (!dur || isNaN(dur) || dur <= 0) return 0;
    const ranges = this.audioElement.buffered;
    if (ranges.length === 0) return 0;
    return Math.min(1.0, ranges.end(ranges.length - 1) / dur);
  }

  public reset(): void {
    this.audioElement.pause();
    this.audioElement.removeAttribute('src');
    this.audioElement.load();
    this.currentTrack = null;
    this.currentStream = null;
    this.isPrepared = false;
  }
}
