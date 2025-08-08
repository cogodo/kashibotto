import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config';
import { logger } from './utils/logger';

import { apiRouter } from './routes';
import { errorHandler } from './middleware/errorHandler';
import { generalRateLimit } from './middleware/rateLimiter';

const app = express();

// Optional TLS bypass for proxy environments lacking system CAs.
// Enable only by setting ZYTE_INSECURE_TLS=1 in environment.
if (process.env.ZYTE_INSECURE_TLS === '1') {
    // eslint-disable-next-line no-process-env
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    logger.warn('TLS verification disabled due to ZYTE_INSECURE_TLS=1');
}

// Trust proxy configuration for deployed environments (needed for rate limiting with X-Forwarded-For headers)
// Enable for both production and development since Render always uses proxies
if (config.server.nodeEnv === 'production' || config.server.nodeEnv === 'development') {
    app.set('trust proxy', 1);
    logger.info('Trust proxy enabled for deployed environment', { nodeEnv: config.server.nodeEnv });
}

// 1) CORS configuration - MUST come FIRST, before any routes or middleware
app.use(cors({
    origin: 'https://cogodo.github.io',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: false
}));

// 2) Explicitly handle OPTIONS preflight for all routes
app.options('*', cors());

// Request logging - AFTER CORS
if (config.server.nodeEnv !== 'test') {
    app.use(morgan('combined', {
        stream: {
            write: (message: string) => {
                logger.info(message.trim());
            },
        },
    }));
}

// Body parsing middleware - AFTER CORS
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// General rate limiting - AFTER CORS, but skip OPTIONS
app.use((req, res, next) => {
    if (req.method === 'OPTIONS') {
        return next(); // Skip rate limiting for OPTIONS
    }
    return generalRateLimit(req, res, next);
});

// API routes
app.use('/api', apiRouter);

// Basic route for root path
app.get('/', (req, res) => {
    res.json({
        message: 'Kashibotto API Server',
        version: '1.0.0',
        status: 'running',
        timestamp: new Date().toISOString(),
        corsEnabled: true,
        corsOrigin: 'https://cogodo.github.io'
    });
});

// Test CORS route
app.get('/test-cors', (req, res) => {
    res.json({
        message: 'CORS test successful',
        timestamp: new Date().toISOString(),
        origin: req.headers.origin || 'no-origin'
    });
});

// Handle 404 errors - catch all unmatched routes
app.all('*', (req, res) => {
    res.status(404).json({
        error: {
            message: 'Route not found',
            code: 'NOT_FOUND',
            timestamp: new Date().toISOString(),
            path: req.originalUrl,
        },
    });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Graceful shutdown function
const gracefulShutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Starting graceful shutdown...`);

    try {
        logger.info('Graceful shutdown completed');
        process.exit(0);
    } catch (error) {
        logger.error('Error during graceful shutdown', {
            error: (error as Error).message
        });
        process.exit(1);
    }
};

// Handle process termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception', {
        error: error.message,
        stack: error.stack
    });
    process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection', {
        reason: reason instanceof Error ? reason.message : String(reason),
        promise: promise.toString()
    });
    process.exit(1);
});

// Start server function
const startServer = async () => {
    try {

        // Start the HTTP server
        const server = app.listen(config.server.port, () => {
            logger.info(`Server running on port ${config.server.port}`, {
                environment: config.server.nodeEnv,
                corsOrigin: config.server.corsOrigin,
            });
        });

        // Handle server errors
        server.on('error', (error: Error) => {
            logger.error('Server error', { error: error.message });
            process.exit(1);
        });

        return server;
    } catch (error) {
        logger.error('Failed to start server', {
            error: (error as Error).message
        });
        process.exit(1);
    }
};

// Start the server if this file is run directly
if (require.main === module) {
    startServer();
}

export { app, startServer };