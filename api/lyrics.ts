import type { VercelRequest, VercelResponse } from '@vercel/node';

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
        const { song, artist } = req.query;

        // Validate required parameters
        if (!song || typeof song !== 'string') {
            return res.status(400).json({
                error: {
                    message: 'Song title is required',
                    code: 'MISSING_SONG_PARAMETER',
                    timestamp: new Date().toISOString(),
                    path: req.url,
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
                    path: req.url,
                },
            });
        }

        console.log('Lyrics request received:', { song: songTitle, artist: artistName });

        // Check if Genius API token is available
        const geniusToken = process.env.GENIUS_ACCESS_TOKEN;
        if (!geniusToken) {
            return res.status(503).json({
                error: {
                    message: 'Lyrics service not configured',
                    code: 'SERVICE_UNAVAILABLE',
                    timestamp: new Date().toISOString(),
                },
            });
        }

        // Use Genius API to fetch lyrics - using dynamic import to avoid ES module cycle
        const Genius = await import('genius-lyrics');
        const geniusClient = new Genius.Client(geniusToken);

        const query = artistName ? `${songTitle} ${artistName}` : songTitle;
        const searches = await geniusClient.songs.search(query);

        if (!searches || searches.length === 0) {
            return res.status(404).json({
                error: {
                    message: `Lyrics not found for "${songTitle}"${artistName ? ` by ${artistName}` : ''}`,
                    code: 'LYRICS_NOT_FOUND',
                    timestamp: new Date().toISOString(),
                },
            });
        }

        const firstSong = searches[0];
        const lyrics = await firstSong.lyrics();

        if (!lyrics || lyrics.length === 0) {
            return res.status(404).json({
                error: {
                    message: `No lyrics available for "${songTitle}"${artistName ? ` by ${artistName}` : ''}`,
                    code: 'LYRICS_NOT_FOUND',
                    timestamp: new Date().toISOString(),
                },
            });
        }

        // Clean the lyrics (basic cleaning)
        let cleanedLyrics = lyrics
            .replace(/^\d+\s*Contributors?.*?(?=\n|$)/gmi, '')
            .replace(/Translations?.*?(?=\n|$)/gmi, '')
            .replace(/\[(?:Guitar\s+Solo|Piano|Instrumental|Solo|Coda)\s*\d*\]/gi, '')
            .replace(/^.*?Lyrics.*?\n/gmi, '')
            .replace(/Read\s+More.*?(?=\n|$)/gmi, '')
            .split('\n')
            .map((line: string) => line.trim())
            .join('\n')
            .replace(/\n{3,}/g, '\n\n')
            .trim();

        const response = { lyrics: cleanedLyrics };

        console.log('Lyrics successfully fetched and returned:', {
            song: songTitle,
            artist: artistName,
            lyricsLength: cleanedLyrics.length
        });

        res.json(response);

    } catch (error) {
        console.error('Lyrics API error:', error);
        res.status(500).json({
            error: {
                message: 'Internal server error',
                code: 'INTERNAL_ERROR',
                timestamp: new Date().toISOString(),
            },
        });
    }
} 