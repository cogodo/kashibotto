import axios from 'axios';
import { logger } from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';

export interface DictionaryResult {
    word: string;
    definitions: string[];
    partOfSpeech: string[];
    readings: string[];
}

interface CacheEntry {
    word: string;
    definitions: string[];
    partOfSpeech: string[];
    readings: string[];
    timestamp: number;
}

interface DictionaryCache {
    entries: { [key: string]: CacheEntry };
    lastUpdated: number;
}

// Storage interface for different backends
interface StorageBackend {
    load(): Promise<DictionaryCache>;
    save(cache: DictionaryCache): Promise<void>;
}

// File system storage (for local development)
class FileSystemStorage implements StorageBackend {
    private readonly cacheFilePath: string;

    constructor() {
        this.cacheFilePath = path.join(process.cwd(), 'data', 'dictionary-cache.json');
    }

    async load(): Promise<DictionaryCache> {
        try {
            // Ensure data directory exists
            const dataDir = path.dirname(this.cacheFilePath);
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true });
                logger.info('Created data directory for dictionary cache');
            }

            if (fs.existsSync(this.cacheFilePath)) {
                const cacheData = fs.readFileSync(this.cacheFilePath, 'utf8');
                const cache = JSON.parse(cacheData);
                logger.info('Loaded dictionary cache from file', {
                    entryCount: Object.keys(cache.entries).length,
                    lastUpdated: new Date(cache.lastUpdated).toISOString()
                });
                return cache;
            } else {
                logger.info('No existing dictionary cache found, starting fresh');
                return { entries: {}, lastUpdated: Date.now() };
            }
        } catch (error) {
            logger.error('Failed to load dictionary cache from file', { error: (error as Error).message });
            return { entries: {}, lastUpdated: Date.now() };
        }
    }

    async save(cache: DictionaryCache): Promise<void> {
        try {
            cache.lastUpdated = Date.now();
            const cacheData = JSON.stringify(cache, null, 2);
            fs.writeFileSync(this.cacheFilePath, cacheData, 'utf8');
            logger.info('Saved dictionary cache to file', {
                entryCount: Object.keys(cache.entries).length,
                lastUpdated: new Date(cache.lastUpdated).toISOString(),
                filePath: this.cacheFilePath
            });
        } catch (error) {
            logger.error('Failed to save dictionary cache to file', { error: (error as Error).message });
        }
    }
}

// Memory-only storage (for production when no persistent storage is available)
class MemoryOnlyStorage implements StorageBackend {
    private cache: DictionaryCache = { entries: {}, lastUpdated: Date.now() };

    async load(): Promise<DictionaryCache> {
        logger.info('Using memory-only storage for dictionary cache');
        return this.cache;
    }

    async save(cache: DictionaryCache): Promise<void> {
        this.cache = cache;
        logger.info('Updated memory-only dictionary cache', {
            entryCount: Object.keys(cache.entries).length,
            lastUpdated: new Date(cache.lastUpdated).toISOString()
        });
    }
}

class DictionaryService {
    private readonly baseUrl = 'https://jisho.org/api/v1/search/words';
    private readonly maxRetries = 3;
    private readonly retryDelay = 1000; // Reduced from 3000ms to 1000ms for faster retries
    private readonly batchSize = 8; // Increased batch size for better efficiency  
    private readonly batchDelay = 300; // Reduced from 500ms to 300ms for faster processing
    private lastRequestTime = 0;
    private readonly minRequestInterval = 200; // Reduced from 500ms to 200ms - Jisho has no official rate limits

    // Storage backend
    private storage: StorageBackend;
    private cache: DictionaryCache = { entries: {}, lastUpdated: Date.now() };

    constructor() {
        // Choose storage backend based on environment
        const storageType = process.env.DICTIONARY_STORAGE || 'auto';

        if (storageType === 'file' || (storageType === 'auto' && process.env.NODE_ENV !== 'production')) {
            this.storage = new FileSystemStorage();
            logger.info('Using file system storage for dictionary cache');
        } else {
            this.storage = new MemoryOnlyStorage();
            logger.info('Using memory-only storage for dictionary cache (cache will be lost on restart)');
        }

        this.loadCache();
    }

    /**
     * Check if a word contains Japanese characters (Hiragana, Katakana, or Kanji)
     */
    private isJapaneseWord(word: string): boolean {
        if (!word || typeof word !== 'string') return false;

        // Japanese character ranges:
        // Hiragana: \u3040-\u309F
        // Katakana: \u30A0-\u30FF  
        // Kanji: \u4E00-\u9FAF
        const japaneseRegex = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/;
        return japaneseRegex.test(word);
    }

