import axios from 'axios';
import * as cheerio from 'cheerio';
import { config } from '../config';
import { logger } from '../utils/logger';
import { zyteAgent } from './proxy';

interface GeniusSong {
    id?: number;
    title?: string;
    artist?: {
        name?: string;
    };
    url?: string;
    lyrics?: () => Promise<string>;
}

interface CacheEntry {
    exp: number;
    val: string;
}

class LyricsService {
    private geniusClient: any;
    private cache: Map<string, CacheEntry> = new Map();
    private readonly UA: string;
    private readonly cookie: string;
    private readonly proxy: string;

    constructor() {
        this.geniusClient = null;
        this.UA = config.scraping.userAgent;
        this.cookie = config.scraping.cookie;
        this.proxy = config.scraping.proxy;
    }

    // ---- Cache management ----
    private getCache(key: string): string | undefined {
        const entry = this.cache.get(key);
        if (!entry || entry.exp < Date.now()) {
            this.cache.delete(key);
            return undefined;
        }
        return entry.val;
    }

    private setCache(key: string, val: string, ttlMs = 24 * 60 * 60 * 1000): void {
        this.cache.set(key, { exp: Date.now() + ttlMs, val });
    }

    // ---- Retry helper ----
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private async withRetry<T>(fn: () => Promise<T>, retries = 3, base = 300): Promise<T> {
        let err: any;
        for (let i = 0; i < retries; i++) {
            try {
                return await fn();
            } catch (e) {
                err = e;
                if (i === retries - 1) break;
                await this.sleep(base * 2 ** i + Math.random() * base);
            }
        }
        throw err;
    }

    // ---- Genius client initialization ----
    private async getGeniusClient() {
        if (!this.geniusClient) {
            try {
                const Genius = await import('genius-lyrics-axios');

                if (!Genius || !Genius.Client) {
                    throw new Error('Genius library not properly loaded - missing Client class');
                }

                const clientConfig: any = {
                    requestOptions: {
                        headers: {
                            'user-agent': this.UA,
                            'accept-language': 'en-US,en;q=0.9,ja;q=0.8',
                            ...(this.cookie ? { cookie: this.cookie } : {})
                        },
                        timeout: 10_000,
                        ...(zyteAgent ? { httpsAgent: zyteAgent, proxy: false } : {})
                    }
                };

                try {
                    // Prefer constructing with config so that httpsAgent is respected when present
                    this.geniusClient = new Genius.Client(
                        config.apis.genius.accessToken || undefined,
                        clientConfig
                    );
                    logger.info('Genius client initialized with basic config');
                } catch (basicError) {
                    logger.warn('Basic init failed, trying with config', { error: (basicError as Error).message });
                    this.geniusClient = new Genius.Client(config.apis.genius.accessToken || undefined, clientConfig);
                }

                logger.info('Genius client initialized successfully', {
                    hasToken: !!config.apis.genius.accessToken,
                    environment: process.env.NODE_ENV
                });
            } catch (error) {
                logger.error('Failed to initialize Genius client', {
                    error: (error as Error).message,
                    stack: (error as Error).stack
                });

                // Create fallback client for production
                if (process.env.NODE_ENV === 'production') {
                    logger.warn('Continuing without Genius client in production - using fallback');
                    this.geniusClient = {
                        songs: {
                            search: async (query: string) => {
                                try {
                                    if (!config.apis.genius.accessToken) {
                                        logger.warn('No Genius access token available');
                                        return [];
                                    }

                                    const response = await axios.get(`https://api.genius.com/search?q=${encodeURIComponent(query)}`, {
                                        headers: {
                                            'Authorization': `Bearer ${config.apis.genius.accessToken}`,
                                            'User-Agent': this.UA,
                                        },
                                        timeout: 10000,
                                        ...(zyteAgent ? { httpsAgent: zyteAgent, proxy: false } : {})
                                    });

                                    const hits = response.data?.response?.hits || [];
                                    return hits.slice(0, 5).map((hit: any) => ({
                                        id: hit.result?.id,
                                        title: hit.result?.title,
                                        artist: { name: hit.result?.primary_artist?.name },
                                        url: hit.result?.url,
                                        lyrics: async () => {
                                            return await this.fetchLyricsViaCheerio(hit.result?.url);
                                        }
                                    }));
                                } catch (error) {
                                    logger.error('Direct Genius API also failed', {
                                        error: (error as Error).message
                                    });
                                    return [];
                                }
                            }
                        }
                    };
                } else {
                    throw error;
                }
            }
        }
        return this.geniusClient;
    }

    // ---- Cheerio fallback scraper ----
    async fetchLyricsViaCheerio(url: string): Promise<string> {
        const headers: Record<string, string> = {
            'user-agent': this.UA,
            'accept-language': 'en-US,en;q=0.9,ja;q=0.8',
            'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'connection': 'keep-alive',
            'upgrade-insecure-requests': '1'
        };

        if (this.cookie) {
            headers.cookie = this.cookie;
        }

        const axiosConfig: any = {
            headers,
            timeout: 10_000,
            maxRedirects: 3,
        };

        // If Zyte agent is configured, use it and disable default proxy handling
        if (zyteAgent) {
            axiosConfig.httpsAgent = zyteAgent;
            axiosConfig.proxy = false;
        } else if (this.proxy) {
            // Fallback to plain axios proxy config
            axiosConfig.proxy = {
                host: this.proxy.split(':')[0],
                port: parseInt(this.proxy.split(':')[1] || '80')
            };
        }

        const { data: html } = await axios.get(url, axiosConfig);
        const $ = cheerio.load(html);

        // Method 1: Look for data-lyrics-container elements
        const blocks = $('[data-lyrics-container="true"]')
            .toArray()
            .map(el => $(el).text().trim())
            .filter(Boolean);

        if (blocks.length) {
            return blocks.join('\n\n');
        }

        // Method 2: Look for lyrics-root container
        const lyricsRoot = $('#lyrics-root').text().trim();
        if (lyricsRoot) {
            return lyricsRoot;
        }

        // Method 3: Look for common lyrics containers
        const lyricsContainers = $('.Lyrics__Root, [class*="Lyrics"], .lyrics').text().trim();
        if (lyricsContainers) {
            return lyricsContainers;
        }

        // Method 4: Look for any div with lyrics-like content
        const generalLyrics = $('div').filter((_, el) => {
            const text = $(el).text().trim();
            return text.length > 50 && text.includes('\n');
        }).first().text().trim();

        if (generalLyrics) {
            return generalLyrics;
        }

        throw new Error('Lyrics containers not found in page');
    }

