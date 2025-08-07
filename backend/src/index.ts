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

// Security middleware
app.use(helmet());

// CORS configuration
const allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
    : ['https://cogodo.github.io', 'http://localhost:3000', 'http://localhost:5173'];

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);

        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// Request logging
if (config.server.nodeEnv !== 'test') {
    app.use(morgan('combined', {
        stream: {
            write: (message: string) => {
                logger.info(message.trim());
            },
        },
    }));
}

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// General rate limiting
app.use(generalRateLimit);

// API routes
app.use('/api', apiRouter);

// Basic route for root path
app.get('/', (req, res) => {
    res.json({
        message: 'Kashibotto API Server',
        version: '1.0.0',
        status: 'running',
        timestamp: new Date().toISOString(),
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