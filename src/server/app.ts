import 'dotenv/config';
import express from 'express';
import type { Express } from 'express';
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

  return app;
}
