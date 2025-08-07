import type { VercelRequest, VercelResponse } from '@vercel/node';

interface ProcessedSegment {
    text: string;
    reading?: string;
    translation?: string;
    type?: string;
}

interface ProcessedLine {
    segments: ProcessedSegment[];
}

interface ProcessedLyrics {
    lines: ProcessedLine[];
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

    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { lyrics } = req.body;

        // Validate request body
        if (!lyrics || typeof lyrics !== 'string') {
            return res.status(400).json({
                error: {
                    message: 'Lyrics are required in request body',
                    code: 'MISSING_LYRICS_PARAMETER',
                    timestamp: new Date().toISOString(),
                    path: req.url,
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
                    path: req.url,
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
                    path: req.url,
                },
            });
        }

        console.log('Processing request received:', { lyricsLength: cleanLyrics.length });

        // Check if processing service is available
        const mecabAvailable = process.env.MECAB_AVAILABLE === 'true';
        if (!mecabAvailable) {
            return res.status(503).json({
                error: {
                    message: 'Processing service not configured',
                    code: 'SERVICE_UNAVAILABLE',
                    timestamp: new Date().toISOString(),
                },
            });
        }

        // For now, return a simplified processing that can be enhanced later
        // This would need to integrate with the actual MeCab and dictionary services
        const lines = cleanLyrics.split('\n').filter(line => line.trim().length > 0);
        const processedLines: ProcessedLine[] = [];

        for (const line of lines) {
            const segments: ProcessedSegment[] = [];
            const words = line.split(/\s+/);

            for (const word of words) {
                if (word.trim().length > 0) {
                    segments.push({
                        text: word.trim(),
                        reading: word.trim(), // Would be enhanced with MeCab
                        translation: word.trim(), // Would be enhanced with dictionary
                        type: 'unknown' // Would be enhanced with POS tagging
                    });
                }
            }

            if (segments.length > 0) {
                processedLines.push({ segments });
            }
        }

        const result: ProcessedLyrics = { lines: processedLines };

        console.log('Processing completed successfully:', {
            lyricsLength: cleanLyrics.length,
            processedLines: processedLines.length,
            totalSegments: processedLines.reduce((total, line) => total + line.segments.length, 0)
        });

        res.json(result);

    } catch (error) {
        console.error('Process API error:', error);
        res.status(500).json({
            error: {
                message: 'Internal server error',
                code: 'INTERNAL_ERROR',
                timestamp: new Date().toISOString(),
            },
        });
    }
} 