    /**
     * Load cache from storage backend
     */
    private async loadCache(): Promise<void> {
        try {
            this.cache = await this.storage.load();
        } catch (error) {
            logger.error('Failed to load dictionary cache', { error: (error as Error).message });
            this.cache = { entries: {}, lastUpdated: Date.now() };
        }
    }

    /**
     * Save cache to storage backend
     */
    private async saveCache(): Promise<void> {
        try {
            await this.storage.save(this.cache);
        } catch (error) {
            logger.error('Failed to save dictionary cache', { error: (error as Error).message });
        }
    }

    /**
     * Force save cache (useful for testing or when shutting down)
     */
    async forceSaveCache(): Promise<void> {
        await this.saveCache();
    }

    /**
     * Add entry to cache
     */
    private async addToCache(word: string, result: DictionaryResult): Promise<void> {
        try {
            this.cache.entries[word] = {
                word: result.word,
                definitions: result.definitions,
                partOfSpeech: result.partOfSpeech,
                readings: result.readings,
                timestamp: Date.now()
            };

            const cacheSize = Object.keys(this.cache.entries).length;
            logger.info('Added word to cache', {
                word,
                cacheSize
            });

            // Save cache immediately for testing (can be changed to every N entries later)
            logger.info('Saving cache to storage immediately', {
                entryCount: cacheSize
            });
            try {
                await this.saveCache();
                logger.info('Successfully saved cache to storage');
            } catch (saveError) {
                logger.error('Failed to save cache', { error: (saveError as Error).message });
            }
        } catch (error) {
            logger.error('Failed to add entry to cache', { word, error: (error as Error).message });
        }
    }

    /**
     * Get entry from cache
     */
    private getFromCache(word: string): DictionaryResult | null {
        const entry = this.cache.entries[word];
        if (entry) {
            logger.debug('Found word in cache', { word });
            return {
                word: entry.word,
                definitions: entry.definitions,
                partOfSpeech: entry.partOfSpeech,
                readings: entry.readings
            };
        }
        return null;
    }


