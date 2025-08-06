import { Router } from 'express';
import { lyricsService } from '../services/lyrics';

import { logger } from '../utils/logger';
import { asyncHandler } from '../middleware/errorHandler';
import { lyricsRateLimit } from '../middleware/rateLimiter';
import { LyricsResponse } from '../types';

const router = Router();

// GET /api/lyrics?song={title}&artist={optional}
router.get(
    '/',
    lyricsRateLimit,
    asyncHandler(async (req, res) => {
        const { song, artist } = req.query;

        // Validate required parameters
        if (!song || typeof song !== 'string') {
            return res.status(400).json({
                error: {
                    message: 'Song title is required',
                    code: 'MISSING_SONG_PARAMETER',
                    timestamp: new Date().toISOString(),
                    path: req.originalUrl,
                },
            });
        }

        const songTitle = song.trim();
        const artistName = artist && typeof artist === 'string' ? artist.trim() : undefined;

        if (songTitle.length === 0) {
            return res.status(400).json({
                error: {
                    message: 'Song title cannot be empty',
                    code: 'EMPTY_SONG_PARAMETER',
                    timestamp: new Date().toISOString(),
                    path: req.originalUrl,
                },
            });
        }

        logger.info('Lyrics request received', {
            song: songTitle,
            artist: artistName,
            ip: req.ip
        });

        // Fetch lyrics from external APIs
        const lyrics = await lyricsService.fetchLyrics(songTitle, artistName);

        const response: LyricsResponse = { lyrics };

        logger.info('Lyrics successfully fetched and returned', {
            song: songTitle,
            artist: artistName,
            lyricsLength: lyrics.length
        });

        res.json(response);
    })
);

export { router as lyricsRouter };