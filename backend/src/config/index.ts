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
    rateLimit: RateLimitConfig;
}

const requiredEnvVars = [
    'PORT',
    'CORS_ORIGIN'
];

// Validate required environment variables
for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
        throw new Error(`Missing required environment variable: ${envVar}`);
    }
}

// Parse CORS origins - support both single string and comma-separated values
const parseCorsOrigin = (corsOrigin: string): string | string[] => {
    if (!corsOrigin) {
        return ['http://localhost:3000', 'http://localhost:5173'];
    }

    if (corsOrigin.includes(',')) {
        return corsOrigin.split(',').map(origin => origin.trim()).filter(origin => origin.length > 0);
    }
    return corsOrigin;
};

export const config: Config = {
    server: {
        port: parseInt(process.env.PORT || '3001'),
        nodeEnv: process.env.NODE_ENV || 'development',
        corsOrigin: parseCorsOrigin(process.env.CORS_ORIGIN || 'http://localhost:3000,http://localhost:5173'),
    },
    apis: {
        genius: {
            accessToken: process.env.GENIUS_ACCESS_TOKEN || '',
        },
    },
    rateLimit: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
        maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '10'),
    },
};