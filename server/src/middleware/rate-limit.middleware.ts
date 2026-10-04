import type { NextFunction, Request, Response } from "express";

interface RateLimitOptions {
  windowMs: number;
  max: number;
  message?: string;
  keyPrefix: string;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const stores = new Map<string, Map<string, RateLimitEntry>>();

function getClientKey(req: Request, keyPrefix: string): string {
  if (req.userId) {
    return `${keyPrefix}:user:${req.userId}`;
  }

  return `${keyPrefix}:ip:${req.ip || "unknown"}`;
}

export function createRateLimiter(options: RateLimitOptions) {
  const store =
    stores.get(options.keyPrefix) ??
    new Map<string, RateLimitEntry>();

  stores.set(options.keyPrefix, store);

  return function rateLimit(
    req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    const now = Date.now();
    const key = getClientKey(req, options.keyPrefix);
    const existing = store.get(key);

    if (!existing || existing.resetAt <= now) {
      store.set(key, {
        count: 1,
        resetAt: now + options.windowMs,
      });

      next();
      return;
    }

    if (existing.count >= options.max) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((existing.resetAt - now) / 1000),
      );

      res.setHeader("Retry-After", String(retryAfterSeconds));
      res.status(429).json({
        error: options.message ?? "Too many requests. Please try again later.",
      });
      return;
    }

    existing.count += 1;
    next();
  };
}

const cleanupInterval = setInterval(() => {
  const now = Date.now();

  for (const store of stores.values()) {
    for (const [key, entry] of store.entries()) {
      if (entry.resetAt <= now) {
        store.delete(key);
      }
    }
  }
}, 60_000);

cleanupInterval.unref();
