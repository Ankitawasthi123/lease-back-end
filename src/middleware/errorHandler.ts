import { Request, Response, NextFunction } from "express";

export interface ApiError extends Error {
  statusCode?: number;
}

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Production-level error handling middleware
 * Place this AFTER all route handlers
 * 
 * Features:
 * - No sensitive error details exposed to clients in production
 * - Comprehensive server-side logging
 * - Consistent error response format
 * - Proper status codes based on error type
 */
export const errorHandler = (
  err: AppError | Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  // Default error response
  let statusCode = 500;
  let message = "Internal Server Error";
  let isOperational = true;

  // Handle AppError instances (user-facing errors)
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    isOperational = err.isOperational;
  }
  // Handle JSON parsing errors
  else if (err instanceof SyntaxError && "body" in err) {
    statusCode = 400;
    message = "Invalid request format";
    isOperational = true;
  }
  // Handle Sequelize validation errors
  else if (err.name === "SequelizeValidationError" || err.name === "SequelizeUniqueConstraintError") {
    statusCode = 400;
    message = "Invalid data provided";
    isOperational = true;
  }
  // Handle Sequelize connection errors
  else if (err.name === "SequelizeConnectionError") {
    statusCode = 503;
    message = "Database connection unavailable";
    isOperational = false;
  }
  // Handle other database errors
  else if (err.name?.includes("Sequelize")) {
    statusCode = 500;
    message = "Database operation failed";
    isOperational = false;
  }

  // Log errors with full details (server-side only)
  logError(err, statusCode, isOperational);

  // Send safe response to client
  const responsePayload: any = {
    success: false,
    status: statusCode,
    message,
  };

  // Only include development details in development mode
  if (process.env.NODE_ENV === "development") {
    responsePayload.details = err instanceof AppError ? null : err.message;
    if (err.name) responsePayload.errorType = err.name;
  }

  res.status(statusCode).json(responsePayload);
};

/**
 * Production-level error logging
 * Logs to console in development, would connect to error tracking in production
 */
function logError(error: Error, statusCode: number, isOperational: boolean) {
  const isDev = process.env.NODE_ENV === "development";
  const timestamp = new Date().toISOString();

  const logData = {
    timestamp,
    type: isOperational ? "OPERATIONAL_ERROR" : "PROGRAMMING_ERROR",
    statusCode,
    name: error.name,
    message: error.message,
    stack: error.stack,
  };

  if (!isOperational && statusCode >= 500) {
    // Critical errors that need attention
    console.error("🔥 CRITICAL ERROR:", logData);
  } else if (isDev) {
    // Log all errors in development
    console.error("⚠️ ERROR:", logData);
  } else {
    // Production: only log non-operational errors and 5xx status
    if (!isOperational || statusCode >= 500) {
      console.error("⚠️ ERROR:", logData);
    }
  }
}

/**
 * Async route handler wrapper to catch errors
 * Usage: router.get('/path', asyncHandler(async (req, res) => { ... }))
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * 404 Not Found middleware
 * Place this BEFORE error handler
 */
export const notFound = (_req: Request, _res: Response, next: NextFunction) => {
  const error = new AppError("Route not found", 404);
  next(error);
};
