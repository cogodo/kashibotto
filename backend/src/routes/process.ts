import { Router } from 'express';
import { processorService } from '../services/processor';
import { logger } from '../utils/logger';
import { asyncHandler } from '../middleware/errorHandler';
import { processingRateLimit } from '../middleware/rateLimiter';
import { ProcessedLyrics } from '../types';

const router = Router();

// POST /api/process
router.post(
    '/',
    processingRateLimit,
    asyncHandler(async (req, res) => {
        const { lyrics } = req.body;

        // Validate request body
        if (!lyrics || typeof lyrics !== 'string') {
            return res.status(400).json({
                error: {
                    message: 'Lyrics are required in request body',
                    code: 'MISSING_LYRICS_PARAMETER',
                    timestamp: new Date().toISOString(),
                    path: req.originalUrl,
                },
            });
        }

        const cleanLyrics = lyrics.trim();
        if (cleanLyrics.length === 0) {
            return res.status(400).json({
                error: {
                    message: 'Lyrics cannot be empty',
                    code: 'EMPTY_LYRICS_PARAMETER',
                    timestamp: new Date().toISOString(),
                    path: req.originalUrl,
                },
            });
        }

        // Check for reasonable lyrics length (prevent abuse)
        if (cleanLyrics.length > 10000) {
            return res.status(400).json({
                error: {
                    message: 'Lyrics are too long (max 10,000 characters)',
                    code: 'LYRICS_TOO_LONG',
                    timestamp: new Date().toISOString(),
                    path: req.originalUrl,
                },
            });
        }

        logger.info('Processing request received', {
            lyricsLength: cleanLyrics.length,
            ip: req.ip
        });

        // Process the lyrics
        const processedLyrics = await processorService.processLyrics(cleanLyrics);

        // Basic validation of the processed result
        if (!processedLyrics || !processedLyrics.lines || processedLyrics.lines.length === 0) {
            logger.error('Invalid processed lyrics structure', {
                lyricsLength: cleanLyrics.length,
                processedLines: processedLyrics.lines?.length || 0
            });

            return res.status(500).json({
                error: {
                    message: 'Processing completed but result validation failed',
                    code: 'INVALID_PROCESSED_RESULT',
                    timestamp: new Date().toISOString(),
                    path: req.originalUrl,
                },
            });
        }

        logger.info('Processing completed successfully', {
            lyricsLength: cleanLyrics.length,
            processedLines: processedLyrics.lines.length,
            totalSegments: processedLyrics.lines.reduce((total, line) => total + line.length, 0)
        });

        res.json(processedLyrics);
    })
);

export { router as processRouter };