import axios from 'axios';
import { config } from '../config';
import { logger } from '../utils/logger';
// ApiError class defined below

interface GeniusHit {
    result: {
        id: number;
        title: string;
        primary_artist: {
            name: string;
        };
        url: string;
    };
}


class LyricsService {
    private geniusClient: any;

    constructor() {
        // Initialize geniusClient as null - will be set up when needed
        this.geniusClient = null;
    }

    private async getGeniusClient() {
        if (!this.geniusClient) {
            const Genius = await import('genius-lyrics');
            this.geniusClient = new Genius.Client(config.apis.genius.accessToken || undefined);
        }
        return this.geniusClient;
    }

    private cleanLyrics(lyrics: string): string {
        if (!lyrics) return lyrics;

        let cleaned = lyrics;

        // Remove contributors section
        cleaned = cleaned.replace(/^\d+\s*Contributors?.*?(?=\n|$)/gmi, '');

        // Remove language translations section
        cleaned = cleaned.replace(/Translations?.*?(?=\n|$)/gmi, '');

        // Remove language codes and names
        cleaned = cleaned.replace(/(?:Deutsch|Türkçe|ไทย\s*\(Thai\)|Español|Português|فارسی|Français|Polski|Русский\s*\(Russian\)|Česky).*?(?=\n|$)/gmi, '');

        // Remove technical section markers but keep main song structure markers
        cleaned = cleaned.replace(/\[(?:Guitar\s+Solo|Piano|Instrumental|Solo|Coda)\s*\d*\]/gi, '');

        // Clean up section markers - remove brackets but keep the text
        cleaned = cleaned.replace(/\[(?:Verse|Chorus|Refrain|Bridge|Intro|Outro|Pre-Chorus|Post-Chorus|Interlude)(\s*\d*)\]/gi, (match, number) => {
            const sectionName = match.replace(/[\[\]]/g, ''); // Remove brackets
            return sectionName.charAt(0).toUpperCase() + sectionName.slice(1).toLowerCase(); // Capitalize properly
        });

        // Remove "Lyrics" headers
        cleaned = cleaned.replace(/^.*?Lyrics.*?\n/gmi, '');

        // Remove "Read More" and similar text
        cleaned = cleaned.replace(/Read\s+More.*?(?=\n|$)/gmi, '');

        // Clean up lines individually while preserving line structure
        cleaned = cleaned.split('\n')
            .map(line => line.trim()) // Clean each line
            .join('\n') // Rejoin with line breaks
            .replace(/\n{3,}/g, '\n\n') // Limit consecutive empty lines to max 2
            .trim();

        logger.debug('Cleaned lyrics', {
            originalLength: lyrics.length,
            cleanedLength: cleaned.length
        });

        return cleaned;
    }

  

    private async searchGenius(title: string, artist?: string): Promise<string | null> {
        try {
            const query = artist ? `${title} ${artist}` : title;
            logger.info('Searching Genius for song', { query });
            const geniusClient = await this.getGeniusClient();
            const searches = await geniusClient.songs.search(query);
            if (!searches || searches.length === 0) {
                logger.debug('No songs found in Genius', { title, artist });
                return null;
            }
            const firstSong = searches[0];
            logger.info('Found song on Genius', {
                title,
                artist,
                foundTitle: firstSong.title,
                foundArtist: firstSong.artist?.name,
                songUrl: firstSong.url
            });
            const lyrics = await firstSong.lyrics();
            if (lyrics && lyrics.length > 0) {
                logger.info('Successfully fetched lyrics from Genius', {
                    title,
                    artist,
                    lyricsLength: lyrics.length
                });
                return lyrics;
            } else {
                logger.warn('No lyrics found for song on Genius', {
                    title,
                    artist
                });
                return null;
            }
        } catch (error) {
            logger.error('Error searching Genius', {
                title,
                artist,
                error: (error as Error).message,
            });
            return null;
        }
    }

    async fetchLyrics(title: string, artist?: string): Promise<string> {
        if (!title?.trim()) {
            throw new ApiError('Song title is required', 'INVALID_INPUT');
        }

        logger.info('Fetching lyrics', { title, artist });

        // Try Genius first (if configured)
        let lyrics = await this.searchGenius(title, artist);

        // Fallback to sample/test lyrics
        
        if (!lyrics) {
            const errorMessage = artist
                ? `Lyrics not found for "${title}" by ${artist}. Try common songs like "君の名は" or "前前前世" for testing.`
                : `Lyrics not found for "${title}". Try common songs like "君の名は" or "前前前世" for testing.`;

            throw new ApiError(errorMessage, 'LYRICS_NOT_FOUND');
        }

        // Clean the lyrics before returning
        const cleanedLyrics = this.cleanLyrics(lyrics);

        logger.info('Lyrics cleaned and ready for processing', {
            originalLength: lyrics.length,
            cleanedLength: cleanedLyrics.length
        });

        return cleanedLyrics.trim();
    }

    private containsJapaneseText(text: string): boolean {
        // Check for Japanese characters (Hiragana, Katakana, Kanji)
        const japaneseRegex = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/;
        return japaneseRegex.test(text);
    }
}

class ApiError extends Error {
    public readonly code: string;
    public readonly details?: any;

    constructor(message: string, code: string, details?: any) {
        super(message);
        this.name = 'ApiError';
        this.code = code;
        this.details = details;
    }
}

export const lyricsService = new LyricsService();
export { ApiError };