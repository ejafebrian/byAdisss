import 'dotenv/config';
import express from 'express';
import type { Express, NextFunction, Request, Response } from 'express';
import { registerRoutes } from './routes.ts';

export function createExpressApp(): Express {
  const app = express();

  app.set('trust proxy', 1);
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Security headers
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // Register all API and /go/:slug, /l/:slug redirect routes
  registerRoutes(app);

  // Global JSON error middleware so unexpected API errors never emit raw HTML
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
      return next(err);
    }
    console.error('Unhandled Express error:', err);
    if (req.path.startsWith('/api')) {
      return res.status(err?.status || 500).json({
        error: err?.message || 'Terjadi kesalahan internal pada server backend.',
      });
    }
    return res.status(err?.status || 500).send('Internal Server Error');
  });

  return app;
}
