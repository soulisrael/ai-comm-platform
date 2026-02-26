import { Request, Response, NextFunction } from 'express';
import { AppError } from './error-handler';

const EXEMPT_PATHS = ['/health', '/api/docs', '/api/webhooks', '/api/team/login'];

export function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
  // Skip auth for exempt paths
  if (EXEMPT_PATHS.some(p => req.path.startsWith(p))) {
    next();
    return;
  }

  const apiKey = req.headers['x-api-key'] as string | undefined;
  const expectedKey = process.env.API_SECRET_KEY;

  // If no API key is configured, skip auth (development mode)
  if (!expectedKey) {
    next();
    return;
  }

  if (!apiKey) {
    throw new AppError('API key required', 401, 'AUTH_REQUIRED');
  }

  if (apiKey !== expectedKey) {
    throw new AppError('Invalid API key', 403, 'AUTH_INVALID');
  }

  next();
}
