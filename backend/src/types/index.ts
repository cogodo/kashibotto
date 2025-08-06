export interface LyricsResponse {
    lyrics: string;
}

export interface Segment {
    text: string;
    reading: string;
    translation: string;
    dictionary?: string[];
}

export interface ProcessedLyrics {
    lines: Segment[][];
}

export interface MorphemeData {
    surface: string;
    pos: string;
    reading: string;
}

// ApiError is now a class defined in services/lyrics.ts

export interface RateLimitConfig {
    windowMs: number;
    maxRequests: number;
}