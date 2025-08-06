import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { ApiError } from '../services/lyrics';

interface ErrorResponse {
    error: {
        message: string;
        code: string;
        timestamp: string;
        path: string;
    };
}

export const errorHandler = (
    error: Error,
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    const timestamp = new Date().toISOString();
    const path = req.originalUrl;

    // Log the error
    logger.error('Request error', {
        error: error.message,
        stack: error.stack,
        path,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
    });

    // Handle known API errors
    if (error instanceof ApiError) {
        const response: ErrorResponse = {
            error: {
                message: error.message,
                code: error.code,
                timestamp,
                path,
            },
        };

        const statusCode = getStatusCodeForApiError(error.code);
        res.status(statusCode).json(response);
        return;
    }

    // Handle validation errors
    if (error.name === 'ValidationError') {
        const response: ErrorResponse = {
            error: {
                message: 'Invalid request data',
                code: 'VALIDATION_ERROR',
                timestamp,
                path,
            },
        };

        res.status(400).json(response);
        return;
    }

    // Handle rate limit errors
    if (error.message && error.message.includes('Too many requests')) {
        const response: ErrorResponse = {
            error: {
                message: 'Too many requests. Please try again later.',
                code: 'RATE_LIMIT_EXCEEDED',
                timestamp,
                path,
            },
        };

        res.status(429).json(response);
        return;
    }

    // Handle unexpected errors
    const response: ErrorResponse = {
        error: {
            message: 'An unexpected error occurred. Please try again later.',
            code: 'INTERNAL_ERROR',
            timestamp,
            path,
        },
    };

    res.status(500).json(response);
};

function getStatusCodeForApiError(code: string): number {
    switch (code) {
        case 'INVALID_INPUT':
        case 'VALIDATION_ERROR':
            return 400;
        case 'LYRICS_NOT_FOUND':
        case 'NO_JAPANESE_LYRICS':
            return 404;
        case 'SEGMENTATION_FAILED':
        case 'PROCESSING_ERROR':
        case 'NO_VALID_SEGMENTS':
        case 'NO_VALID_LINES':
        case 'COMPLETE_SEGMENTATION_FAILURE':
            return 422;
        case 'RATE_LIMIT_EXCEEDED':
            return 429;
        default:
            return 500;
    }
}

// Middleware to handle async errors
export const asyncHandler = (
    fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
    return (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};