    async lookupWord(word: string): Promise<DictionaryResult | null> {
        if (!word || typeof word !== 'string') {
            logger.debug('Invalid word provided for dictionary lookup', { word });
            return null;
        }

        const cleanWord = word.trim();
        if (cleanWord.length === 0) {
            return null;
        }

        // Skip very short non-Japanese characters
        if (cleanWord.length === 1 && !this.isJapaneseWord(cleanWord)) {
            logger.debug('Skipping dictionary lookup for single non-Japanese character', { word: cleanWord });
            return null;
        }

        // Check if it's a Japanese word - if not, skip API call
        if (!this.isJapaneseWord(cleanWord)) {
            logger.debug('Skipping dictionary lookup for non-Japanese word', { word: cleanWord });
            return null;
        }

        logger.debug('Looking up word in cache and Jisho API', { word: cleanWord });

        // Step 1: Check cache first
        const cachedResult = this.getFromCache(cleanWord);
        if (cachedResult) {
            return cachedResult;
        }

        // Step 2: Try Jisho API for words not in cache
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                // Implement request throttling to avoid rate limits
                const now = Date.now();
                const timeSinceLastRequest = now - this.lastRequestTime;
                if (timeSinceLastRequest < this.minRequestInterval) {
                    const delay = this.minRequestInterval - timeSinceLastRequest;
                    logger.debug('Throttling Jisho API request', { word: cleanWord, delayMs: delay });
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
                this.lastRequestTime = Date.now();

                const response = await axios.get(`${this.baseUrl}?keyword=${encodeURIComponent(cleanWord)}`, {
                    headers: {
                        'User-Agent': 'Kashibotto/1.0 (Educational Japanese Learning App)',
                        'Accept': 'application/json',
                    },
                    timeout: 15000,
                });

                if (response.data && response.data.data && response.data.data.length > 0) {
                    const firstResult = response.data.data[0];
                    const japanese = firstResult.japanese?.[0];
                    const senses = firstResult.senses?.[0];

                    if (senses && japanese) {
                        const reading = japanese.reading || japanese.word || cleanWord;
                        logger.info('Found word in Jisho API', { word: cleanWord, reading });

                        const result = {
                            word: cleanWord,
                            definitions: senses.english_definitions || ['No definition available'],
                            partOfSpeech: senses.parts_of_speech || ['unknown'],
                            readings: [reading]
                        };

                        // Add to cache for future use
                        await this.addToCache(cleanWord, result);
                        return result;
                    }
                }

                // If we get here, the word wasn't found in Jisho
                logger.debug('Word not found in Jisho API', { word: cleanWord });
                break;

            } catch (error) {
                const isRateLimit = axios.isAxiosError(error) && error.response?.status === 429;
                logger.error(`Jisho API lookup attempt ${attempt} failed`, {
                    word: cleanWord,
                    attempt,
                    error: (error as Error).message,
                    status: axios.isAxiosError(error) ? error.response?.status : 'unknown',
                    isRateLimit
                });

                if (attempt < this.maxRetries) {
                    // Use moderate exponential backoff - much faster than before
                    const delay = isRateLimit ? this.retryDelay * attempt : this.retryDelay * attempt * 0.5;
                    logger.debug('Waiting before retry', { word: cleanWord, attempt, delayMs: delay });
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        // Step 3: Fallback for words not found in any dictionary
        logger.debug('Word not found in any dictionary, providing generic fallback', { word: cleanWord });
        const fallbackResult = {
            word: cleanWord,
            definitions: ['No definition available'],
            partOfSpeech: ['unknown'],
            readings: [cleanWord]
        };

        // Add to cache even if it's a fallback (to avoid repeated API calls for unknown words)
        await this.addToCache(cleanWord, fallbackResult);
        return fallbackResult;
    }

    async lookupBatch(words: string[]): Promise<(DictionaryResult | null)[]> {
        if (!words || words.length === 0) {
            return [];
        }

        logger.info('Starting optimized batch dictionary lookup', { wordCount: words.length });

        const results: (DictionaryResult | null)[] = new Array(words.length).fill(null);

        // Pre-filter words: separate cache hits, API calls needed, and non-Japanese words
        const wordsToProcess: { index: number; word: string; needsApi: boolean }[] = [];
        const nonJapaneseWords: { index: number; word: string }[] = [];

        for (let i = 0; i < words.length; i++) {
            const word = words[i];

            // Skip non-Japanese words immediately
            if (!this.isJapaneseWord(word)) {
                logger.debug('Skipping non-Japanese word immediately', { word });
                nonJapaneseWords.push({ index: i, word });
                continue;
            }

            // Check cache first
            const cachedResult = this.getFromCache(word);
            if (cachedResult) {
                logger.debug('Found word in cache (instant)', { word });
                results[i] = cachedResult;
                continue;
            }

            // Word needs API call
            wordsToProcess.push({ index: i, word, needsApi: true });
        }

        // Process words that need API calls in batches
        for (let i = 0; i < wordsToProcess.length; i += this.batchSize) {
            const batch = wordsToProcess.slice(i, i + this.batchSize);

            // Process batch concurrently
            const batchPromises = batch.map(async ({ index, word }) => {
                try {
                    const result = await this.lookupWord(word);
                    return { index, result };
                } catch (error) {
                    logger.warn('Error in batch dictionary lookup', {
                        word,
                        error: (error as Error).message,
                    });
                    return { index, result: null };
                }
            });

            // Wait for all words in this batch
            const batchResults = await Promise.all(batchPromises);

            // Store results in correct positions
            batchResults.forEach(({ index, result }) => {
                results[index] = result;
            });

            // Add delay between batches only if there are more batches to process
            if (i + this.batchSize < wordsToProcess.length) {
                logger.debug('Batch delay to prevent rate limiting', {
                    completedBatches: Math.floor(i / this.batchSize) + 1,
                    totalBatches: Math.ceil(wordsToProcess.length / this.batchSize)
                });
                await new Promise(resolve => setTimeout(resolve, this.batchDelay));
            }
        }

        logger.info('Optimized batch dictionary lookup completed', {
            totalWords: words.length,
            cacheHits: words.length - wordsToProcess.length - nonJapaneseWords.length,
            apiCalls: wordsToProcess.length,
            skippedNonJapanese: nonJapaneseWords.length,
            successfulLookups: results.filter(result => result !== null).length,
            batchSize: this.batchSize,
            batchDelay: this.batchDelay
        });

        return results;
    }

    async lookupSegments(segments: { surface: string }[]): Promise<(DictionaryResult | null)[]> {
        if (!segments || segments.length === 0) {
            return [];
        }

        const words = segments.map(segment => segment.surface);
        return this.lookupBatch(words);
    }

    // Helper method to format dictionary results for API response
    formatDefinitions(result: DictionaryResult | null): string[] {
        if (!result || !result.definitions || result.definitions.length === 0) {
            return [];
        }

        return result.definitions.slice(0, 2); // Limit to top 2 definitions for brevity
    }

    /**
     * Get cache statistics
     */
    getCacheStats(): { entryCount: number; lastUpdated: string; cacheSize: number } {
        const entryCount = Object.keys(this.cache.entries).length;
        const lastUpdated = new Date(this.cache.lastUpdated).toISOString();
        const cacheSize = JSON.stringify(this.cache).length;

        return { entryCount, lastUpdated, cacheSize };
    }

    /**
     * Clear cache (useful for testing or maintenance)
     */
    async clearCache(): Promise<void> {
        this.cache = { entries: {}, lastUpdated: Date.now() };
        await this.saveCache();
        logger.info('Dictionary cache cleared');
    }
}

export const dictionaryService = new DictionaryService();