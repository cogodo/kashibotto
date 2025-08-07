import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // Only allow GET requests
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { q } = req.query;

        if (!q || typeof q !== 'string' || q.trim().length < 2) {
            return res.json({ suggestions: [] });
        }

        const query = q.trim();
        console.log('Live search request:', query);

        // Check if Genius API token is available
        const geniusToken = process.env.GENIUS_ACCESS_TOKEN;
        if (!geniusToken) {
            return res.status(503).json({
                error: {
                    message: 'Search service not configured',
                    code: 'SERVICE_UNAVAILABLE',
                    timestamp: new Date().toISOString(),
                },
            });
        }

        // Use Genius API search
        const searchUrl = `https://api.genius.com/search?q=${encodeURIComponent(query)}`;
        const response = await axios.get(searchUrl, {
            headers: {
                'Authorization': `Bearer ${geniusToken}`,
                'User-Agent': 'Kashibotto/1.0'
            },
            timeout: 5000
        });

        const data: GeniusSearchResponse = response.data;
        const suggestions = data.response.hits.slice(0, 8).map(hit => ({
            id: hit.result.id,
            title: hit.result.title,
            artist: hit.result.primary_artist.name,
            full_title: hit.result.full_title
        }));

        console.log('Live search completed:', { query, resultsCount: suggestions.length });
        res.json({ suggestions });

    } catch (error) {
        console.error('Live search failed:', error);
        res.status(500).json({
            error: {
                message: 'Internal server error',
                code: 'INTERNAL_ERROR',
                timestamp: new Date().toISOString(),
            },
        });
    }
} 