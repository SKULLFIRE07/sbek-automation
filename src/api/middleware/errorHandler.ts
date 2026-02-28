import type { Request, Response, NextFunction } from 'express';
import { logger } from '../../config/logger.js';

// ---------------------------------------------------------------------------
// Custom error classes
// ---------------------------------------------------------------------------

/**
 * Base application error with an HTTP status code.
 */
export class AppError extends Error {
  public readonly statusCode: number;

  constructor(message: string, statusCode = 500) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    // Maintain proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * 404 — resource not found.
 */
export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404);
  }
}

/**
 * 400 — validation / bad-request error.
 */
export class ValidationError extends AppError {
  constructor(message = 'Validation failed') {
    super(message, 400);
  }
}

// ---------------------------------------------------------------------------
// Global Express error-handling middleware
// ---------------------------------------------------------------------------

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // Determine status code
  const statusCode =
    err instanceof AppError ? err.statusCode : 500;

  // Log the error — full stack for server errors, warn level for client errors
  if (statusCode >= 500) {
    logger.error({ err, statusCode }, err.message);
  } else {
    logger.warn({ err, statusCode }, err.message);
  }

  // Build the response payload
  const payload: Record<string, unknown> = {
    error: true,
    message: err.message,
  };

  // Include the stack trace in development for easier debugging
  if (process.env.NODE_ENV === 'development') {
    payload.stack = err.stack;
  }

  res.status(statusCode).json(payload);
}
