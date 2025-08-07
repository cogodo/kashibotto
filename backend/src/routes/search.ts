import { Router, Request, Response } from 'express';
import axios from 'axios';
import { logger } from '../utils/logger';
import { config } from '../config';

const router = Router();

interface GeniusSearchResult {
    id: number;
    title: string;
    primary_artist: {
        name: string;
    };
    full_title: string;
}

interface GeniusSearchResponse {
    response: {
        hits: Array<{
            result: GeniusSearchResult;
        }>;
    };
}

interface SearchSuggestion {
    id: number;
    title: string;
    artist: string;
    full_title: string;
}

// Function to filter out romanized and translation results
const filterRomanizedResults = (suggestions: SearchSuggestion[]): SearchSuggestion[] => {
    return suggestions.filter(suggestion => {
        const title = suggestion.title.toLowerCase();
        const artist = suggestion.artist.toLowerCase();
        const fullTitle = suggestion.full_title.toLowerCase();

        // Check if any of the fields contain "romanized" or "translation"
        const hasRomanized = title.includes('romanized') ||
            artist.includes('romanized') ||
            fullTitle.includes('romanized');

        const hasTranslation = title.includes('translation') ||
            artist.includes('translation') ||
            fullTitle.includes('translation');

        return !hasRomanized && !hasTranslation;
    });
};

// GET /api/search - Live search for songs
router.get('/', async (req: Request, res: Response) => {
    try {
        const { q } = req.query;

        if (!q || typeof q !== 'string' || q.trim().length < 2) {
            return res.json({ suggestions: [] });
        }

        const query = q.trim();
        logger.info('Live search request', { query });

        // Try Genius API search if access token is available
        if (config.apis.genius.accessToken) {
            try {
                const searchUrl = `https://api.genius.com/search?q=${encodeURIComponent(query)}`;
                logger.info('Making Genius API request', { searchUrl });

                const response = await axios.get(searchUrl, {
                    headers: {
                        'Authorization': `Bearer ${config.apis.genius.accessToken}`,
                        'User-Agent': 'Kashibotto/1.0'
                    },
                    timeout: 5000 // 5 second timeout for live search
                });

                logger.info('Genius API response received', {
                    status: response.status,
                    dataKeys: Object.keys(response.data || {})
                });

                const data: GeniusSearchResponse = response.data;
                const rawSuggestions = data.response.hits.slice(0, 12).map(hit => ({
                    id: hit.result.id,
                    title: hit.result.title,
                    artist: hit.result.primary_artist.name,
                    full_title: hit.result.full_title
                }));

                // Filter out romanized results
                const suggestions = filterRomanizedResults(rawSuggestions).slice(0, 8);

                logger.info('Live search completed', {
                    query,
                    rawResultsCount: rawSuggestions.length,
                    filteredResultsCount: suggestions.length
                });

                return res.json({ suggestions });

            } catch (error) {
                logger.error('Genius search failed in live search', {
                    query,
                    error: (error as Error).message,
                    stack: (error as Error).stack
                });
                // Fall through to mock suggestions
            }
        } else {
            logger.info('No Genius access token available, using mock data');
        }

        // Fallback: Generate mock suggestions for testing
        const mockSuggestions = [
            { id: 1, title: '君の名は', artist: 'RADWIMPS', full_title: '君の名は by RADWIMPS' },
            { id: 2, title: '前前前世', artist: 'RADWIMPS', full_title: '前前前世 by RADWIMPS' },
            { id: 3, title: 'なんでもないや', artist: 'RADWIMPS', full_title: 'なんでもないや by RADWIMPS' },
            { id: 4, title: 'スパークル', artist: 'RADWIMPS', full_title: 'スパークル by RADWIMPS' },
            { id: 5, title: '夢灯籠', artist: 'RADWIMPS', full_title: '夢灯籠 by RADWIMPS' }
        ].filter(song =>
            song.title.toLowerCase().includes(query.toLowerCase()) ||
            song.artist.toLowerCase().includes(query.toLowerCase())
        );

        // Filter out romanized results from mock suggestions as well
        const filteredMockSuggestions = filterRomanizedResults(mockSuggestions);

        logger.info('Live search using mock data', {
            query,
            rawResultsCount: mockSuggestions.length,
            filteredResultsCount: filteredMockSuggestions.length
        });

        res.json({ suggestions: filteredMockSuggestions });

    } catch (error) {
        logger.error('Live search failed', {
            query: req.query.q,
            error: (error as Error).message,
            stack: (error as Error).stack
        });

        res.status(500).json({
            error: {
                code: 'SEARCH_FAILED',
                message: 'Failed to search for songs'
            }
        });
    }
});

export default router;