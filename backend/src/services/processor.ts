import { logger } from '../utils/logger';
import { segmentationService } from './segmentation';
import { dictionaryService } from './dictionary';
import { ApiError } from './lyrics';
import { MorphemeData, ProcessedLyrics, Segment } from '../types';

class ProcessorService {
    // Function to connect segments ending with っ to the next segment when it starts with verb endings
    private connectSmallTsuSegments(segments: Segment[]): Segment[] {
        if (!segments || segments.length < 2) return segments;

        const connectedSegments: Segment[] = [];
        let i = 0;

        while (i < segments.length) {
            const currentSegment = segments[i];

            // Check if current segment ends with っ and there's a next segment
            if (currentSegment.text.endsWith('っ') && i + 1 < segments.length) {
                const nextSegment = segments[i + 1];

                // Check if the next segment starts with common verb endings that make sense with っ
                // Focus on the most common cases: te-form, ta-form, and other verb conjugations
                const verbEndings = [
                    'て', 'た', 'だ',  // te-form, ta-form, da-form (most common)
                    'で', 'ど',        // de-form, do-form
                    'に', 'の', 'は', 'が', 'を',  // particles that often follow verb forms
                    'つつ', 'ながら', 'たり', 'り',  // verb continuative forms
                    'う', 'よう', 'まい', 'ず', 'ぬ',  // volitional, negative forms
                    'ね', 'な', 'よ', 'わ', 'さ'   // sentence endings
                ];

                const shouldConnect = verbEndings.some(ending => nextSegment.text.startsWith(ending));

                if (shouldConnect) {
                    // Connect the segments
                    const connectedSegment: Segment = {
                        text: currentSegment.text + nextSegment.text,
                        reading: currentSegment.reading + nextSegment.reading,
                        translation: currentSegment.translation + ' ' + nextSegment.translation,
                        dictionary: [
                            ...(currentSegment.dictionary || []),
                            ...(nextSegment.dictionary || [])
                        ]
                    };

                    connectedSegments.push(connectedSegment);
                    i += 2; // Skip the next segment since we've combined it
                } else {
                    // Don't connect, just add the current segment
                    connectedSegments.push(currentSegment);
                    i += 1;
                }
            } else {
                connectedSegments.push(currentSegment);
                i += 1;
            }
        }

        return connectedSegments;
    }

