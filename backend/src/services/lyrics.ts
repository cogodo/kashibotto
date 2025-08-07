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

interface GeniusSong {
    id?: number;
    title?: string;
    artist?: {
        name?: string;
    };
    url?: string;
    lyrics?: () => Promise<string>;
}

class LyricsService {
    private geniusClient: any;

    constructor() {
        // Initialize geniusClient as null - will be set up when needed
        this.geniusClient = null;
    }

    private async getGeniusClient() {
        if (!this.geniusClient) {
            try {
                const Genius = await import('genius-lyrics');

                // Check if the library is properly loaded
                if (!Genius || !Genius.Client) {
                    throw new Error('Genius library not properly loaded - missing Client class');
                }

                // Configure the client with minimal config to avoid undici issues in production
                const clientConfig = {
                    requestOptions: {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        }
                        // Remove bodyTimeout and headersTimeout as they cause undici issues in production
                    }
                };

                // PRODUCTION FIX: Try with no config first, then with config
                try {
                    this.geniusClient = new Genius.Client(config.apis.genius.accessToken || undefined);
                    logger.info('Genius client initialized with basic config');
                } catch (basicError) {
                    logger.warn('Basic init failed, trying with config', { error: (basicError as Error).message });
                    this.geniusClient = new Genius.Client(config.apis.genius.accessToken || undefined, clientConfig);
                }
                logger.info('Genius client initialized successfully', {
                    hasToken: !!config.apis.genius.accessToken,
                    environment: process.env.NODE_ENV,
                    nodeVersion: process.version,
                    platform: process.platform
                });
            } catch (error) {
                logger.error('Failed to initialize Genius client', {
                    error: (error as Error).message,
                    stack: (error as Error).stack,
                    suggestion: 'Check if genius-lyrics package is properly installed and compatible with Node.js version',
                    nodeVersion: process.version,
                    platform: process.platform,
                    arch: process.arch
                });

                // In production, if the library fails to load, we should still allow the app to run
                // but log the issue for debugging
                if (process.env.NODE_ENV === 'production') {
                    logger.warn('Continuing without Genius client in production - lyrics functionality will be limited');
                    // Return a mock client that always returns null
                    // Create direct API client as fallback
                    this.geniusClient = {
                        songs: {
                            search: async (query: string) => {
                                try {
                                    logger.info('Using direct Genius API fallback', { query });

                                    if (!config.apis.genius.accessToken) {
                                        logger.warn('No Genius access token available');
                                        return [];
                                    }

                                    const response = await axios.get(`https://api.genius.com/search?q=${encodeURIComponent(query)}`, {
                                        headers: {
                                            'Authorization': `Bearer ${config.apis.genius.accessToken}`,
                                            'User-Agent': 'Mozilla/5.0 (compatible; KashibottoApp/1.0)',
                                        },
                                        timeout: 10000
                                    });

                                    const hits = response.data?.response?.hits || [];
                                    return hits.slice(0, 5).map((hit: any) => ({
                                        id: hit.result?.id,
                                        title: hit.result?.title,
                                        artist: { name: hit.result?.primary_artist?.name },
                                        url: hit.result?.url,
                                        lyrics: async () => {
                                            return await this.fetchLyricsAlternative(hit.result?.url);
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

        // Clean up lines individually while preserving spaces between words
        cleaned = cleaned.split('\n')
            .map(line => {
                // Trim leading/trailing whitespace but preserve spaces between words
                const trimmedLine = line.trim();
                // Only normalize multiple consecutive spaces to single spaces, don't touch single spaces
                return trimmedLine.replace(/[ \t]+/g, ' ');
            })
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
            // PRODUCTION FIX: Clean and optimize search query for better results
            let cleanTitle = title.trim();
            let cleanArtist = artist ? artist.trim() : '';

            // Remove common problematic patterns that work locally but fail in production
            cleanTitle = cleanTitle
                .replace(/\([^)]*\)/g, '') // Remove content in parentheses like "(Daily Heaven and Hell)"
                .replace(/\[[^\]]*\]/g, '') // Remove content in brackets
                .replace(/\s+/g, ' ')       // Normalize spaces
                .trim();

            const query = cleanArtist ? `${cleanTitle} ${cleanArtist}` : cleanTitle;

            logger.info('Searching Genius for song', {
                originalTitle: title,
                cleanedTitle: cleanTitle,
                artist: cleanArtist,
                finalQuery: query
            });

            const geniusClient = await this.getGeniusClient();

            // Add proper error handling for the search
            let searches;
            try {
                logger.info('Attempting Genius search', {
                    query,
                    queryLength: query.length,
                    queryEncoded: encodeURIComponent(query),
                    clientType: typeof geniusClient,
                    hasSearchMethod: !!geniusClient.songs?.search
                });

                searches = await geniusClient.songs.search(query);

                logger.info('Genius search completed', {
                    query,
                    resultsCount: searches ? searches.length : 0,
                    firstResultTitle: searches?.[0]?.title,
                    firstResultArtist: searches?.[0]?.artist?.name
                });

            } catch (searchError) {
                logger.error('Error during Genius search', {
                    query,
                    error: (searchError as Error).message,
                    stack: (searchError as Error).stack,
                    errorName: (searchError as Error).name,
                    clientType: typeof geniusClient
                });
                return null;
            }

            if (!searches || searches.length === 0) {
                logger.warn('No songs found in Genius', {
                    title,
                    artist,
                    query,
                    suggestion: 'Query may be too complex or song not in database'
                });

                // DIAGNOSTIC: Try a simple test search to verify the client works
                try {
                    logger.info('Testing with simple query to verify client functionality');
                    const testSearches = await geniusClient.songs.search("faded");
                    logger.info('Test search results', {
                        testQuery: "faded",
                        testResultsCount: testSearches ? testSearches.length : 0,
                        clientWorking: testSearches && testSearches.length > 0
                    });
                } catch (testError) {
                    logger.error('Even simple test search failed', {
                        testError: (testError as Error).message
                    });
                }

                return null;
            }

            // Filter out romanized and translation results
            const filteredSearches = searches.filter((song: GeniusSong) => {
                const songTitle = song.title?.toLowerCase() || '';
                const songArtist = song.artist?.name?.toLowerCase() || '';

                // Check if any of the fields contain "romanized" or "translation"
                const hasRomanized = songTitle.includes('romanized') ||
                    songArtist.includes('romanized');

                const hasTranslation = songTitle.includes('translation') ||
                    songArtist.includes('translation');

                return !hasRomanized && !hasTranslation;
            });

            if (filteredSearches.length === 0) {
                logger.debug('No non-romanized songs found in Genius', { title, artist, query });
                return null;
            }

            const firstSong = filteredSearches[0];
            logger.info('Found song on Genius', {
                title,
                artist,
                foundTitle: firstSong.title,
                foundArtist: firstSong.artist?.name,
                songUrl: firstSong.url,
                totalResults: searches.length,
                filteredResults: filteredSearches.length
            });

            // Add proper error handling for lyrics fetching
            let lyrics;
            try {
                lyrics = await firstSong.lyrics();
            } catch (lyricsError) {
                logger.error('Error fetching lyrics from Genius', {
                    title,
                    artist,
                    songUrl: firstSong.url,
                    error: (lyricsError as Error).message,
                    stack: (lyricsError as Error).stack
                });

                // If it's a 404 error, try to get lyrics using a different approach
                if ((lyricsError as Error).message.includes('404') || (lyricsError as Error).message.includes('NoResultError')) {
                    logger.info('Attempting alternative lyrics fetching method', { songUrl: firstSong.url });
                    return await this.fetchLyricsAlternative(firstSong.url);
                }

                return null;
            }

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
                    artist,
                    songUrl: firstSong.url
                });
                return null;
            }
        } catch (error) {
            logger.error('Error searching Genius', {
                title,
                artist,
                error: (error as Error).message,
                stack: (error as Error).stack
            });
            return null;
        }
    }

    private async fetchLyricsAlternative(songUrl: string): Promise<string | null> {
        try {
            logger.info('Attempting alternative lyrics fetching', { songUrl });

            // Try to fetch the page directly and parse it
            const response = await axios.get(songUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'DNT': '1',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1',
                    'Sec-Fetch-Dest': 'document',
                    'Sec-Fetch-Mode': 'navigate',
                    'Sec-Fetch-Site': 'none',
                    'Cache-Control': 'max-age=0',
                },
                timeout: 15000
            });

            const html = response.data;

            // Try multiple methods to extract lyrics
            let lyrics = null;

            // Method 1: Look for data-lyrics-container elements (original method)
            const lyricsMatch1 = html.match(/<div[^>]*data-lyrics-container="true"[^>]*>([\s\S]*?)<\/div>/gi);
            if (lyricsMatch1) {
                lyrics = lyricsMatch1.join('\n');
            }

            // Method 2: Look for lyrics-root container
            if (!lyrics) {
                const lyricsRootMatch = html.match(/<div[^>]*id="lyrics-root"[^>]*>([\s\S]*?)<\/div>/gi);
                if (lyricsRootMatch) {
                    lyrics = lyricsRootMatch.join('\n');
                }
            }

            // Method 3: Look for common lyrics containers
            if (!lyrics) {
                const lyricsContainerMatch = html.match(/<div[^>]*class="[^"]*lyrics[^"]*"[^>]*>([\s\S]*?)<\/div>/gi);
                if (lyricsContainerMatch) {
                    lyrics = lyricsContainerMatch.join('\n');
                }
            }

            // Method 4: Look for any div with lyrics-like content
            if (!lyrics) {
                const generalLyricsMatch = html.match(/<div[^>]*>([^<]*[A-Za-z\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF][^<]*)<\/div>/gi);
                if (generalLyricsMatch) {
                    // Filter for divs that might contain lyrics (have some text content)
                    const potentialLyrics = generalLyricsMatch.filter((match: string) => {
                        const textContent = match.replace(/<[^>]*>/g, '').trim();
                        return textContent.length > 50 && textContent.includes('\n');
                    });
                    if (potentialLyrics.length > 0) {
                        lyrics = potentialLyrics.join('\n');
                    }
                }
            }

            if (lyrics) {
                // Clean up HTML tags while preserving spaces
                // Replace closing tags with spaces to preserve word boundaries
                lyrics = lyrics.replace(/<\/[^>]*>/g, ' ');
                // Remove opening tags
                lyrics = lyrics.replace(/<[^>]*>/g, '');

                // Clean up HTML entities
                lyrics = lyrics.replace(/&amp;/g, '&');
                lyrics = lyrics.replace(/&lt;/g, '<');
                lyrics = lyrics.replace(/&gt;/g, '>');
                lyrics = lyrics.replace(/&quot;/g, '"');
                lyrics = lyrics.replace(/&#39;/g, "'");
                lyrics = lyrics.replace(/&nbsp;/g, ' ');

                // Clean up extra whitespace and normalize line breaks
                lyrics = lyrics.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
                // Normalize multiple spaces to single spaces but preserve spaces between words
                lyrics = lyrics.replace(/[ \t]+/g, ' ');
                // Only remove excessive empty lines (3+ consecutive), preserve spacing
                lyrics = lyrics.replace(/\n\s*\n\s*\n+/g, '\n\n').trim();

                if (lyrics.length > 0) {
                    logger.info('Successfully fetched lyrics using alternative method', {
                        lyricsLength: lyrics.length
                    });
                    return lyrics;
                }
            }

            logger.warn('Alternative lyrics fetching failed - no lyrics found in HTML', { songUrl });
            return null;
        } catch (error) {
            logger.error('Error in alternative lyrics fetching', {
                songUrl,
                error: (error as Error).message
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