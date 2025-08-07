import { Router } from 'express';
import { logger } from '../utils/logger';
import { asyncHandler } from '../middleware/errorHandler';
import { lyricsService } from '../services/lyrics';

const router = Router();

// GET /api/debug/genius-test
router.get(
    '/genius-test',
    asyncHandler(async (req, res) => {
        const testQueries = [
            'faded',
            'bad guy billie eilish',
            '天天天国地獄国',
            '天天天国地獄国 Aiobahn'
        ];

        const results = [];

        for (const query of testQueries) {
            try {
                logger.info(`Testing Genius search with query: ${query}`);

                // Access the private method through type assertion for testing
                const searchResult = await (lyricsService as any).searchGenius(query);

                results.push({
                    query,
                    success: !!searchResult,
                    hasLyrics: searchResult ? searchResult.length > 0 : false,
                    lyricsLength: searchResult ? searchResult.length : 0
                });

                logger.info(`Test result for "${query}": ${!!searchResult}`);
            } catch (error) {
                logger.error(`Test failed for "${query}": ${(error as Error).message}`);
                results.push({
                    query,
                    success: false,
                    error: (error as Error).message
                });
            }
        }

        res.json({
            timestamp: new Date().toISOString(),
            nodeVersion: process.version,
            environment: process.env.NODE_ENV,
            platform: process.platform,
            testResults: results
        });
    })
);

export { router as debugRouter };
