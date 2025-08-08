import dotenv from 'dotenv';
import { RateLimitConfig } from '../types';

dotenv.config();

interface Config {
    server: {
        port: number;
        nodeEnv: string;
        corsOrigin: string | string[];
    };
    apis: {
        // Note: Simplified to core APIs only - Genius (lyrics), MeCab (segmentation), Jisho (dictionary)
        genius: {
            accessToken: string;
        };
    };
    scraping: {
        userAgent: string;
        cookie: string;
        proxy: string;
    };
    rateLimit: RateLimitConfig;
}

const requiredEnvVars = [
    'PORT'
];

// Validate required environment variables
for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
        throw new Error(`Missing required environment variable: ${envVar}`);
    }
}

// Parse CORS origins - support both single string and comma-separated values
const parseCorsOrigin = (corsOrigin: string | undefined): string | string[] => {
    // If no environment variable is set, use defaults
    if (!corsOrigin || corsOrigin.trim() === '') {
        return ['https://cogodo.github.io', 'http://localhost:3000', 'http://localhost:5173'];
    }

    // If it contains commas, split into array
    if (corsOrigin.includes(',')) {
        return corsOrigin.split(',').map(origin => origin.trim()).filter(origin => origin.length > 0);
    }

    // Single origin
    return corsOrigin.trim();
};

export const config: Config = {
    server: {
        port: parseInt(process.env.PORT || '3001'),
        nodeEnv: process.env.NODE_ENV || 'development',
        corsOrigin: parseCorsOrigin(process.env.CORS_ORIGIN),
    },
    apis: {
        genius: {
            accessToken: process.env.GENIUS_ACCESS_TOKEN || process.env.GENIUS_TOKEN || '',
        },
    },
    scraping: {
        userAgent: process.env.SCRAPER_UA || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
        cookie: process.env.GENIUS_COOKIE || '',
        proxy: process.env.HTTPS_PROXY || '',
    },
    rateLimit: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
        maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '10'),
    },
};