    // ---- Lyrics cleaning ----
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
            const sectionName = match.replace(/[\[\]]/g, '');
            return sectionName.charAt(0).toUpperCase() + sectionName.slice(1).toLowerCase();
        });

        // Remove "Lyrics" headers
        cleaned = cleaned.replace(/^.*?Lyrics.*?\n/gmi, '');

        // Remove "Read More" and similar text
        cleaned = cleaned.replace(/Read\s+More.*?(?=\n|$)/gmi, '');

        // Clean up lines individually while preserving spaces between words
        cleaned = cleaned.split('\n')
            .map(line => {
                const trimmedLine = line.trim();
                return trimmedLine.replace(/[ \t]+/g, ' ');
            })
            .join('\n')
            .replace(/\n{3,}/g, '\n\n')
            .trim();

        return cleaned;
    }

    // ---- Main lyrics fetching logic ----
    async fetchLyrics(songTitle: string, artist?: string): Promise<string> {
        if (!songTitle?.trim()) {
            throw new ApiError('Song title is required', 'INVALID_INPUT');
        }

        const key = `${songTitle}::${artist || ''}`.toLowerCase();
        const cached = this.getCache(key);
        if (cached) {
            logger.info('Returning cached lyrics', { songTitle, artist });
            return cached;
        }

        logger.info('Fetching lyrics', { songTitle, artist });

        // Clean and optimize search query
        let cleanTitle = songTitle.trim();
        let cleanArtist = artist ? artist.trim() : '';

        cleanTitle = cleanTitle
            .replace(/\([^)]*\)/g, '')
            .replace(/\[[^\]]*\]/g, '')
            .replace(/\s+/g, ' ')
            .trim();

        const query = cleanArtist ? `${cleanTitle} ${cleanArtist}` : cleanTitle;

        try {
            // 1) Search via Genius API to get canonical song URL
            const geniusClient = await this.getGeniusClient();
            const results = await this.withRetry(() => geniusClient.songs.search(query)) as GeniusSong[];

            if (!results || results.length === 0) {
                throw new ApiError(`No results found for "${query}"`, 'LYRICS_NOT_FOUND');
            }

            // Filter out romanized and translation results
            const filteredResults = results.filter((song: GeniusSong) => {
                const songTitle = song.title?.toLowerCase() || '';
                const songArtist = song.artist?.name?.toLowerCase() || '';
                const hasRomanized = songTitle.includes('romanized') || songArtist.includes('romanized');
                const hasTranslation = songTitle.includes('translation') || songArtist.includes('translation');
                return !hasRomanized && !hasTranslation;
            });

            if (filteredResults.length === 0) {
                throw new ApiError(`No non-romanized songs found for "${query}"`, 'LYRICS_NOT_FOUND');
            }

            const match = filteredResults.find((r: GeniusSong) =>
                r?.title && r?.artist &&
                r.title.toLowerCase().includes(cleanTitle.toLowerCase()) &&
                r.artist.name?.toLowerCase().includes(cleanArtist.toLowerCase())
            ) ?? filteredResults[0];

            if (!match) {
                throw new ApiError(`No matching song found for "${query}"`, 'LYRICS_NOT_FOUND');
            }

            // 2) Try library lyrics(), then fallback to Cheerio on 403/HTML parse issues
            let lyrics: string | undefined;
            try {
                if (match.lyrics) {
                    lyrics = await this.withRetry(() => match.lyrics!(), 2);
                } else {
                    throw new Error('No lyrics method available');
                }
            } catch (e: any) {
                // Many hosts get 403 here; fallback to our scraper
                if (match.url) {
                    logger.info('Library lyrics failed, trying Cheerio fallback', {
                        error: e.message,
                        url: match.url
                    });
                    lyrics = await this.withRetry(() => this.fetchLyricsViaCheerio(match.url!), 3);
                } else {
                    throw e;
                }
            }

            if (!lyrics || !lyrics.trim()) {
                throw new ApiError(`Empty lyrics for "${match.title}"`, 'LYRICS_NOT_FOUND');
            }

            // Clean and cache the lyrics
            const cleanedLyrics = this.cleanLyrics(lyrics);
            this.setCache(key, cleanedLyrics);

            logger.info('Successfully fetched and cached lyrics', {
                songTitle,
                artist,
                lyricsLength: cleanedLyrics.length
            });

            return cleanedLyrics.trim();
        } catch (error) {
            if (error instanceof ApiError) {
                throw error;
            }

            logger.error('Error fetching lyrics', {
                songTitle,
                artist,
                error: (error as Error).message
            });

            throw new ApiError(
                `Failed to fetch lyrics for "${songTitle}"${artist ? ` by ${artist}` : ''}`,
                'LYRICS_NOT_FOUND'
            );
        }
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