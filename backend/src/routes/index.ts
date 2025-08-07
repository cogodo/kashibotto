import { Router } from 'express';
import { lyricsRouter } from './lyrics';
import { processRouter } from './process';
import searchRouter from './search';

const router = Router();

// Health check endpoint
router.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'kashibotto',
    });
});

// API routes
router.use('/lyrics', lyricsRouter);
router.use('/process', processRouter);
router.use('/search', searchRouter);

export { router as apiRouter };