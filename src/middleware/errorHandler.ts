import { Request, Response, NextFunction } from 'express';
import { formatErrorResponse } from '../utils/errors';

/**
 * Global error handling middleware
 */
export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Check if response has already been sent
  if (res.headersSent) {
    return next(err);
  }

  const errorResponse = formatErrorResponse(err);

  // Log error for debugging
  console.error('Error:', {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    url: req.originalUrl,
    method: req.method
  });

  // Send error response
  res.status(errorResponse.error.statusCode).json(errorResponse);
};

