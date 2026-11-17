import { Request, Response, NextFunction } from 'express';

interface Bucket {
  count: number;
  resetAt: number;
}

const stores = new Map<string, Map<string, Bucket>>();

export function createRateLimiter(options: {
  name: string;
  windowMs: number;
  maxRequests: number;
}) {
  const store = new Map<string, Bucket>();
  stores.set(options.name, store);

  return (req: Request, res: Response, next: NextFunction) => {
    const key =
      req.headers['x-forwarded-for']?.toString().split(',')[0].trim() ||
      req.socket.remoteAddress ||
      'unknown';

    const now = Date.now();
    const existing = store.get(key);

    if (!existing || existing.resetAt <= now) {
      store.set(key, { count: 1, resetAt: now + options.windowMs });
      return next();
    }

    if (existing.count >= options.maxRequests) {
      const retryAfterSec = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSec));
      return res.status(429).json({
        error: 'Terlalu banyak permintaan. Silakan tunggu sebentar dan coba lagi.',
      });
    }

    existing.count += 1;
    next();
  };
}
