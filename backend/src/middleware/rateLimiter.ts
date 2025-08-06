import rateLimit from 'express-rate-limit';
import { config } from '../config';
import { logger } from '../utils/logger';

// Create different rate limiters for different endpoints
export const generalRateLimit = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.maxRequests,
    message: {
        error: {
            message: 'Too many requests from this IP. Please try again later.',
            code: 'RATE_LIMIT_EXCEEDED',
            timestamp: new Date().toISOString(),
        },
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    handler: (req, res, next, options) => {
        logger.warn('Rate limit exceeded', {
            ip: req.ip,
            path: req.originalUrl,
            method: req.method,
            userAgent: req.get('User-Agent'),
        });

        res.status(429).json(options.message);
    },
});

// More restrictive rate limit for processing endpoint (it's more resource intensive)
export const processingRateLimit = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: Math.max(1, Math.floor(config.rateLimit.maxRequests / 2)), // Half the general limit
    message: {
        error: {
            message: 'Too many processing requests from this IP. Please try again later.',
            code: 'RATE_LIMIT_EXCEEDED',
            timestamp: new Date().toISOString(),
        },
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res, next, options) => {
        logger.warn('Processing rate limit exceeded', {
            ip: req.ip,
            path: req.originalUrl,
            method: req.method,
            userAgent: req.get('User-Agent'),
        });

        res.status(429).json(options.message);
    },
});

// Lenient rate limit for lyrics fetching (cached responses are fast)
export const lyricsRateLimit = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.maxRequests * 2, // Double the general limit
    message: {
        error: {
            message: 'Too many lyrics requests from this IP. Please try again later.',
            code: 'RATE_LIMIT_EXCEEDED',
            timestamp: new Date().toISOString(),
        },
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res, next, options) => {
        logger.warn('Lyrics rate limit exceeded', {
            ip: req.ip,
            path: req.originalUrl,
            method: req.method,
            userAgent: req.get('User-Agent'),
        });

        res.status(429).json(options.message);
    },
});