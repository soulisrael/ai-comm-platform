import { Request, Response, NextFunction } from 'express';
import logger from '../../services/logger';

export interface ApiError {
  error: string;
  code: string;
  details?: unknown;
}

export class AppError extends Error {
  public statusCode: number;
  public code: string;
  public details?: unknown;

  constructor(message: string, statusCode: number, code: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    logger.warn(`API error: ${err.message}`, { code: err.code, statusCode: err.statusCode });
    res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
      details: err.details,
    } satisfies ApiError);
    return;
  }

  logger.error(`Unhandled error: ${err.message}`, { stack: err.stack });
  res.status(500).json({
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
  } satisfies ApiError);
}
