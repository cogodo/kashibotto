import { Router } from 'express';
import { lyricsService } from '../services/lyrics';
import { zyteAgent } from '../services/proxy';

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
        let { song, artist } = req.query as { song?: string; artist?: string };

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

        let songTitle = song.trim();
        let artistName = artist && typeof artist === 'string' ? artist.trim() : undefined;

        // Handle "Song by Artist" format
        if (!artistName && /.+\s+by\s+.+/i.test(songTitle)) {
            const match = songTitle.match(/(.+)\s+by\s+(.+)$/i);
            if (match) {
                songTitle = match[1].trim();
                artistName = match[2].trim();
            }
        }

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

// GET /api/lyricsById?id={genius_song_id} (optional endpoint for direct ID access)
router.get(
    '/byId',
    lyricsRateLimit,
    asyncHandler(async (req, res) => {
        const { id } = req.query as { id?: string };

        if (!id || typeof id !== 'string') {
            return res.status(400).json({
                error: {
                    message: 'Genius song ID is required',
                    code: 'MISSING_ID_PARAMETER',
                    timestamp: new Date().toISOString(),
                    path: req.originalUrl,
                },
            });
        }

        const songId = id.trim();
        if (songId.length === 0) {
            return res.status(400).json({
                error: {
                    message: 'Song ID cannot be empty',
                    code: 'EMPTY_ID_PARAMETER',
                    timestamp: new Date().toISOString(),
                    path: req.originalUrl,
                },
            });
        }

        logger.info('Lyrics by ID request received', {
            id: songId,
            ip: req.ip
        });

        try {
            // Use genius-lyrics-axios to get the song by id
            const Genius = await import('genius-lyrics-axios');
            const client = new Genius.Client(process.env.GENIUS_ACCESS_TOKEN || process.env.GENIUS_TOKEN || '', {
                requestOptions: {
                    headers: { 'user-agent': process.env.SCRAPER_UA || 'Mozilla/5.0' },
                    ...(zyteAgent ? { httpsAgent: zyteAgent, proxy: false } : {}),
                    timeout: 10_000
                }
            });
            const song = await client.songs.get(parseInt(songId));

            let lyrics: string;
            try {
                lyrics = await song.lyrics();
            } catch (e: any) {
                // Fallback to Cheerio if library fails
                if (song.url) {
                    logger.info('Library lyrics failed for ID, trying Cheerio fallback', {
                        error: e.message,
                        url: song.url
                    });
                    lyrics = await lyricsService.fetchLyricsViaCheerio(song.url);
                } else {
                    throw e;
                }
            }

            const response = {
                id: songId,
                title: song.title,
                artist: song.artist?.name,
                lyrics
            };

            logger.info('Lyrics by ID successfully fetched and returned', {
                id: songId,
                title: song.title,
                artist: song.artist?.name,
                lyricsLength: lyrics.length
            });

            res.json(response);
        } catch (error) {
            logger.error('Error fetching lyrics by ID', {
                id: songId,
                error: (error as Error).message
            });

            res.status(404).json({
                error: {
                    message: `Lyrics not found for song ID "${songId}"`,
                    code: 'LYRICS_NOT_FOUND',
                    timestamp: new Date().toISOString(),
                    path: req.originalUrl,
                },
            });
        }
    })
);

export { router as lyricsRouter };