    async processLyrics(lyrics: string): Promise<ProcessedLyrics> {
        if (!lyrics?.trim()) {
            throw new ApiError('Lyrics are required for processing', 'INVALID_INPUT');
        }

        const cleanLyrics = lyrics.trim();
        logger.info('Starting lyrics processing', { lyricsLength: cleanLyrics.length });

        try {
            // Step 1: Segment the lyrics into morphemes
            logger.info('Step 1: Segmenting lyrics');
            const segmentedLines = await segmentationService.segmentLyrics(cleanLyrics);

            if (!segmentedLines || segmentedLines.length === 0) {
                throw new ApiError('Failed to segment lyrics', 'SEGMENTATION_FAILED');
            }

            logger.info('Segmentation completed', { lineCount: segmentedLines.length });

            // Step 2: Process each line with batching for better performance
            const processedLines: Segment[][] = [];

            for (let i = 0; i < segmentedLines.length; i++) {
                const morphemes = segmentedLines[i];
                logger.debug(`Processing line ${i + 1}/${segmentedLines.length}`, {
                    morphemeCount: morphemes.length
                });

                // Step 2a: Batch dictionary lookups for this line
                const dictionaryResults = await dictionaryService.lookupSegments(morphemes);

                // Step 2b: Process each morpheme with translations and dictionary data
                const lineSegments: Segment[] = [];

                for (let j = 0; j < morphemes.length; j++) {
                    const morpheme = morphemes[j];
                    const dictionaryData = dictionaryResults[j];

                    try {
                        // Use Jisho dictionary definition as translation instead of DeepL
                        let translation = '[translation unavailable]';
                        if (dictionaryData && dictionaryData.definitions && dictionaryData.definitions.length > 0) {
                            // Use the first definition as the translation
                            translation = dictionaryData.definitions[0];
                        } else {
                            // Fallback: use the surface form if no dictionary definition
                            translation = morpheme.surface;
                        }

                        // Create segment
                        const segment: Segment = {
                            text: morpheme.surface,
                            reading: morpheme.reading || morpheme.surface,
                            translation: translation,
                            dictionary: dictionaryData ? [dictionaryData.definitions[0] || 'No definition available'] : undefined,
                        };

                        lineSegments.push(segment);

                    } catch (error) {
                        logger.warn('Error processing morpheme', {
                            morpheme: morpheme.surface,
                            error: (error as Error).message,
                        });

                        // Create basic segment on error
                        const fallbackSegment: Segment = {
                            text: morpheme.surface,
                            reading: morpheme.reading || morpheme.surface,
                            translation: morpheme.surface, // Use surface form as fallback
                            dictionary: dictionaryData ? [dictionaryData.definitions[0] || 'No definition available'] : undefined,
                        };

                        lineSegments.push(fallbackSegment);
                    }
                }

                // Step 2c: Connect segments ending with っ to the next segment
                const connectedSegments = this.connectSmallTsuSegments(lineSegments);
                processedLines.push(connectedSegments);

                // Small delay between lines to avoid overwhelming APIs
                if (segmentedLines.length > 3 && i < segmentedLines.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }

            const result: ProcessedLyrics = {
                lines: processedLines,
            };

            logger.info('Lyrics processing completed successfully', {
                inputLength: cleanLyrics.length,
                outputLines: processedLines.length,
                totalSegments: processedLines.reduce((sum, line) => sum + line.length, 0),
            });

            return result;

        } catch (error) {
            logger.error('Error processing lyrics', {
                error: (error as Error).message,
                stack: (error as Error).stack,
            });

            throw new ApiError(
                `Failed to process lyrics: ${(error as Error).message}`,
                'PROCESSING_FAILED'
            );
        }
    }

    async processSegments(segments: MorphemeData[]): Promise<Segment[]> {
        if (!segments || segments.length === 0) {
            return [];
        }

        logger.info('Processing segments', { segmentCount: segments.length });

        try {
            // Batch dictionary lookups
            const dictionaryResults = await dictionaryService.lookupSegments(segments);

            const processedSegments: Segment[] = [];

            for (let i = 0; i < segments.length; i++) {
                const segment = segments[i];
                const dictionaryData = dictionaryResults[i];

                try {
                    // Use Jisho dictionary definition as translation instead of DeepL
                    let translation = '[translation unavailable]';
                    if (dictionaryData && dictionaryData.definitions && dictionaryData.definitions.length > 0) {
                        // Use the first definition as the translation
                        translation = dictionaryData.definitions[0];
                    } else {
                        // Fallback: use the surface form if no dictionary definition
                        translation = segment.surface;
                    }

                    const processedSegment: Segment = {
                        text: segment.surface,
                        reading: segment.reading || segment.surface,
                        translation: translation,
                        dictionary: dictionaryData ? [dictionaryData.definitions[0] || 'No definition available'] : undefined,
                    };

                    processedSegments.push(processedSegment);

                } catch (error) {
                    logger.warn('Error processing segment', {
                        segment: segment.surface,
                        error: (error as Error).message,
                    });

                    // Create fallback segment
                    const fallbackSegment: Segment = {
                        text: segment.surface,
                        reading: segment.reading || segment.surface,
                        translation: '[processing error]',
                        dictionary: dictionaryData ? [dictionaryData.definitions[0] || 'No definition available'] : undefined,
                    };

                    processedSegments.push(fallbackSegment);
                }
            }

            logger.info('Segments processing completed', {
                inputCount: segments.length,
                outputCount: processedSegments.length,
            });

            return processedSegments;

        } catch (error) {
            logger.error('Error processing segments', {
                error: (error as Error).message,
            });

            throw new ApiError(
                `Failed to process segments: ${(error as Error).message}`,
                'SEGMENT_PROCESSING_FAILED'
            );
        }
    }

    getStats(): object {
        return {
            service: 'ProcessorService',
            version: '1.0.0',
            features: [
                'lyrics processing',
                'batch dictionary lookups',
                'translation integration',
                'error handling'
            ]
        };
    }
}

export const processorService = new ProcessorService();