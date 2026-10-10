export interface Artwork {
    url: string;
    width?: number;
    height?: number;
}
export type TrackSourceType = 'youtube' | 'custom_module' | 'jiosaavn' | 'subsonic' | 'local';
export interface Track {
    id: string;
    title: string;
    artist: string;
    album?: string;
    duration: number;
    artwork?: Artwork[];
    sourceType: TrackSourceType;
    sourceId?: string;
    isExplicit?: boolean;
    year?: number;
    genre?: string;
    metadata?: Record<string, unknown>;
}
//# sourceMappingURL=track.d.ts.map