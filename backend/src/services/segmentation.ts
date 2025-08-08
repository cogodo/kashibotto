import { tokenize } from '@enjoyjs/node-mecab';
import { config } from '../config';
import { logger } from '../utils/logger';
import { MorphemeData } from '../types';
import { ApiError } from './lyrics';

class SegmentationService {
    constructor() {
        logger.info('MeCab segmentation service initialized');
    }

    private async analyzeWithMeCab(text: string): Promise<MorphemeData[] | null> {
        try {
            logger.debug('Starting MeCab analysis', { textLength: text.length });

            // Use MeCab to tokenize the text
            const tokens = await tokenize(text, { outputFormatType: 'wakati' });


            if (!tokens || tokens.length === 0) {
                logger.warn('No tokens returned from MeCab', { text });
                return null;
            }

            const morphemes: MorphemeData[] = tokens
                .filter(token => token.stat === 'NORMAL' || token.stat === 'UNKNOWN')
                .map(token => {
                    // Extract surface form
                    const surface = token.surface || '';

                    // Extract part of speech from feature
                    const pos = this.mapMeCabPosToSimple(token.feature?.pos || 'UNKNOWN');

                    // Extract reading from feature
                    const reading = token.feature?.reading || surface;

                    return {
                        surface,
                        pos,
                        reading,
                    };
                })
                .filter(morpheme => morpheme.surface && morpheme.surface.trim().length > 0);

            logger.info('Successfully analyzed text with MeCab', {
                textLength: text.length,
                morphemeCount: morphemes.length
            });

            return morphemes;
        } catch (error) {
            logger.error('Error analyzing with MeCab', {
                error: (error as Error).message,
                textLength: text.length,
            });
            return null;
        }
    }

    // Detect if text contains no Japanese characters (likely English/romanized)
    private isRomanizedText(text: string): boolean {
        const japaneseRegex = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/;
        return !japaneseRegex.test(text);
    }

    // Simple tokenizer for English/romanized text preserving spaces and punctuation
    private tokenizeRomanized(text: string): MorphemeData[] {
        // Split into words, whitespace, and punctuation; capture delimiters
        const parts = text.split(/(\s+|[.,!?;:\"()\[\]\-])/).filter(p => p !== '');
        const morphemes: MorphemeData[] = parts.map(p => {
            let pos = 'latin';
            if (/^\s+$/.test(p)) pos = 'whitespace';
            else if (/^[.,!?;:\"()\[\]\-]$/.test(p)) pos = 'punct';
            return { surface: p, reading: p, pos } as MorphemeData;
        });
        return morphemes;
    }

    private mapMeCabPosToSimple(mecabPos: string): string {
        // Map MeCab POS tags to simplified categories
        const posMap: { [key: string]: string } = {
            // Nouns
            '名詞': 'noun',
            // Verbs
            '動詞': 'verb',
            // Adjectives
            '形容詞': 'adjective',
            '形容動詞': 'adjective',
            // Adverbs
            '副詞': 'adverb',
            // Particles
            '助詞': 'particle',
            '助動詞': 'particle',
            // Conjunctions
            '接続詞': 'conjunction',
            // Interjections
            '感動詞': 'interjection',
            // Prefixes/Suffixes
            '接頭詞': 'prefix',
            '接尾辞': 'suffix',
            // Others
            '記号': 'symbol',
            'その他': 'other',
            'フィラー': 'filler',
            '未知語': 'unknown',
        };

        return posMap[mecabPos] || 'unknown';
    }

    // OPTIMIZED: No more redundant dictionary lookups - just use MeCab's readings
    private enhanceMorphemesWithReadings(morphemes: MorphemeData[]): MorphemeData[] {
        // Skip dictionary lookups here - they'll be done in the processor service
        // Just use MeCab's reading or surface form as fallback
        return morphemes.map(morpheme => ({
            ...morpheme,
            reading: morpheme.reading || morpheme.surface
        }));
    }

    async segmentText(text: string): Promise<MorphemeData[]> {
        if (!text?.trim()) {
            throw new ApiError('Text is required for segmentation', 'INVALID_INPUT');
        }

        // Clean the text - remove extra whitespace and newlines for processing
        const cleanText = text.trim().replace(/\s+/g, ' ');

        logger.info('Starting text segmentation with MeCab', {
            textLength: cleanText.length
        });

        // For pure romanized/English text, use simple tokenizer to avoid char-by-char fallback
        if (this.isRomanizedText(cleanText)) {
            const romanized = this.tokenizeRomanized(cleanText);
            if (romanized.length > 0) {
                return romanized;
            }
        }

        // Try MeCab first
        let morphemes = await this.analyzeWithMeCab(cleanText);

        if (!morphemes || morphemes.length === 0) {
            throw new ApiError(
                'Failed to segment text with available methods',
                'SEGMENTATION_FAILED'
            );
        }

        // Filter out empty morphemes and validate
        const validMorphemes = morphemes.filter(m =>
            m.surface && m.surface.trim().length > 0
        );

        if (validMorphemes.length === 0) {
            throw new ApiError(
                'No valid morphemes found after segmentation',
                'NO_VALID_SEGMENTS'
            );
        }

        // OPTIMIZED: No async call needed anymore - just use MeCab's readings
        const enhancedMorphemes = this.enhanceMorphemesWithReadings(validMorphemes);

        logger.info('Text segmentation completed successfully', {
            textLength: cleanText.length,
            morphemeCount: enhancedMorphemes.length,
            method: 'mecab'
        });

        return enhancedMorphemes;
    }

    async segmentLyrics(lyrics: string): Promise<MorphemeData[][]> {
        if (!lyrics?.trim()) {
            throw new ApiError('Lyrics are required for segmentation', 'INVALID_INPUT');
        }

        // Split lyrics into lines and preserve empty lines for visual separation
        const lines = lyrics.split('\n');

        if (lines.length === 0) {
            throw new ApiError('No valid lines found in lyrics', 'NO_VALID_LINES');
        }

        logger.info('Starting lyrics segmentation', { lineCount: lines.length });

        const segmentedLines: MorphemeData[][] = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            // Handle empty lines by adding an empty segment array for visual separation
            if (line.length === 0) {
                segmentedLines.push([]);
                continue;
            }

            try {
                logger.debug(`Processing line ${i + 1}/${lines.length}`, { line });
                const segments = await this.segmentText(line);
                segmentedLines.push(segments);

                // No delay needed - MeCab segmentation is local and fast
            } catch (error) {
                logger.error(`Failed to segment line ${i + 1}`, {
                    line,
                    error: (error as Error).message
                });

                // Fallback: if romanized, use romanized tokenizer; else split into characters
                let fallbackSegments: MorphemeData[];
                if (this.isRomanizedText(line)) {
                    fallbackSegments = this.tokenizeRomanized(line);
                } else {
                    fallbackSegments = line.split('').map(char => ({
                        surface: char,
                        pos: 'unknown',
                        reading: char,
                    } as MorphemeData));
                }

                segmentedLines.push(fallbackSegments);
            }
        }

        if (segmentedLines.length === 0) {
            throw new ApiError(
                'Failed to segment any lines in the lyrics',
                'COMPLETE_SEGMENTATION_FAILURE'
            );
        }

        logger.info('Lyrics segmentation completed', {
            processedLines: segmentedLines.length,
            totalSegments: segmentedLines.reduce((total, line) => total + line.length, 0)
        });

        return segmentedLines;
    }
}

export const segmentationService = new SegmentationService();